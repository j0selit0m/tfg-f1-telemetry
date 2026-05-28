"""
Lógica de negocio del dominio de vueltas.

Función pública principal:
    build_laps_response() → LapsResponseDTO
"""

import pandas as pd
import fastf1

from dtos.analysis_dto import LapDTO, LapRowDTO, LapsResponseDTO
from utils.formatting import format_timedelta


# ── Helpers privados ──────────────────────────────────────────────────────────


def _build_lap_dto(lap: pd.Series) -> LapDTO:
    """Serializa una fila del DataFrame de FastF1 al DTO de vuelta.

    Realiza casting explícito a tipos primitivos Python para evitar que los
    tipos nativos de NumPy (int64, bool_) rompan el serializador JSON de FastAPI.
    """
    total_s = lap["LapTime"].total_seconds() if pd.notna(lap["LapTime"]) else None
    return LapDTO(
        lap_time=format_timedelta(lap["LapTime"]),
        lap_time_seconds=round(total_s, 3) if total_s is not None else None,
        is_fastest_lap=False,  # se sobreescribe en build_laps_response
        sector1=format_timedelta(lap["Sector1Time"]),
        sector2=format_timedelta(lap["Sector2Time"]),
        sector3=format_timedelta(lap["Sector3Time"]),
        compound=str(lap["Compound"]) if pd.notna(lap["Compound"]) else None,
        tyre_life=int(lap["TyreLife"]) if pd.notna(lap["TyreLife"]) else None,
        stint=int(lap["Stint"]) if pd.notna(lap["Stint"]) else None,
        position=int(lap["Position"]) if pd.notna(lap["Position"]) else None,
        track_status=str(lap["TrackStatus"]) if pd.notna(lap["TrackStatus"]) else None,
        is_personal_best=bool(lap["IsPersonalBest"]),
        is_accurate=bool(lap["IsAccurate"]),
        deleted=bool(lap["Deleted"]),
        pit_in=pd.notna(lap["PitInTime"]),
        pit_out=pd.notna(lap["PitOutTime"]),
    )


# ── Función pública ───────────────────────────────────────────────────────────


def build_laps_response(
    session: fastf1.core.Session,
    driver_list: list[str],
) -> LapsResponseDTO:
    """Agrupa las vueltas por número de vuelta y construye la respuesta.

    La respuesta es simétrica: si un piloto no tiene dato para una vuelta
    concreta, su valor es None en lugar de omitirse, lo que permite al
    frontend renderizar la tabla directamente sin transformaciones.

    Args:
        session:     Sesión de FastF1 con vueltas cargadas (sin telemetría).
        driver_list: Lista de abreviaturas en el orden del request.

    Returns:
        LapsResponseDTO con filas ordenadas por número de vuelta.
    """
    laps = session.laps.pick_drivers(driver_list)

    # Agrupamos por número de vuelta: {lap_number: {driver: LapDTO}}
    grouped: dict[int, dict[str, LapDTO]] = {}
    for _, lap in laps.iterrows():
        if pd.isna(lap["LapNumber"]):
            continue
        lap_number = int(lap["LapNumber"])
        driver = str(lap["Driver"])
        if lap_number not in grouped:
            grouped[lap_number] = {}
        grouped[lap_number][driver] = _build_lap_dto(lap)

    # Marcamos is_fastest_lap=True en la vuelta más rápida de cada piloto
    for driver in driver_list:
        fastest = laps.pick_drivers(driver).pick_fastest(only_by_time=True)
        if fastest is not None and pd.notna(fastest["LapNumber"]):
            lap_num = int(fastest["LapNumber"])
            if lap_num in grouped and driver in grouped[lap_num]:
                grouped[lap_num][driver].is_fastest_lap = True

    lap_rows = [
        LapRowDTO(
            lap_number=lap_num,
            entries={driver: grouped[lap_num].get(driver) for driver in driver_list},
        )
        for lap_num in sorted(grouped)
    ]

    return LapsResponseDTO(drivers=driver_list, laps=lap_rows)
