"""
Router de telemetría de coche.

Endpoints:
    GET /api/telemetry/{year}/{event_name}/full -> telemetría completa de una vuelta
"""

from fastapi import APIRouter, HTTPException, Path, Query

from config import MAX_YEAR, MIN_YEAR
from core.session_loader import load_session_with_telemetry
from dtos.telemetry_dto import TelemetryResponse
from services.telemetry_service import build_telemetry_response, parse_drivers

router = APIRouter(tags=["Telemetría"])


@router.get(
    "/api/telemetry/{year}/{event_name}/full",
    response_model=TelemetryResponse,
    summary="Telemetría completa de una vuelta",
)
async def get_full_telemetry(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
    drivers: str = Query(
        ...,
        description="Pilotos a comparar. Formato: PILOTO:SESION:VUELTA o PILOTO:SESION",
        examples={"default": {"value": "ALO:Race:44,SAI:Race:44"}},
    ),
) -> TelemetryResponse:
    """Devuelve todos los canales de telemetría para uno o varios pilotos
    en una única petición. Si no se especifica vuelta, se usa la más rápida.

    **Ejemplos de uso:**
    - ?drivers=ALO:Race:44,SAI:Race:44 -> vuelta 44 de Alonso y Sainz en carrera
    - ?drivers=VER:Qualifying,NOR:Qualifying -> vuelta rápida de ambos en clasificación
    - ?drivers=ALO:Race:30,HAM:Qualifying -> sesiones distintas en la misma petición
    """
    try:
        driver_configs = parse_drivers(drivers)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Cargamos solo las sesiones únicas para no recargar Race si dos pilotos la comparten
    unique_sessions: dict[str, object] = {}
    for config in driver_configs:
        session_name = config["session"]
        if session_name not in unique_sessions:
            try:
                unique_sessions[session_name] = await load_session_with_telemetry(
                    year, event_name, session_name
                )
            except Exception as e:
                raise HTTPException(
                    status_code=404,
                    detail=f"Sesión '{session_name}' de '{event_name}' ({year}) no encontrada: {e}",
                )

    return build_telemetry_response(driver_configs, unique_sessions)
