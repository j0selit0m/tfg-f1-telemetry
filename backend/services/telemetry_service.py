"""
Lógica de negocio del dominio de telemetría.

Función pública principal:
    build_telemetry_response() → TelemetryResponse
"""

import pandas as pd
import fastf1

from dtos.telemetry_dto import (
    TelemetryPointDTO,
    CornerDistanceDTO,
    DriverTelemetryDTO,
    TelemetryResponse,
)


# ── Helpers privados ──────────────────────────────────────────────────────────


def _build_telemetry_point(row: pd.Series) -> TelemetryPointDTO:
    """Serializa una fila del DataFrame de car_data al DTO."""
    return TelemetryPointDTO(
        distance=round(float(row["Distance"]), 1),
        speed=int(row["Speed"]),
        throttle=round(float(row["Throttle"]), 1),
        brake=int(bool(row["Brake"])),
        rpm=int(row["RPM"]),
        gear=int(row["nGear"]),
        drs=int(row["DRS"]),
    )


def _get_lap(
    session: fastf1.core.Session, driver: str, lap_number: int | None
) -> pd.Series | None:
    """Devuelve la vuelta solicitada o la más rápida del piloto. None si no existe."""
    driver_laps = session.laps.pick_drivers(driver)
    if lap_number is not None:
        lap = driver_laps.pick_laps(lap_number)
        return lap.iloc[0] if not lap.empty else None
    return driver_laps.pick_fastest(only_by_time=True)


# ── Funciones públicas ────────────────────────────────────────────────────────


def parse_drivers(drivers_param: str) -> list[dict]:
    """Convierte el query param 'drivers' en una lista de configuraciones.

    Formatos aceptados:
        ALO:Race:44  → piloto, sesión y vuelta específica
        ALO:Race     → piloto y sesión; usará la vuelta más rápida

    Args:
        drivers_param: String crudo del query param, ej: "ALO:Race:44,SAI:Race:44".

    Returns:
        Lista de dicts con claves 'driver', 'session' y 'lap' (int o None).

    Raises:
        ValueError: Si alguna entrada no respeta el formato mínimo PILOTO:SESION.
    """
    configs = []
    for entry in drivers_param.split(","):
        parts = entry.strip().split(":")
        if len(parts) < 2:
            raise ValueError(
                f"Formato inválido: '{entry}'. Usa PILOTO:SESION o PILOTO:SESION:VUELTA"
            )
        configs.append(
            {
                "driver": parts[0].strip().upper(),
                "session": parts[1].strip(),
                "lap": int(parts[2].strip()) if len(parts) == 3 else None,
            }
        )
    return configs


def build_corners(session: fastf1.core.Session) -> list[CornerDistanceDTO]:
    """Extrae la información de curvas del circuito a partir de la sesión.

    Args:
        session: Sesión de FastF1 ya cargada.

    Returns:
        Lista de CornerDistanceDTO ordenada por distancia.
    """
    circuit_info = session.get_circuit_info()
    return [
        CornerDistanceDTO(
            number=int(row["Number"]),
            letter=str(row["Letter"]).strip() if pd.notna(row["Letter"]) else "",
            distance=round(float(row["Distance"]), 1),
        )
        for _, row in circuit_info.corners.iterrows()
    ]


def build_telemetry_response(
    driver_configs: list[dict],
    sessions: dict[str, fastf1.core.Session],
) -> TelemetryResponse:
    """Construye la respuesta completa de telemetría para todos los pilotos.

    Args:
        driver_configs: Lista producida por parse_drivers().
        sessions:       Mapa session_name → Session ya cargada con telemetría.

    Returns:
        TelemetryResponse con curvas del circuito y datos de cada piloto.
    """
    first_session = next(iter(sessions.values()))
    corners = build_corners(first_session)

    drivers_data: list[DriverTelemetryDTO] = []
    for config in driver_configs:
        driver_abbr = config["driver"]
        session = sessions[config["session"]]
        lap = _get_lap(session, driver_abbr, config["lap"])

        if lap is None:
            continue

        car_data = lap.get_car_data().add_distance()
        lap_number = int(lap["LapNumber"])

        drivers_data.append(
            DriverTelemetryDTO(
                key=f"{driver_abbr}:{config['session']}:{lap_number}",
                driver=driver_abbr,
                session=config["session"],
                lap_number=lap_number,
                data=[_build_telemetry_point(row) for _, row in car_data.iterrows()],
            )
        )

    return TelemetryResponse(corners=corners, drivers=drivers_data)
