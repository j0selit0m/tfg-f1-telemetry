# telemetry.py
import asyncio
import fastf1
import pandas as pd
from fastapi import APIRouter, HTTPException
from typing import Optional

# Router independiente. En main.py solo necesitas añadir:
#   from telemetry import router as telemetry_router
#   app.include_router(telemetry_router)
router = APIRouter()


@router.get("/api/telemetry/{year}/{event_name}/speed")
async def get_speed_telemetry(year: int, event_name: str, drivers: str):
    """
    Formato del query param drivers: PILOTO:SESION:VUELTA
    - Con vuelta:   ?drivers=ALO:Race:44,SAI:Qualifying:1
    - Sin vuelta:   ?drivers=ALO:Race,SAI:Qualifying  → usa fastest lap
    - Misma sesión: ?drivers=ALO:Race,SAI:Race
    """
    try:
        # Parseamos "ALO:Race:44,SAI:Qualifying" en una lista de configuraciones.
        # Separamos driver y session antes del upper() para no romper
        # el nombre de sesión que FastF1 espera en su capitalización original.
        driver_configs = []
        for entry in drivers.split(","):
            parts = entry.strip().split(":")
            if len(parts) < 2:
                raise ValueError(
                    f"Formato inválido: '{entry}'. Usa PILOTO:SESION o PILOTO:SESION:VUELTA"
                )
            driver_configs.append(
                {
                    "driver": parts[0].strip().upper(),
                    "session": parts[1].strip(),  # Race, Qualifying, Sprint...
                    "lap": int(parts[2].strip()) if len(parts) == 3 else None,
                }
            )

        # Cargamos únicamente las sesiones distintas que aparecen en la petición.
        # Si ALO y SAI son ambos de Race, solo cargamos Race una vez.
        unique_sessions = {}
        for config in driver_configs:
            session_name = config["session"]
            if session_name not in unique_sessions:
                session = fastf1.get_session(year, event_name, session_name)
                await asyncio.to_thread(
                    session.load, telemetry=True, weather=False, messages=False
                )
                unique_sessions[session_name] = session

        # Las curvas del circuito son las mismas para todas las sesiones del mismo GP.
        # Tomamos la info de la primera sesión cargada.
        first_session = next(iter(unique_sessions.values()))
        circuit_info = first_session.get_circuit_info()
        corners = [
            {
                "number": int(row["Number"]),
                "letter": str(row["Letter"]).strip() if pd.notna(row["Letter"]) else "",
                "distance": round(float(row["Distance"]), 1),
            }
            for _, row in circuit_info.corners.iterrows()
        ]

        response_data = {"corners": corners, "drivers": []}

        for config in driver_configs:
            driver_abbr = config["driver"]
            session = unique_sessions[config["session"]]
            driver_laps = session.laps.pick_drivers(driver_abbr)

            if config["lap"] is not None:
                lap = driver_laps.pick_laps(config["lap"])
                if lap.empty:
                    response_data["drivers"][driver_abbr] = None
                    continue
                lap = lap.iloc[0]
            else:
                lap = driver_laps.pick_fastest(only_by_time=True)
                if lap is None:
                    response_data["drivers"][driver_abbr] = None
                    continue

            car_data = lap.get_car_data().add_distance()

            key = f"{driver_abbr}:{config['session']}:{int(lap['LapNumber'])}"
            response_data["drivers"].append(
                {
                    "key": key,  # "ALO:Race:44" → identificador único para React
                    "driver": driver_abbr,
                    "session": config["session"],
                    "lap_number": int(lap["LapNumber"]),
                    "data": [
                        {
                            "distance": round(float(row["Distance"]), 1),
                            "speed": int(row["Speed"]),
                        }
                        for _, row in car_data.iterrows()
                    ],
                }
            )

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
