"""
Módulo de telemetría de F1.

Expone un único endpoint que devuelve todos los canales de telemetría
(velocidad, acelerador, freno, RPM, marcha y DRS) en una sola petición,
optimizado para su uso en la vista de Telemetría del frontend.
"""

import asyncio

import fastf1
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Caché en memoria de sesiones FastF1
#
# Cargar una sesión desde la API oficial tarda entre 3 y 8 segundos.
# Este diccionario evita recargar la misma sesión si ya fue solicitada
# durante el ciclo de vida del servidor.
# ──────────────────────────────────────────────────────────────────────────────
_session_cache: dict[str, fastf1.core.Session] = {}


async def _load_session(year: int, event_name: str, session_name: str) -> fastf1.core.Session:
    """Carga una sesión de FastF1 usando caché en memoria."""
    cache_key = f"{year}_{event_name}_{session_name}"

    if cache_key not in _session_cache:
        session = fastf1.get_session(year, event_name, session_name)
        await asyncio.to_thread(
            session.load, telemetry=True, weather=False, messages=False
        )
        _session_cache[cache_key] = session

    return _session_cache[cache_key]


# ──────────────────────────────────────────────────────────────────────────────
# DTOs — Modelos de respuesta (contrato Backend → Frontend)
# ──────────────────────────────────────────────────────────────────────────────

class TelemetryPoint(BaseModel):
    """Un punto de muestreo de telemetría (~240 ms entre muestras)."""
    distance: float   # Distancia desde el inicio de la vuelta [m]
    speed:    int     # Velocidad [km/h]
    throttle: float   # Presión del acelerador [0–100 %]
    brake:    int     # Freno aplicado [0 = no, 1 = sí]
    rpm:      int     # Revoluciones del motor [rpm]
    gear:     int     # Marcha engranada [1–8]
    drs:      int     # Estado DRS: 0/1 cerrado · 8 elegible · 10/12/14 abierto


class CornerInfo(BaseModel):
    number:   int    # Número de curva
    letter:   str    # Letra identificadora (ej. "a" en la curva 10a)
    distance: float  # Distancia desde el inicio de la vuelta [m]


class DriverTelemetry(BaseModel):
    """Telemetría completa de un piloto para una vuelta concreta."""
    key:        str              # Identificador único: "ALO:Race:44"
    driver:     str              # Código de 3 letras del piloto
    session:    str              # Nombre de la sesión: Race, Qualifying…
    lap_number: int
    data:       list[TelemetryPoint]


class TelemetryResponse(BaseModel):
    corners: list[CornerInfo]
    drivers: list[DriverTelemetry]


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_drivers(drivers_param: str) -> list[dict]:
    """
    Convierte el query param en una lista de configuraciones de piloto.

    Formatos aceptados:
        ALO:Race:44        → piloto, sesión y vuelta específica
        ALO:Race           → piloto y sesión; usará la vuelta más rápida
    """
    configs = []
    for entry in drivers_param.split(","):
        parts = entry.strip().split(":")
        if len(parts) < 2:
            raise ValueError(
                f"Formato inválido: '{entry}'. Usa PILOTO:SESION o PILOTO:SESION:VUELTA"
            )
        configs.append({
            "driver":  parts[0].strip().upper(),
            "session": parts[1].strip(),
            "lap":     int(parts[2].strip()) if len(parts) == 3 else None,
        })
    return configs


def _get_lap(session: fastf1.core.Session, driver: str, lap_number: int | None):
    """
    Devuelve la vuelta solicitada o la más rápida del piloto.
    Retorna None si no se encuentra la vuelta.
    """
    driver_laps = session.laps.pick_drivers(driver)

    if lap_number is not None:
        lap = driver_laps.pick_laps(lap_number)
        return lap.iloc[0] if not lap.empty else None

    return driver_laps.pick_fastest(only_by_time=True)


def _build_telemetry_point(row: pd.Series) -> dict:
    """Serializa una fila del DataFrame de FastF1 al formato del DTO."""
    return {
        "distance": round(float(row["Distance"]), 1),
        "speed":    int(row["Speed"]),
        "throttle": round(float(row["Throttle"]), 1),
        "brake":    int(bool(row["Brake"])),
        "rpm":      int(row["RPM"]),
        "gear":     int(row["nGear"]),
        "drs":      int(row["DRS"]),
    }


def _build_corners(session: fastf1.core.Session) -> list[dict]:
    """Extrae la información de curvas del circuito."""
    circuit_info = session.get_circuit_info()
    return [
        {
            "number":   int(row["Number"]),
            "letter":   str(row["Letter"]).strip() if pd.notna(row["Letter"]) else "",
            "distance": round(float(row["Distance"]), 1),
        }
        for _, row in circuit_info.corners.iterrows()
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Endpoint principal
# ──────────────────────────────────────────────────────────────────────────────

@router.get(
    "/api/telemetry/{year}/{event_name}/full",
    response_model=TelemetryResponse,
    summary="Telemetría completa de una vuelta",
    tags=["Telemetría"],
)
async def get_full_telemetry(
    year:       int,
    event_name: str,
    drivers:    str = Query(
        ...,
        description="Pilotos a comparar. Formato: PILOTO:SESION:VUELTA o PILOTO:SESION",
        example="ALO:Race:44,SAI:Race:44",
    ),
):
    """
    Devuelve todos los canales de telemetría para uno o varios pilotos
    en una única petición. Si no se especifica vuelta, se usa la más rápida.

    **Ejemplos de uso:**
    - `?drivers=ALO:Race:44,SAI:Race:44` → vuelta 44 de Alonso y Sainz en carrera
    - `?drivers=VER:Qualifying,NOR:Qualifying` → vuelta rápida de ambos en clasificación
    - `?drivers=ALO:Race:30,HAM:Qualifying` → sesiones distintas en la misma petición
    """
    try:
        driver_configs = _parse_drivers(drivers)

        # Cargamos solo las sesiones únicas (evita recargar Race si dos pilotos la comparten)
        unique_sessions: dict[str, fastf1.core.Session] = {}
        for config in driver_configs:
            session_name = config["session"]
            if session_name not in unique_sessions:
                unique_sessions[session_name] = await _load_session(
                    year, event_name, session_name
                )

        first_session = next(iter(unique_sessions.values()))
        corners = _build_corners(first_session)

        drivers_data = []
        for config in driver_configs:
            driver_abbr = config["driver"]
            session     = unique_sessions[config["session"]]
            lap         = _get_lap(session, driver_abbr, config["lap"])

            if lap is None:
                continue

            car_data = lap.get_car_data().add_distance()
            lap_number = int(lap["LapNumber"])

            drivers_data.append({
                "key":        f"{driver_abbr}:{config['session']}:{lap_number}",
                "driver":     driver_abbr,
                "session":    config["session"],
                "lap_number": lap_number,
                "data":       [_build_telemetry_point(row) for _, row in car_data.iterrows()],
            })

        return {"corners": corners, "drivers": drivers_data}

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))