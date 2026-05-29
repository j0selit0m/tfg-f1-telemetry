"""
Router de mapa de circuito.

Endpoints:
    GET /api/track/{year}/{event_name}/map → comparativa de 25 microsectores
"""

from fastapi import APIRouter, HTTPException, Path, Query

from config import MAX_YEAR, MIN_YEAR
from core.session_loader import load_session_with_telemetry
from dtos.track_dto import TrackMapResponse
from services.telemetry_service import parse_drivers
from services.track_service import build_track_response

router = APIRouter(tags=["Track Map"])


@router.get(
    "/api/track/{year}/{event_name}/map",
    response_model=TrackMapResponse,
    summary="Comparativa de 25 microsectores entre N pilotos",
)
async def get_track_map(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
    drivers: str = Query(
        ...,
        description="2 o más pilotos de la misma sesión. Formato: PILOTO:SESION o PILOTO:SESION:VUELTA",
        examples={"default": {"value": "ALO:Race,SAI:Race"}},
    ),
) -> TrackMapResponse:
    """Divide el trazado en 25 microsectores iguales en distancia relativa
    y colorea cada uno con el piloto que lo recorrió en menor tiempo.

    La división usa RelativeDistance (0.0-1.0), no distancia absoluta en metros,
    por lo que cada microsector representa la misma fracción de vuelta
    independientemente de la longitud del circuito.
    """
    try:
        driver_configs = parse_drivers(drivers)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    sessions_used = {c["session"] for c in driver_configs}
    if len(sessions_used) > 1:
        raise HTTPException(
            status_code=422,
            detail=f"Todos los pilotos deben pertenecer a la misma sesión. Recibidas: {sessions_used}",
        )

    session_name = driver_configs[0]["session"]

    try:
        session = await load_session_with_telemetry(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Sesión '{session_name}' de '{event_name}' ({year}) no encontrada: {e}",
        )

    try:
        return build_track_response(driver_configs, session)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
