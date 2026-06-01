"""
Lógica de negocio del dominio de análisis de stints.

Función pública principal:
    build_stints_response() → StintsResponseDTO
"""

import pandas as pd
import fastf1

from config import COMPOUND_LABELS
from core.compounds import get_compound_color
from dtos.analysis_dto import (
    StintBestLapDTO,
    StintDriverDTO,
    StintEntryDTO,
    StintsResponseDTO,
)
from utils.formatting import format_timedelta


# --- Helper privado ---


def _build_stint_driver(
    stint_laps: pd.DataFrame,
    compound: str,
    session: fastf1.core.Session,
) -> StintDriverDTO:
    """Calcula las métricas de un piloto para un stint concreto.

    Las pit in/out NO se excluyen con pick_wo_box() porque stint_laps
    ya está filtrado por stint: las vueltas de transición pertenecen a
    stints distintos. Sí se excluyen vueltas borradas y sin tiempo registrado.

    La posición de la mejor vuelta dentro del stint se calcula sobre
    stint_laps completo (no solo las válidas) para que "Vuelta 6" signifique
    la 6ª vuelta del stint aunque alguna haya sido filtrada de las stats.
    """
    valid_times = stint_laps["LapTime"].dropna()
    total_duration = valid_times.sum() if not valid_times.empty else None

    laps_for_stats = stint_laps[
        stint_laps["LapTime"].notna() & ~stint_laps["Deleted"].eq(True)
    ]

    base = dict(
        compound=compound,
        compound_color=get_compound_color(compound, session),
        compound_label=COMPOUND_LABELS.get(compound, "?"),
        duration_laps=int(len(stint_laps)),
        duration_time=format_timedelta(total_duration),
    )

    if laps_for_stats.empty:
        return StintDriverDTO(
            **base,
            best_lap=None,
            average=None,
            median=None,
            std_dev=None,
            consistency=None,
        )

    lap_times_s = laps_for_stats["LapTime"].dt.total_seconds()
    mean_s = lap_times_s.mean()
    std_s = lap_times_s.std()  # ddof=1 (estimación muestral)
    best_lap = laps_for_stats.pick_fastest(only_by_time=True)

    lap_in_stint = (
        int((stint_laps["LapNumber"] <= int(best_lap["LapNumber"])).sum())
        if pd.notna(best_lap["LapNumber"])
        else None
    )

    consistency = (
        round((1 - std_s / mean_s) * 100, 1)
        if mean_s > 0 and pd.notna(std_s)
        else 100.0  # con una sola vuelta no hay dispersión -> consistencia perfecta
    )

    return StintDriverDTO(
        **base,
        best_lap=StintBestLapDTO(
            time=format_timedelta(best_lap["LapTime"]),
            lap_in_stint=lap_in_stint,
        ),
        average=format_timedelta(pd.to_timedelta(mean_s, unit="s")),
        median=format_timedelta(pd.to_timedelta(lap_times_s.median(), unit="s")),
        std_dev=format_timedelta(pd.to_timedelta(std_s, unit="s")),
        consistency=float(consistency) if consistency is not None else None,
    )


# --- Función pública ---


def build_stints_response(
    session: fastf1.core.Session,
    driver_list: list[str],
) -> StintsResponseDTO:
    """Agrupa las vueltas por stint y calcula métricas para cada piloto.

    La respuesta es simétrica: si el piloto A tiene 4 stints y el B tiene 3,
    el stint 4 aparece con datos del piloto A y None en el piloto B.

    Args:
        session:     Sesión de FastF1 con vueltas cargadas (sin telemetría).
        driver_list: Lista de abreviaturas en el orden del request.

    Returns:
        StintsResponseDTO con todos los stints encontrados entre los pilotos.
    """
    all_laps = session.laps.pick_drivers(driver_list)

    all_stint_numbers = sorted(
        int(s) for s in all_laps.dropna(subset=["Stint"])["Stint"].unique()
    )

    stints: list[StintEntryDTO] = []

    for stint_num in all_stint_numbers:
        drivers_data: dict[str, StintDriverDTO | None] = {}

        for driver_abbr in driver_list:
            stint_laps = (
                all_laps[
                    (all_laps["Driver"] == driver_abbr)
                    & (all_laps["Stint"] == stint_num)
                ]
                .copy()
                .sort_values("LapNumber")
                .reset_index(drop=True)
            )

            if stint_laps.empty:
                drivers_data[driver_abbr] = None
                continue

            compound = str(stint_laps["Compound"].iloc[0]).upper()
            drivers_data[driver_abbr] = _build_stint_driver(
                stint_laps, compound, session
            )

        stints.append(StintEntryDTO(stint_number=stint_num, drivers=drivers_data))

    return StintsResponseDTO(drivers=driver_list, stints=stints)
