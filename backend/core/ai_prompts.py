"""
Templates de prompts para el módulo de análisis con IA.

Cada función recibe los datos ya estructurados desde el service
y devuelve el prompt completo listo para enviar a Gemini.
Se centraliza aquí para facilitar el ajuste de los prompts
sin tocar la lógica de negocio.
"""

from dtos.ai_dto import (
    SummaryAnalysisRequest,
    StintsAnalysisRequest,
    LapsAnalysisRequest,
)


# --- Helpers privados ---


def _session_context(session_name: str) -> str:
    """Clasifica el tipo de sesión para adaptar las instrucciones del prompt."""
    if session_name in ("Race", "Sprint"):
        return "race"
    if session_name == "Qualifying":
        return "qualifying"
    return "practice"


# --- Rol unificado ---

_ROLE = """You are a clear and educational Formula 1 analyst explaining a session
to someone who enjoys watching races but may not be familiar with all the
technical details. Your goal is to make the data easy to understand,
not to be dramatic or use complex jargon.

Important rules:
- Do not mention weather or track conditions based on assumptions.
  However, if the tyre compounds data includes Intermediate (I) or Wet (W)
  tyres, you may infer that rain or wet conditions were present.
- Never assert something as fact if you are not certain — use phrases like
  "this may suggest", "it appears" or "possibly" when inferring.
- Explain technical terms briefly the first time you use them,
  but do not repeat the same explanation later in the response."""


# --- Prompts públicos ---


def build_summary_prompt(request: SummaryAnalysisRequest) -> str:
    """Construye el prompt para analizar las estadísticas de resumen de sesión."""
    session_type = _session_context(request.session_name)

    drivers_block = "\n".join(
        f"- {d.driver_code}: personal best lap {d.best_lap or 'N/A'} (lap #{d.best_lap_number or '?'}), "
        f"average {d.average or 'N/A'}, median {d.median or 'N/A'}, "
        f"std dev {d.std_dev or 'N/A'}, consistency {d.consistency:.1f}%, "
        f"{d.valid_laps} valid laps, compounds used: {' → '.join(d.strategy)}"
        for d in request.drivers
    )

    if session_type == "race":
        instructions = """
1. Start with the Grand Prix name, year and that this is a race summary.
2. Compare each driver's personal best lap — their fastest individual lap
   during the race, not necessarily the official fastest lap of the race.
3. Compare average and median pace. Explain that the average is the typical
   lap time across the race, while the median is less affected by slow laps
   like pit stop laps or safety car periods.
4. Explain consistency and standard deviation in plain language: consistency
   shows how similar a driver's laps were to each other. High consistency
   means very regular lap times, which usually indicates good tyre management.
   A lower consistency can suggest incidents, traffic or tyre degradation.
5. Comment on the tyre compounds used.
6. Close with a clear verdict on who had the stronger overall race."""

    elif session_type == "qualifying":
        instructions = """
1. Start with the Grand Prix name, year and that this is a qualifying summary.
2. Compare personal best lap times — in qualifying this is the definitive
   performance metric that determines grid position.
3. Explain that average and median here reflect how consistent the driver
   was across multiple flying laps during the session.
4. Explain consistency: in qualifying, high consistency means the driver
   was able to extract maximum performance repeatedly from the car.
5. Comment on tyre compounds — in qualifying these indicate which tyre
   the driver relied on for their fastest attempt.
6. Close with a verdict on who delivered the stronger qualifying performance."""

    else:
        instructions = """
1. Start with the Grand Prix name, year and which practice session this is.
2. Note that in practice, lap times are less representative than in qualifying
   or the race — teams are often testing different setups or tyre compounds.
3. Compare best laps and average pace with that context in mind.
4. Explain consistency as an indicator of how well each driver adapted
   to the car in this session.
5. Comment on tyre compounds — in practice, trying different compounds
   usually means the team is collecting data for race strategy decisions.
6. Close with what the data suggests about each driver's preparation."""

    return f"""{_ROLE}

Analyze the following {request.session_name} statistics from the
{request.event_name} {request.year}:

DRIVER DATA:
{drivers_block}

INSTRUCTIONS:
{instructions}

FORMAT:
- Respond in English.
- Around 100 words. Be clear and concise.
- Two short paragraphs.
- Plain text, no markdown, no bold, no headers.
- Always start with: "The {request.year} {request.event_name} {request.session_name}"
"""


