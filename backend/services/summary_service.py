"""
Lógica de negocio del dominio de estadísticas resumen.

Función pública principal:
    build_summary_response()  -> SummaryResponseDTO
"""

import pandas as pd
import fastf1

from config import COMPOUND_LABELS
from core.compounds import get_compound_color
from dtos.analysis_dto import (
    BestLapDTO,
    StintCompoundDTO,
    DriverSummaryDTO,
    SummaryResponseDTO,
)
from utils.formatting import format_timedelta


# --- Helpers privados ---


def _build_strategy(
    driver_laps: pd.DataFrame,
    session: fastf1.core.Session,
) -> list[StintCompoundDTO]:
    """Construye la secuencia de compuestos por stint con colores oficiales.

    Toma el compuesto de la primera vuelta del stint en lugar del modo
    estadístico: FastF1 puede registrar un compuesto distinto en vueltas
    de transición y la primera vuelta es siempre la fuente de verdad.
    """
    strategy: list[StintCompoundDTO] = []
    stint_groups = driver_laps.dropna(subset=["Stint", "Compound"]).groupby(
        "Stint", sort=True
    )
    for _, stint_laps in stint_groups:
        compound = str(stint_laps["Compound"].iloc[0]).upper()
        strategy.append(
            StintCompoundDTO(
                compound=compound,
                color=get_compound_color(compound, session),
                label=COMPOUND_LABELS.get(compound, "?"),
            )
        )
    return strategy


def _build_driver_summary(
    driver_laps: pd.DataFrame,
    session: fastf1.core.Session,
) -> DriverSummaryDTO | None:
    """Calcula todas las estadísticas para un piloto. None si no hay datos válidos.

    Aplica dos filtros distintos según el caso:
      - Conteo de vueltas: incluye VSC/SC/pit. Solo se descartan vueltas sin
        tiempo o borradas por los comisarios.
      - Estadísticas: excluye además pit in/out con pick_wo_box(), ya que
        incluyen ~20-30s del pit stop y distorsionarían las métricas.
        Las vueltas bajo VSC/SC se mantienen por ser representativas del coche.
    """
    if driver_laps.empty:
        return None

    valid_for_count = driver_laps[
        driver_laps["LapTime"].notna() & ~driver_laps["Deleted"].eq(True)
    ]

    laps_for_stats = driver_laps.pick_wo_box()
    laps_for_stats = laps_for_stats[
        laps_for_stats["LapTime"].notna() & ~laps_for_stats["Deleted"].eq(True)
    ]

    if laps_for_stats.empty:
        return None

    lap_times_s = laps_for_stats["LapTime"].dt.total_seconds()
    mean_s = lap_times_s.mean()
    std_s = lap_times_s.std()  # ddof=1 (estimación muestral)

    # only_by_time=True ignora IsPersonalBest y busca el mínimo puro,
    # evitando que una vuelta marcada como PB pero luego borrada interfiera.
    best_lap = laps_for_stats.pick_fastest(only_by_time=True)
    if best_lap is None:
        return None

    consistency = (
        round((1 - std_s / mean_s) * 100, 2)
        if mean_s > 0 and pd.notna(std_s)
        else 100.0  # con una sola vuelta no hay dispersión -> consistencia perfecta
    )
    return DriverSummaryDTO(
        best_lap=BestLapDTO(
            time=format_timedelta(best_lap["LapTime"]),
            lap_number=int(best_lap["LapNumber"])
            if pd.notna(best_lap["LapNumber"])
            else None,
        ),
        average=format_timedelta(pd.to_timedelta(mean_s, unit="s")),
        median=format_timedelta(pd.to_timedelta(lap_times_s.median(), unit="s")),
        std_dev=format_timedelta(pd.to_timedelta(std_s, unit="s")),
        consistency=float(consistency),
        valid_laps=int(len(valid_for_count)),
        strategy=_build_strategy(driver_laps, session),
    )


# --- Función pública ---


def build_summary_response(
    session: fastf1.core.Session,
    driver_list: list[str],
) -> SummaryResponseDTO:
    """Calcula las estadísticas resumen para todos los pilotos solicitados.

    Args:
        session:     Sesión de FastF1 con vueltas cargadas (sin telemetría).
        driver_list: Lista de abreviaturas en el orden del request.

    Returns:
        SummaryResponseDTO con None para los pilotos sin datos válidos.
    """
    all_laps = session.laps.pick_drivers(driver_list)

    summaries: dict[str, DriverSummaryDTO | None] = {}
    for driver_abbr in driver_list:
        driver_laps = all_laps[all_laps["Driver"] == driver_abbr].copy()
        summaries[driver_abbr] = _build_driver_summary(driver_laps, session)

    return SummaryResponseDTO(drivers=driver_list, summaries=summaries)
