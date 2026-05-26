"""
Lógica de negocio del dominio de mapa de circuito.

Función pública principal:
    build_track_response() → TrackMapResponse
"""

import numpy as np
import pandas as pd
import fastf1

from dtos.track_dto import DriverLapInfo, MicrosectorPoint, TrackMapResponse

_N_POINTS = 300  # puntos de renderizado SVG (independiente del nº de sectores)


# ── Helpers privados ──────────────────────────────────────────────────────────


def _get_rotation(session: fastf1.core.Session) -> float:
    """Devuelve el ángulo de rotación del circuito en grados (0.0 si no disponible)."""
    try:
        return float(session.get_circuit_info().rotation)
    except Exception:
        return 0.0


def _apply_rotation(
    x: np.ndarray, y: np.ndarray, angle_deg: float
) -> tuple[np.ndarray, np.ndarray]:
    """Aplica una rotación 2D a los vectores X/Y."""
    angle_rad = np.radians(angle_deg)
    cos_a, sin_a = np.cos(angle_rad), np.sin(angle_rad)
    return x * cos_a - y * sin_a, x * sin_a + y * cos_a


def _get_lap(
    session: fastf1.core.Session, driver: str, lap_number: int | None
) -> pd.Series | None:
    """Devuelve la vuelta solicitada o la más rápida del piloto. None si no existe."""
    driver_laps = session.laps.pick_drivers(driver)
    if lap_number is not None:
        lap = driver_laps.pick_laps(lap_number)
        return lap.iloc[0] if not lap.empty else None
    return driver_laps.pick_fastest(only_by_time=True)


def _prepare_telemetry(lap: pd.Series) -> pd.DataFrame | None:
    """Carga la telemetría fusionada con posición GPS y la limpia.

    Usa get_telemetry() que ya fusiona car_data + pos_data internamente.
    Devuelve None si el circuito no tiene datos GPS ese año.
    """
    try:
        tel = lap.get_telemetry()
    except Exception:
        return None

    tel = tel.dropna(subset=["X", "Y", "Distance"]).copy()
    if tel.empty:
        return None

    # Distance debe ser estrictamente creciente para np.interp
    tel = tel.sort_values("Distance").drop_duplicates(subset=["Distance"])
    return tel.reset_index(drop=True)


def _interp_time(tel: pd.DataFrame, distances: np.ndarray) -> np.ndarray:
    """Interpola el tiempo transcurrido [s] en los puntos de distancia dados."""
    return np.interp(
        distances,
        tel["Distance"].values,
        tel["Time"].dt.total_seconds().values,
    )


def _interp_xy(
    tel: pd.DataFrame, distances: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Interpola las coordenadas X/Y en los puntos de distancia dados."""
    dist = tel["Distance"].values
    return (
        np.interp(distances, dist, tel["X"].values),
        np.interp(distances, dist, tel["Y"].values),
    )


def _compute_sector_winners(
    tels: list[pd.DataFrame],
    d_min: float,
    d_max: float,
    n_sectors: int,
) -> np.ndarray:
    """Devuelve el índice del piloto más rápido en cada sector.

    Para cada sector calcula el tiempo de travesía de cada piloto
    (tiempo en la frontera de salida − tiempo en la frontera de entrada)
    y devuelve el índice del menor.

    Args:
        tels:      Lista de DataFrames de telemetría, uno por piloto.
        d_min:     Distancia de inicio del rango común.
        d_max:     Distancia de fin del rango común.
        n_sectors: Número de sectores en que dividir el trazado.

    Returns:
        Array de shape (n_sectors,) con el índice del piloto ganador en cada sector.
    """
    boundaries = np.linspace(d_min, d_max, n_sectors + 1)
    sector_times = np.zeros((len(tels), n_sectors))
    for j, tel in enumerate(tels):
        t_boundaries = _interp_time(tel, boundaries)
        sector_times[j] = t_boundaries[1:] - t_boundaries[:-1]
    return np.argmin(sector_times, axis=0)


# ── Función pública ───────────────────────────────────────────────────────────


def build_track_response(
    driver_configs: list[dict],
    session: fastf1.core.Session,
    n_sectors: int = 25,
) -> TrackMapResponse:
    """Construye la comparativa de microsectores para N pilotos de la misma sesión.

    Args:
        driver_configs: Lista producida por parse_drivers(). Todos deben ser
                        de la misma sesión (validado en el router).
        session:        Sesión de FastF1 ya cargada con telemetría.
        n_sectors:      Número de sectores en que dividir el trazado (default 25).

    Returns:
        TrackMapResponse con el trazado y el piloto más rápido en cada sector.

    Raises:
        ValueError: Si algún piloto no tiene vuelta o datos GPS válidos.
    """
    rotation = _get_rotation(session)

    tels: list[pd.DataFrame] = []
    laps: list[pd.Series] = []
    codes: list[str] = []

    for cfg in driver_configs:
        lap = _get_lap(session, cfg["driver"], cfg["lap"])
        if lap is None:
            raise ValueError(f"No se encontró vuelta para {cfg['driver']}")

        tel = _prepare_telemetry(lap)
        if tel is None:
            raise ValueError(f"Sin datos de posición GPS para {cfg['driver']}")

        tels.append(tel)
        laps.append(lap)
        codes.append(cfg["driver"])

    # Rango de distancia común a todos los pilotos
    d_min = max(t["Distance"].iloc[0] for t in tels)
    d_max = min(t["Distance"].iloc[-1] for t in tels)

    fastest_per_sector = _compute_sector_winners(tels, d_min, d_max, n_sectors)

    distances = np.linspace(d_min, d_max, _N_POINTS)
    sector_width = (d_max - d_min) / n_sectors

    x_raw, y_raw = _interp_xy(tels[0], distances)
    x_rot, y_rot = _apply_rotation(x_raw, y_raw, rotation)

    points = []
    for i in range(_N_POINTS):
        sector_idx = min(int((distances[i] - d_min) / sector_width), n_sectors - 1)
        points.append(
            MicrosectorPoint(
                x=round(float(x_rot[i]), 2),
                y=round(float(y_rot[i]), 2),
                distance=round(float(distances[i]), 1),
                fastest=codes[int(fastest_per_sector[sector_idx])],
            )
        )

    return TrackMapResponse(
        session=driver_configs[0]["session"],
        drivers=[
            DriverLapInfo(driver=codes[j], lap_number=int(laps[j]["LapNumber"]))
            for j in range(len(codes))
        ],
        points=points,
    )
