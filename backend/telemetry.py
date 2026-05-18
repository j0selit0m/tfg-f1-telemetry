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


@router.get("/api/telemetry/{year}/{event_name}/{session_name}/speed")
async def get_speed_telemetry(
    year: int,
    event_name: str,
    session_name: str,
    drivers: str,
    laps: Optional[str] = None,
):
    """
    Devuelve la telemetría de velocidad por piloto para montar la gráfica Speed vs Distance.
    El eje X es la distancia en metros (no el tiempo) para una comparación justa entre pilotos.
    Incluye las posiciones de las curvas del circuito para las líneas verticales del gráfico.

    Query Params:
      - drivers: abreviaturas separadas por coma (ej: "ALO,VER")
      - laps:    números de vuelta paralelos a drivers (ej: "44,66").
                 Si se omite, se usa la vuelta más rápida de cada piloto.
    """
    try:
        session = fastf1.get_session(year, event_name, session_name)

        # telemetry=True es obligatorio para acceder a los sensores del coche (20Hz).
        # weather y messages se desactivan: no aportan nada a este análisis
        # y aumentarían innecesariamente el tiempo de carga y uso de RAM.
        await asyncio.to_thread(
            session.load, telemetry=True, weather=False, messages=False
        )

        driver_list = [d.strip().upper() for d in drivers.split(",")]

        # Construimos un dict {piloto: número_vuelta} para la selección posterior.
        # Si laps="44,66" → {"ALO": 44, "VER": 66}
        # Si laps=None    → {"ALO": None, "VER": None} → se usará pick_fastest()
        if laps:
            lap_numbers = [int(n.strip()) for n in laps.split(",")]
            lap_map = dict(zip(driver_list, lap_numbers))
        else:
            lap_map = {d: None for d in driver_list}

        # ---- CURVAS DEL CIRCUITO ----
        # get_circuit_info() devuelve metadata del trazado: posición de curvas,
        # sectores de marshal y rotación del mapa. Solo nos interesan las curvas.
        # Distance indica en qué metro del trazado empieza cada curva,
        # que es exactamente lo que el Frontend necesita para dibujar
        # las líneas verticales punteadas del gráfico como en Tracing Insights.
        circuit_info = session.get_circuit_info()
        corners = [
            {
                "number":   int(row["Number"]),
                # Letter identifica subvariantes de curva (ej: "A", "B" en chicanes).
                # strip() limpia espacios y el fallback "" evita NaN en el JSON.
                "letter":   str(row["Letter"]).strip() if pd.notna(row["Letter"]) else "",
                "distance": round(float(row["Distance"]), 1),
            }
            for _, row in circuit_info.corners.iterrows()
        ]

        response_data = {"corners": corners, "drivers": {}}

        for driver_abbr in driver_list:
            driver_laps = session.laps.pick_drivers(driver_abbr)

            # Selección de vuelta: número concreto o fastest por defecto.
            lap_number = lap_map[driver_abbr]
            if lap_number is not None:
                # pick_laps() filtra por número de vuelta de forma nativa.
                lap = driver_laps.pick_laps(lap_number)
                if lap.empty:
                    response_data["drivers"][driver_abbr] = None
                    continue
                # iloc[0] convierte el Laps (colección) a un único objeto Lap
                # necesario para llamar a get_car_data() en la siguiente línea.
                lap = lap.iloc[0]
            else:
                # only_by_time=True ignora IsPersonalBest y busca el mínimo puro.
                lap = driver_laps.pick_fastest(only_by_time=True)
                if lap is None:
                    response_data["drivers"][driver_abbr] = None
                    continue

            # get_car_data() devuelve los canales del coche: Speed, Throttle,
            # Brake, DRS, RPM, nGear. Más eficiente que get_telemetry() porque
            # no fusiona los datos de posición GPS que aquí no necesitamos.
            # add_distance() integra velocidad × tiempo acumulando la distancia
            # en metros desde el inicio de la vuelta → eje X de la gráfica.
            car_data = lap.get_car_data().add_distance()

            response_data["drivers"][driver_abbr] = {
                "lap_number": int(lap["LapNumber"]),
                # Redondeamos Distance a 1 decimal: reduce el tamaño del JSON
                # sin perder resolución visual en la gráfica del Frontend.
                "data": [
                    {
                        "distance": round(float(row["Distance"]), 1),
                        "speed":    int(row["Speed"]),
                    }
                    for _, row in car_data.iterrows()
                ],
            }

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))