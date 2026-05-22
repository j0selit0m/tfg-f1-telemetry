"""
Resolución de colores de compuestos de neumáticos.

Centraliza el acceso a fastf1.plotting.get_compound_color con un fallback
a los colores hardcodeados de config.py, evitando duplicar este patrón
en cada service que lo necesite.
"""

import fastf1
import fastf1.plotting

from config import COMPOUND_FALLBACK_COLORS


def get_compound_color(compound: str, session: fastf1.core.Session) -> str:
    """Devuelve el color HEX oficial de un compuesto para una sesión dada.

    FastF1 gestiona los colores por temporada (Pirelli los cambia cada año),
    por lo que siempre se consulta primero la API. El fallback hardcodeado
    solo actúa si FastF1 lanza una excepción (compuesto desconocido, etc.).

    Args:
        compound: Nombre del compuesto en mayúsculas (SOFT, MEDIUM, HARD…).
        session:  Sesión de FastF1 ya cargada (necesaria para el contexto de año).

    Returns:
        Color en formato HEX con '#'.
    """
    try:
        return fastf1.plotting.get_compound_color(compound, session)
    except Exception:
        return COMPOUND_FALLBACK_COLORS.get(compound, "#888888")
