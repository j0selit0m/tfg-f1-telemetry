"""
Lógica de negocio del módulo de análisis con IA.

Función pública principal:
    build_summary_analysis() → AiAnalysisResponse
"""

from core.ai_prompts import build_summary_prompt
from core.gemini_client import generate_content
from dtos.ai_dto import AiAnalysisResponse, SummaryAnalysisRequest


async def build_summary_analysis(
    request: SummaryAnalysisRequest,
) -> AiAnalysisResponse:
    """Genera un análisis textual de las estadísticas de resumen de sesión.

    Construye el prompt con los datos del request, lo envía a Gemini
    y empaqueta la respuesta en el DTO de salida.

    Args:
        request: Datos de resumen enviados por el frontend.

    Returns:
        AiAnalysisResponse con el texto del análisis.

    Raises:
        RuntimeError: Propagada desde gemini_client si la API falla.
    """
    prompt = build_summary_prompt(request)
    analysis_text = await generate_content(prompt)
    return AiAnalysisResponse(analysis=analysis_text)
