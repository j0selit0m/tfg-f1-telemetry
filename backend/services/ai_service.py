"""
Lógica de negocio del módulo de análisis con IA.

Funciones públicas:
    build_summary_analysis() → AiAnalysisResponse
    build_stints_analysis()  → AiAnalysisResponse
    build_laps_analysis()    → AiAnalysisResponse
"""

from core.ai_prompts import build_summary_prompt, build_stints_prompt, build_laps_prompt
from core.gemini_client import generate_content
from dtos.ai_dto import (
    AiAnalysisResponse,
    LapsAnalysisRequest,
    SummaryAnalysisRequest,
    StintsAnalysisRequest,
)


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


async def build_stints_analysis(
    request: StintsAnalysisRequest,
) -> AiAnalysisResponse:
    """Genera un análisis textual de las métricas de stints de sesión.

    Args:
        request: Datos de stints enviados por el frontend.

    Returns:
        AiAnalysisResponse con el texto del análisis.
    """
    prompt = build_stints_prompt(request)
    analysis_text = await generate_content(prompt)
    return AiAnalysisResponse(analysis=analysis_text)


async def build_laps_analysis(
    request: LapsAnalysisRequest,
) -> AiAnalysisResponse:
    """Genera una narrativa de carrera a partir de los datos objetivos de vueltas.

    Combina los datos extraídos por el frontend con el conocimiento de Gemini
    sobre el evento para explicar al usuario lo que ocurrió en la sesión.

    Args:
        request: Datos objetivos de vueltas enviados por el frontend.

    Returns:
        AiAnalysisResponse con el texto narrativo del análisis.
    """
    prompt = build_laps_prompt(request)
    analysis_text = await generate_content(prompt)
    return AiAnalysisResponse(analysis=analysis_text)
