"""
Caché en memoria de sesiones de FastF1.

Expone dos loaders con sus propias cachés independientes:

    load_session_metadata()       -> sin telemetría  (~1-3 s)
    load_session_with_telemetry() -> con telemetría   (~3-8 s)

Mantener dos cachés separadas evita que una petición al endpoint de análisis
(que no necesita telemetría) fuerce la carga pesada, y al revés: si primero
se cargó la sesión ligera, el endpoint de telemetría carga la versión completa
sin reutilizar la incompleta.
"""

import asyncio
import fastf1

# --- Cachés independientes por tipo de carga ---

# Clave: "{year}_{event_name}_{session_name}"
_metadata_cache: dict[str, fastf1.core.Session] = {}
_telemetry_cache: dict[str, fastf1.core.Session] = {}


# --- Loaders ---


async def load_session_metadata(
    year: int, event_name: str, session_name: str
) -> fastf1.core.Session:
    """Carga una sesión sin telemetría ni datos de tiempo/clima.

    Usada por los endpoints de schedule (drivers) y analysis (laps, summary, stints).
    Al omitir telemetría, el tiempo de carga se reduce considerablemente.

    Args:
        year:         Temporada F1.
        event_name:   Nombre del Gran Premio.
        session_name: Tipo de sesión (Race, Qualifying, FP1…).

    Returns:
        Sesión de FastF1 con vueltas y resultados cargados.

    Raises:
        Exception: Propagada desde FastF1 si la sesión no existe.
    """
    key = f"{year}_{event_name}_{session_name}"
    if key not in _metadata_cache:
        session = fastf1.get_session(year, event_name, session_name)
        await asyncio.to_thread(
            session.load, telemetry=False, weather=False, messages=False
        )
        _metadata_cache[key] = session
    return _metadata_cache[key]


async def load_session_with_telemetry(
    year: int, event_name: str, session_name: str
) -> fastf1.core.Session:
    """Carga una sesión con telemetría completa de coche.

    Usada exclusivamente por el endpoint de telemetría. La carga incluye
    todos los canales (velocidad, acelerador, freno, RPM, marcha, DRS)
    necesarios para get_car_data().add_distance().

    Args:
        year:         Temporada F1.
        event_name:   Nombre del Gran Premio.
        session_name: Tipo de sesión (Race, Qualifying, FP1…).

    Returns:
        Sesión de FastF1 con telemetría de coche cargada.

    Raises:
        Exception: Propagada desde FastF1 si la sesión no existe.
    """
    key = f"{year}_{event_name}_{session_name}"
    if key not in _telemetry_cache:
        session = fastf1.get_session(year, event_name, session_name)
        await asyncio.to_thread(
            session.load, telemetry=True, weather=False, messages=False
        )
        _telemetry_cache[key] = session
    return _telemetry_cache[key]
