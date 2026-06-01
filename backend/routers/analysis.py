"""
Router de análisis de sesión.

Endpoints:
    GET /api/analysis/{year}/{event_name}/{session_name}/laps    → vueltas agrupadas
    GET /api/analysis/{year}/{event_name}/{session_name}/summary → estadísticas resumen
    GET /api/analysis/{year}/{event_name}/{session_name}/stints  → métricas por stint
"""

from fastapi import APIRouter, HTTPException, Path, Query

from config import MAX_YEAR, MIN_YEAR
from core.session_loader import load_session_metadata
from dtos.analysis_dto import LapsResponseDTO, StintsResponseDTO, SummaryResponseDTO
from services.lap_service import build_laps_response
from services.stint_service import build_stints_response
from services.summary_service import build_summary_response

router = APIRouter(tags=["Análisis"])


# --- Parámetros de ruta compartidos ---
#
# Las tres rutas comparten el mismo prefijo y los mismos path params.
# Se definen aquí para no repetir las descripciones en cada endpoint.
#
_YEAR = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1")
_EVENT_NAME = Path(..., min_length=2, description="Nombre del Gran Premio")
_SESSION = Path(..., description="Tipo de sesión: Race, Qualifying, FP1...")
_DRIVERS_Q = Query(
    ...,
    description="Abreviaturas de pilotos separadas por coma",
    examples={"default": {"value": "ALO,SAI,VER"}},
)


@router.get(
    "/api/analysis/{year}/{event_name}/{session_name}/laps",
    response_model=LapsResponseDTO,
    summary="Datos de vuelta agrupados por número de vuelta",
)
async def get_lap_data(
    year: int = _YEAR,
    event_name: str = _EVENT_NAME,
    session_name: str = _SESSION,
    drivers: str = _DRIVERS_Q,
) -> LapsResponseDTO:
    """Devuelve las vueltas agrupadas por número de vuelta, listas para renderizar
    una tabla donde filas = vueltas y columnas = pilotos.

    El campo 'entries' de cada fila contiene un mapa piloto a datos,
    con None si el piloto no tiene registro para esa vuelta concreta.
    """
    try:
        session = await load_session_metadata(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sesión no encontrada: {e}")

    driver_list = [d.strip().upper() for d in drivers.split(",")]
    return build_laps_response(session, driver_list)


@router.get(
    "/api/analysis/{year}/{event_name}/{session_name}/summary",
    response_model=SummaryResponseDTO,
    summary="Estadísticas resumen por piloto",
)
async def get_summary_stats(
    year: int = _YEAR,
    event_name: str = _EVENT_NAME,
    session_name: str = _SESSION,
    drivers: str = _DRIVERS_Q,
) -> SummaryResponseDTO:
    """Devuelve estadísticas agregadas por piloto: mejor vuelta, media, mediana,
    desviación estándar, índice de consistencia, vueltas válidas y estrategia
    de neumáticos.

    Criterios de filtrado:
    - Conteo de vueltas: incluye VSC/SC/pit, excluye solo borradas y sin tiempo.
    - Estadísticas: excluye pit in/out (distorsionan unos 20-30s).
    - Consistencia: (1 - std/mean) * 100. Cuanto más alto, vueltas más uniformes.
    """
    try:
        session = await load_session_metadata(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sesión no encontrada: {e}")

    driver_list = [d.strip().upper() for d in drivers.split(",")]
    return build_summary_response(session, driver_list)


@router.get(
    "/api/analysis/{year}/{event_name}/{session_name}/stints",
    response_model=StintsResponseDTO,
    summary="Métricas estadísticas por stint",
)
async def get_stint_analysis(
    year: int = _YEAR,
    event_name: str = _EVENT_NAME,
    session_name: str = _SESSION,
    drivers: str = _DRIVERS_Q,
) -> StintsResponseDTO:
    """Devuelve las métricas estadísticas de cada stint para los pilotos seleccionados.

    La respuesta es simétrica: si el piloto A tiene 4 stints y el B tiene 3,
    el stint 4 aparece con datos del piloto A y None en el piloto B.
    """
    try:
        session = await load_session_metadata(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sesión no encontrada: {e}")

    driver_list = [d.strip().upper() for d in drivers.split(",")]
    return build_stints_response(session, driver_list)
