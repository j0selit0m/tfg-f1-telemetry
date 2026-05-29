"""
Router de filtros de sesión (SidebarFilter del frontend).

Endpoints:
    GET /api/schedule/{year}                                   → calendario
    GET /api/schedule/{year}/{event_name}/sessions             → sesiones del GP
    GET /api/session/{year}/{event_name}/{session_name}/drivers → pilotos y colores
"""

import asyncio

import fastf1
import fastf1.plotting
import pandas as pd
from fastapi import APIRouter, HTTPException, Path

from config import COMPOUNDS, MAX_YEAR, MIN_YEAR
from core.compounds import get_compound_color
from core.session_loader import load_session_metadata
from dtos.schedule_dto import DriverDTO, DriversResponseDTO, EventDTO, SessionDTO
from utils.formatting import lighten_color, normalize_hex

router = APIRouter(tags=["Filtros"])


# ── Helper privado ────────────────────────────────────────────────────────────


def _build_driver_list(session: fastf1.core.Session) -> list[DriverDTO]:
    """Construye la lista de pilotos con sus colores para las gráficas.

    Cuando dos pilotos comparten equipo, el segundo recibe una versión
    aclarada del color de equipo para poder diferenciarlos visualmente.
    """
    drivers: list[DriverDTO] = []
    seen_teams: set[str] = set()

    for _, info in session.results.iterrows():
        team_color = normalize_hex(info.get("TeamColor", ""))

        try:
            driver_color = fastf1.plotting.get_driver_color(
                info["Abbreviation"], session
            )
        except Exception:
            driver_color = f"#{team_color}"

        team_name = str(info["TeamName"])
        if team_name in seen_teams:
            driver_color = lighten_color(driver_color)
        else:
            seen_teams.add(team_name)

        drivers.append(
            DriverDTO(
                driver_number=str(info["DriverNumber"]),
                abbreviation=str(info["Abbreviation"]),
                full_name=str(info["FullName"]),
                team_name=team_name,
                team_color=f"#{team_color}",
                driver_color=driver_color,
            )
        )

    return sorted(drivers, key=lambda d: d.abbreviation)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get(
    "/api/schedule/{year}",
    response_model=list[EventDTO],
    summary="Calendario de una temporada",
)
async def get_schedule(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
) -> list[EventDTO]:
    """Devuelve todos los Grandes Premios de una temporada.

    FastF1 es síncrono, por lo que se delega en un thread pool
    para no bloquear el event loop de FastAPI.
    """
    try:
        schedule = await asyncio.to_thread(fastf1.get_event_schedule, year)
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"No se pudo obtener el calendario de FastF1: {e}"
        )

    return [
        EventDTO(
            round_number=int(row["RoundNumber"]),
            event_name=str(row["EventName"]),
            country=str(row["Country"]),
        )
        for _, row in schedule.iterrows()
        if int(row["RoundNumber"]) > 0 # Solo GPs oficiales, no sesiones de pretemporada
    ]


@router.get(
    "/api/schedule/{year}/{event_name}/sessions",
    response_model=list[SessionDTO],
    summary="Sesiones de un Gran Premio",
)
async def get_sessions(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
) -> list[SessionDTO]:
    """Devuelve las sesiones disponibles para un Gran Premio específico.

    Detecta dinámicamente las claves 'SessionN' del objeto Event de FastF1,
    garantizando compatibilidad con formatos no estándar (Sprint, Sprint Shootout).
    """
    try:
        event = await asyncio.to_thread(fastf1.get_event, year, event_name)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Gran Premio '{event_name}' ({year}) no encontrado: {e}",
        )

    session_keys = [
        k for k in event.index if k.startswith("Session") and k[-1].isdigit()
    ]

    return [
        SessionDTO(
            id=str(event.get(key)),
            date=event.get(f"{key}Date").isoformat()
            if pd.notna(event.get(f"{key}Date"))
            else None,
        )
        for key in session_keys
        if pd.notna(event.get(key))
    ]


@router.get(
    "/api/session/{year}/{event_name}/{session_name}/drivers",
    response_model=DriversResponseDTO,
    summary="Pilotos y colores de compuestos de una sesión",
)
async def get_drivers(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
    session_name: str = Path(
        ..., description="Tipo de sesión: R, Q, FP1, FP2, FP3, S, SS"
    ),
) -> DriversResponseDTO:
    """Devuelve los pilotos de una sesión con sus colores para las gráficas."""
    try:
        session = await load_session_metadata(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Sesión '{session_name}' de '{event_name}' ({year}) no encontrada: {e}",
        )

    compounds: dict[str, str] = {
        compound: get_compound_color(compound, session) for compound in COMPOUNDS
    }

    return DriversResponseDTO(
        drivers=_build_driver_list(session),
        compounds=compounds,
    )
