"""
Router de análisis con IA.

Endpoints:
    POST /api/ai/summary-analysis  → análisis de estadísticas de resumen
    POST /api/ai/stints-analysis   → análisis de métricas de stints
    POST /api/ai/laps-analysis     → análisis narrativo de datos de vueltas
"""

from fastapi import APIRouter, HTTPException

from dtos.ai_dto import (
    AiAnalysisResponse,
    SummaryAnalysisRequest,
    StintsAnalysisRequest,
    LapsAnalysisRequest,
)
from services.ai_service import (
    build_summary_analysis,
    build_stints_analysis,
    build_laps_analysis,
)

router = APIRouter(prefix="/api/ai", tags=["Análisis IA"])


@router.post(
    "/summary-analysis",
    response_model=AiAnalysisResponse,
    summary="Análisis IA de las estadísticas de resumen de sesión",
)
async def post_summary_analysis(
    request: SummaryAnalysisRequest,
) -> AiAnalysisResponse:
    """Recibe los datos de resumen que el usuario ve en pantalla y devuelve
    un análisis generado por Gemini explicando el rendimiento comparado
    de los pilotos seleccionados.

    El frontend envía los datos que ya tiene en estado, sin necesidad
    de que el backend recalcule nada.
    """
    if not request.drivers:
        raise HTTPException(
            status_code=422, detail="Se necesita al menos un piloto para el análisis."
        )

    try:
        return await build_summary_analysis(request)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"Error de Gemini: {e}")


@router.post(
    "/stints-analysis",
    response_model=AiAnalysisResponse,
    summary="Análisis IA de las métricas de stints de sesión",
)
async def post_stints_analysis(
    request: StintsAnalysisRequest,
) -> AiAnalysisResponse:
    """Recibe los datos de stints que el usuario ve en pantalla y devuelve
    un análisis generado por Gemini comparando estrategias y ritmo por stint.
    """
    if not request.drivers:
        raise HTTPException(
            status_code=422, detail="Se necesita al menos un piloto para el análisis."
        )

    try:
        return await build_stints_analysis(request)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"Error de Gemini: {e}")


@router.post(
    "/laps-analysis",
    response_model=AiAnalysisResponse,
    summary="Análisis IA narrativo de los datos de vueltas",
)
async def post_laps_analysis(
    request: LapsAnalysisRequest,
) -> AiAnalysisResponse:
    """Recibe los datos objetivos de la tabla de vueltas y devuelve una narrativa
    de carrera generada por Gemini, combinando los datos con su conocimiento
    del evento para explicar al usuario lo que ocurrió en la sesión.
    """
    if not request.drivers:
        raise HTTPException(
            status_code=422, detail="Se necesita al menos un piloto para el análisis."
        )

    try:
        return await build_laps_analysis(request)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"Error de Gemini: {e}")