def build_stints_prompt(request: StintsAnalysisRequest) -> str:
    """Construye el prompt para analizar las métricas de stints de sesión."""
    session_type = _session_context(request.session_name)

    stints_block = ""
    total_laps_per_driver = {code: 0 for code in request.drivers}

    for stint in request.stints:
        stints_block += f"\nStint {stint.stint_number}:\n"
        for code in request.drivers:
            d = stint.drivers.get(code)
            if d is None:
                stints_block += f"  - {code}: no data\n"
            else:
                total_laps_per_driver[code] += d.duration_laps
                stints_block += (
                    f"  - {code}: compound {d.compound_label}, "
                    f"{d.duration_laps} laps, "
                    f"personal best lap in stint {d.best_lap or 'N/A'}, "
                    f"average {d.average or 'N/A'}, "
                    f"consistency {f'{d.consistency:.1f}%' if d.consistency is not None else 'N/A'}\n"
                )

    laps_summary = ", ".join(
        f"{code}: {laps} laps total" for code, laps in total_laps_per_driver.items()
    )

    if session_type == "race":
        instructions = """
1. Start with the Grand Prix name, year and session type.
2. Compare total laps completed by each driver. If one driver completed
   significantly fewer laps or stints than the other, suggest — without
   asserting it as fact — that they may have retired or had an incident.
3. Compare tyre strategies: which compounds were chosen and for how many laps.
   If one driver's tyres lasted noticeably more laps on the same compound,
   explain what that might suggest about pace or tyre management.
   A stint is a continuous period on the same set of tyres between pit stops.
4. Compare pace within each stint: who was faster and more consistent.
5. Close with a clear verdict on whose strategy appeared more effective."""

    elif session_type == "qualifying":
        instructions = """
1. Start with the Grand Prix name, year and qualifying session.
2. In qualifying, each stint represents a run on track on a set of tyres.
   Compare how many runs each driver completed and which compounds they used.
3. Identify which run produced the best lap for each driver.
4. Comment on consistency within each run.
5. Close with who made better use of their qualifying runs."""

    else:
        instructions = """
1. Start with the Grand Prix name, year and practice session.
2. In practice, different tyre compounds indicate teams evaluating
   race strategy options. Explain this briefly.
3. Comment on stint lengths: longer stints suggest race pace evaluation,
   shorter stints suggest setup or qualifying simulation work.
4. Compare pace and consistency across stints.
5. Close with what the stint data suggests about each driver's preparation."""

    return f"""{_ROLE}

Analyze the following {request.session_name} stint data from the
{request.event_name} {request.year}:

TOTAL LAPS COMPLETED: {laps_summary}

STINT DATA:
{stints_block}

INSTRUCTIONS:
{instructions}

FORMAT:
- Respond in English.
- Around 150 words. Be clear and educational.
- Two or three short paragraphs.
- Plain text, no markdown, no bold, no headers.
- Always start with: "The {request.year} {request.event_name} {request.session_name}"
"""


def build_laps_prompt(request: LapsAnalysisRequest) -> str:
    session_type = _session_context(request.session_name)

    # Construye el bloque de datos vuelta a vuelta.
    laps_block = ""
    for row in request.laps:
        laps_block += f"\nLap {row.lap_number}:\n"
        for code in request.drivers:
            entry = row.entries.get(code)
            if entry is None:
                continue
            flags = []
            if entry.pit_in:
                flags.append("PIT IN")
            if entry.pit_out:
                flags.append("PIT OUT")
            if entry.is_fastest_lap:
                flags.append("FASTEST LAP")
            status = {
                "1": "clear",
                "2": "yellow",
                "4": "SC",
                "6": "VSC",
            }.get(entry.track_status or "1", entry.track_status or "")
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            laps_block += (
                f"  {code}: {entry.lap_time or 'N/A'} "
                f"S1={entry.sector1 or '?'} S2={entry.sector2 or '?'} S3={entry.sector3 or '?'} "
                f"P{entry.position or '?'} {entry.compound or '?'}/L{entry.tyre_life or '?'} "
                f"[{status}]{flag_str}\n"
            )

    return f"""{_ROLE}

Analyze the following {request.session_name} lap-by-lap data from the
{request.event_name} {request.year}.

LAP DATA:
{laps_block}

INSTRUCTIONS:
Using ALL the lap data above AND your knowledge of this specific event:
1. Start with the Grand Prix name, year and circuit name.
2. Walk through the key moments: position changes, pit stops, SC/VSC periods,
   pace evolution across the race.
3. Comment on sector times if there are notable differences between drivers.
4. If a driver completed significantly fewer laps, suggest they may have retired.
5. Close with a summary of what happened for these drivers.

FORMAT:
- Respond in English.
- Around 250 words. Be clear and educational.
- CRITICAL: Only analyze the drivers present in the data above. Do not mention or infer information about any other drivers not included in this dataset.
- Three paragraphs with natural flow.
- Plain text, no markdown, no bold, no headers.
- Always start with: "The {request.year} {request.event_name} {request.session_name}"
"""
