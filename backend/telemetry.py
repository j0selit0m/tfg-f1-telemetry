"""
Módulo de telemetría de F1.

Expone un único endpoint que devuelve todos los canales de telemetría
(velocidad, acelerador, freno, RPM, marcha y DRS) en una sola petición,
optimizado para su uso en la vista de Telemetría del frontend.
"""

import asyncio

import fastf1
import pandas as pd
from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

router = APIRouter()

# Mismas constantes que main.py — se unificarán al reorganizar en carpetas
MIN_YEAR = 2018
MAX_YEAR = 2025


# ── Caché en memoria ──────────────────────────────────────────────────────────
#
# Cargar una sesión desde la API oficial tarda entre 3 y 8 segundos.
# Este diccionario evita recargar la misma sesión si ya fue solicitada
# durante el ciclo de vida del servidor.
#
_session_cache: dict[str, fastf1.core.Session] = {}


async def _load_session(year: int, event_name: str, session_name: str) -> fastf1.core.Session:
    """Carga una sesión de FastF1 con telemetría usando caché en memoria."""
    cache_key = f"{year}_{event_name}_{session_name}"
    if cache_key not in _session_cache:
        session = fastf1.get_session(year, event_name, session_name)
        await asyncio.to_thread(
            session.load, telemetry=True, weather=False, messages=False
        )
        _session_cache[cache_key] = session
    return _session_cache[cache_key]


# ── DTOs ──────────────────────────────────────────────────────────────────────

class TelemetryPoint(BaseModel):
    """Un punto de muestreo de telemetría (~240 ms entre muestras)."""
    distance: float = Field(..., description="Distancia desde el inicio de la vuelta [m]")
    speed:    int   = Field(..., description="Velocidad [km/h]")
    throttle: float = Field(..., description="Presión del acelerador [0–100 %]")
    brake:    int   = Field(..., description="Freno aplicado: 0 = no, 1 = sí")
    rpm:      int   = Field(..., description="Revoluciones del motor [rpm]")
    gear:     int   = Field(..., description="Marcha engranada [1–8]")
    drs:      int   = Field(..., description="Estado DRS: 0/1 cerrado · 8 elegible · 10/12/14 abierto")


class CornerInfo(BaseModel):
    """Información de una curva del circuito."""
    number:   int   = Field(..., description="Número de curva")
    letter:   str   = Field(..., description="Letra identificadora (ej: 'a' en la curva 10a)")
    distance: float = Field(..., description="Distancia desde el inicio de la vuelta [m]")


class DriverTelemetry(BaseModel):
    """Telemetría completa de un piloto para una vuelta concreta."""
    key:        str               = Field(..., description="Identificador único: 'ALO:Race:44'")
    driver:     str               = Field(..., description="Código de 3 letras del piloto")
    session:    str               = Field(..., description="Nombre de la sesión: Race, Qualifying...")
    lap_number: int
    data:       list[TelemetryPoint]


class TelemetryResponse(BaseModel):
    corners: list[CornerInfo]
    drivers: list[DriverTelemetry]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_drivers(drivers_param: str) -> list[dict]:
    """Convierte el query param en una lista de configuraciones de piloto.

    Formatos aceptados:
        ALO:Race:44   → piloto, sesión y vuelta específica
        ALO:Race      → piloto y sesión; usará la vuelta más rápida
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


def _get_lap(session: fastf1.core.Session, driver: str, lap_number: int | None) -> pd.Series | None:
    """Devuelve la vuelta solicitada o la más rápida del piloto. None si no existe."""
    driver_laps = session.laps.pick_drivers(driver)
    if lap_number is not None:
        lap = driver_laps.pick_laps(lap_number)
        return lap.iloc[0] if not lap.empty else None
    return driver_laps.pick_fastest(only_by_time=True)


def _build_telemetry_point(row: pd.Series) -> TelemetryPoint:
    """Serializa una fila del DataFrame de FastF1 al DTO."""
    return TelemetryPoint(
        distance= round(float(row["Distance"]), 1),
        speed=    int(row["Speed"]),
        throttle= round(float(row["Throttle"]), 1),
        brake=    int(bool(row["Brake"])),
        rpm=      int(row["RPM"]),
        gear=     int(row["nGear"]),
        drs=      int(row["DRS"]),
    )


def _build_corners(session: fastf1.core.Session) -> list[CornerInfo]:
    """Extrae la información de curvas del circuito."""
    circuit_info = session.get_circuit_info()
    return [
        CornerInfo(
            number=   int(row["Number"]),
            letter=   str(row["Letter"]).strip() if pd.notna(row["Letter"]) else "",
            distance= round(float(row["Distance"]), 1),
        )
        for _, row in circuit_info.corners.iterrows()
    ]


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get(
    "/api/telemetry/{year}/{event_name}/full",
    response_model=TelemetryResponse,
    tags=["Telemetría"],
    summary="Telemetría completa de una vuelta",
)
async def get_full_telemetry(
    year:       int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2,             description="Nombre del Gran Premio"),
    drivers:    str = Query(
        ...,
        description="Pilotos a comparar. Formato: PILOTO:SESION:VUELTA o PILOTO:SESION",
        example="ALO:Race:44,SAI:Race:44",
    ),
) -> TelemetryResponse:
    """Devuelve todos los canales de telemetría para uno o varios pilotos
    en una única petición. Si no se especifica vuelta, se usa la más rápida.

    **Ejemplos de uso:**
    - `?drivers=ALO:Race:44,SAI:Race:44` → vuelta 44 de Alonso y Sainz en carrera
    - `?drivers=VER:Qualifying,NOR:Qualifying` → vuelta rápida de ambos en clasificación
    - `?drivers=ALO:Race:30,HAM:Qualifying` → sesiones distintas en la misma petición
    """
    try:
        driver_configs = _parse_drivers(drivers)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Cargamos solo las sesiones únicas (evita recargar Race si dos pilotos la comparten)
    unique_sessions: dict[str, fastf1.core.Session] = {}
    for config in driver_configs:
        session_name = config["session"]
        if session_name not in unique_sessions:
            try:
                unique_sessions[session_name] = await _load_session(
                    year, event_name, session_name
                )
            except Exception as e:
                raise HTTPException(
                    status_code=404,
                    detail=f"Sesión '{session_name}' de '{event_name}' ({year}) no encontrada: {e}",
                )

    first_session = next(iter(unique_sessions.values()))
    corners = _build_corners(first_session)

    drivers_data: list[DriverTelemetry] = []
    for config in driver_configs:
        driver_abbr = config["driver"]
        session     = unique_sessions[config["session"]]
        lap         = _get_lap(session, driver_abbr, config["lap"])

        if lap is None:
            continue

        car_data   = lap.get_car_data().add_distance()
        lap_number = int(lap["LapNumber"])

        drivers_data.append(DriverTelemetry(
            key=        f"{driver_abbr}:{config['session']}:{lap_number}",
            driver=     driver_abbr,
            session=    config["session"],
            lap_number= lap_number,
            data=       [_build_telemetry_point(row) for _, row in car_data.iterrows()],
        ))

    return TelemetryResponse(corners=corners, drivers=drivers_data)