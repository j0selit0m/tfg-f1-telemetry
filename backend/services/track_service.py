"""
Lógica de negocio del dominio de mapa de circuito.

Función pública principal:
    build_track_response() → TrackMapResponse

Metodología de microsectores
-----------------------------
El trazado se divide en N_SECTORS tramos usando RelativeDistance (0.0-1.0),
la distancia normalizada sobre el total de la vuelta que provee FastF1.
Los 25 límites de sector caen en 0/25, 1/25, ..., 25/25 para ambos pilotos,
independientemente de la longitud absoluta del circuito.

Para cada tramo se calcula el tiempo de travesía de cada piloto por
interpolación lineal sobre la telemetría fusionada (car_data + pos_data).
El piloto con menor tiempo en un tramo gana ese microsector.
"""

import numpy as np
import pandas as pd
import fastf1

from dtos.track_dto import (
    CornerPositionDTO,
    DriverLapInfoDTO,
    MicrosectorPointDTO,
    SectorTimeDTO,
    TrackMapResponse,
)

N_SECTORS = 25  # número de microsectores fijo para todos los circuitos
_N_POINTS = 300  # puntos de renderizado SVG (independiente de N_SECTORS)


# --- Helpers privados ---


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
    """Carga y limpia la telemetría fusionada (car_data + pos_data) de una vuelta.

    Devuelve None si el circuito no tiene datos de posición GPS ese año.
    RelativeDistance debe ser estrictamente creciente para que np.interp sea válido.
    """
    try:
        tel = lap.get_telemetry()
    except Exception:
        return None

    required = ["X", "Y", "Distance", "RelativeDistance"]
    tel = tel.dropna(subset=required).copy()
    if tel.empty:
        return None

    tel = tel.sort_values("RelativeDistance").drop_duplicates(
        subset=["RelativeDistance"]
    )
    return tel.reset_index(drop=True)


def _interp_time_rel(tel: pd.DataFrame, rel_distances: np.ndarray) -> np.ndarray:
    """Interpola el tiempo transcurrido [s] en los puntos de distancia relativa dados."""
    return np.interp(
        rel_distances,
        tel["RelativeDistance"].values,
        tel["Time"].dt.total_seconds().values,
    )


def _interp_xy(
    tel: pd.DataFrame, rel_distances: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Interpola las coordenadas X/Y en los puntos de distancia relativa dados."""
    rel = tel["RelativeDistance"].values
    return (
        np.interp(rel_distances, rel, tel["X"].values),
        np.interp(rel_distances, rel, tel["Y"].values),
    )


def _compute_sectors(
    tels: list[pd.DataFrame],
) -> tuple[np.ndarray, np.ndarray]:
    """Calcula los tiempos de travesía y el piloto más rápido en cada microsector.

    Divide [0.0, 1.0] en N_SECTORS tramos iguales usando RelativeDistance.
    Los límites son exactamente 0/25, 1/25, ..., 25/25 para todos los pilotos,
    lo que garantiza una comparación en los mismos puntos proporcionales del trazado.

    Args:
        tels: Telemetría limpia de cada piloto.

    Returns:
        sector_times       shape (n_drivers, N_SECTORS) en segundos.
        fastest_per_sector shape (N_SECTORS,) con el índice del piloto ganador.
    """
    boundaries = np.linspace(0.0, 1.0, N_SECTORS + 1)
    sector_times = np.zeros((len(tels), N_SECTORS))

    for j, tel in enumerate(tels):
        t_at_boundaries = _interp_time_rel(tel, boundaries)
        sector_times[j] = t_at_boundaries[1:] - t_at_boundaries[:-1]

    fastest_per_sector = np.argmin(sector_times, axis=0)
    return sector_times, fastest_per_sector


def _build_corners(
    session: fastf1.core.Session, rotation: float
) -> list[CornerPositionDTO]:
    """Extrae las curvas del circuito y aplica la rotación oficial."""
    try:
        corners = session.get_circuit_info().corners
    except Exception:
        return []

    x_rot, y_rot = _apply_rotation(
        corners["X"].values.astype(float),
        corners["Y"].values.astype(float),
        rotation,
    )

    return [
        CornerPositionDTO(
            number=int(row["Number"]),
            letter=str(row["Letter"]).strip() if pd.notna(row["Letter"]) else "",
            x=round(float(x_rot[i]), 2),
            y=round(float(y_rot[i]), 2),
            angle=round(float(row["Angle"]), 2),
        )
        for i, (_, row) in enumerate(corners.iterrows())
    ]


# --- Función pública ---


def build_track_response(
    driver_configs: list[dict],
    session: fastf1.core.Session,
) -> TrackMapResponse:
    """Construye la comparativa de microsectores para N pilotos de la misma sesión.

    El trazado se divide en N_SECTORS = 25 tramos iguales usando RelativeDistance
    (0.0-1.0).

    Args:
        driver_configs: Lista producida por parse_drivers(). Todos deben ser
                        de la misma sesión (validado en el router).
        session:        Sesión de FastF1 ya cargada con telemetría.

    Returns:
        TrackMapResponse con trazado, microsectores coloreados, tiempos por
        sector para el tooltip y posiciones de curvas.

    Raises:
        ValueError: Si algún piloto no tiene vuelta válida o datos GPS.
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

    sector_times, fastest_per_sector = _compute_sectors(tels)

    # Puntos de renderizado SVG distribuidos uniformemente en [0.0, 1.0]
    rel_distances = np.linspace(0.0, 1.0, _N_POINTS)
    sector_width = 1.0 / N_SECTORS

    x_raw, y_raw = _interp_xy(tels[0], rel_distances)
    x_rot, y_rot = _apply_rotation(x_raw, y_raw, rotation)

    points = [
        MicrosectorPointDTO(
            x=round(float(x_rot[i]), 2),
            y=round(float(y_rot[i]), 2),
            distance=round(float(rel_distances[i]), 4),
            fastest=codes[
                int(
                    fastest_per_sector[
                        min(int(rel_distances[i] / sector_width), N_SECTORS - 1)
                    ]
                )
            ],
        )
        for i in range(_N_POINTS)
    ]

    sectors = [
        SectorTimeDTO(
            sector_number=s + 1,
            fastest=codes[int(fastest_per_sector[s])],
            times={
                codes[j]: round(float(sector_times[j, s] * 1000), 1)
                for j in range(len(codes))
            },
        )
        for s in range(N_SECTORS)
    ]

    return TrackMapResponse(
        session=driver_configs[0]["session"],
        drivers=[
            DriverLapInfoDTO(driver=codes[j], lap_number=int(laps[j]["LapNumber"]))
            for j in range(len(codes))
        ],
        points=points,
        sectors=sectors,
        corners=_build_corners(session, rotation),
    )
