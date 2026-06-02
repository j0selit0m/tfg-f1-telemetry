"""
Templates de prompts para el módulo de análisis con IA.

Cada función recibe los datos ya estructurados desde el service
y devuelve el prompt completo listo para enviar a Gemini.
Se centraliza aquí para facilitar el ajuste de los prompts
sin tocar la lógica de negocio.
"""

from dtos.ai_dto import SummaryAnalysisRequest


def build_summary_prompt(request: SummaryAnalysisRequest) -> str:

    drivers_block = "\n".join(
        f"- {d.driver_code}: best lap {d.best_lap or 'N/A'} (lap #{d.best_lap_number or '?'}), "
        f"average {d.average or 'N/A'}, median {d.median or 'N/A'}, "
        f"std dev {d.std_dev or 'N/A'}, consistency {d.consistency:.1f}%, "
        f"{d.valid_laps} valid laps, strategy: {' → '.join(d.strategy)}"
        for d in request.drivers
    )

    return f"""You are a Formula 1 telemetry and race strategy engineer.
Analyze the following statistics from the {request.session_name} session
of the {request.event_name} Grand Prix ({request.year}).

DRIVER DATA:
{drivers_block}

INSTRUCTIONS:
Write a structured analysis strictly following this order:
1. Open with an introductory sentence mentioning the Grand Prix, year and session.
2. Compare each driver's best lap: who was faster and by how much.
3. Compare average pace (average and median): who sustained better race rhythm.
4. Interpret consistency: who was more regular and what it suggests.
5. Close with a concluding sentence about who dominated the session overall.

FORMAT:
- Respond in English.
- Between 100 and 150 words exactly.
- Two paragraphs: the first covers points 1, 2 and 3; the second covers 4 and 5.
- Plain text, no markdown, no bold, no headers.
- Always start with: "In the {request.session_name} of the {request.event_name} Grand Prix ({request.year}),"
"""
