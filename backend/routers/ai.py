"""
Router de análisis con IA.

Endpoints:
    POST /api/ai/summary-analysis → análisis inteligente de estadísticas de sesión
"""

from fastapi import APIRouter, HTTPException

from dtos.ai_dto import AiAnalysisResponse, SummaryAnalysisRequest
from services.ai_service import build_summary_analysis

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
