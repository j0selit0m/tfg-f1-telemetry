"""
Utilidades de formato compartidas por todas las capas del backend.

Todas las funciones son puras (sin efectos secundarios) y trabajan
sobre tipos estándar de Python y Pandas.
"""

import pandas as pd


def format_timedelta(td) -> str | None:
    """Convierte un Timedelta de Pandas a string legible M:SS.mmm o SS.mmm.

    Resuelve la incompatibilidad de serialización JSON de los objetos Timedelta
    y delega el formateo al backend para no cargar al cliente React.

    Args:
        td: Timedelta de Pandas o cualquier valor evaluable como NaT/NaN.

    Returns:
        String formateado, o None si el valor es nulo.

    Examples:
        >>> format_timedelta(pd.to_timedelta(93.456, unit="s"))
        '1:33.456'
        >>> format_timedelta(pd.to_timedelta(9.100, unit="s"))
        '9.100'
    """
    if pd.isna(td):
        return None
    total_seconds = td.total_seconds()
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds * 1000) % 1000)
    if minutes > 0:
        return f"{minutes}:{seconds:02d}.{milliseconds:03d}"
    return f"{seconds}.{milliseconds:03d}"


def normalize_hex(raw: str, fallback: str = "ffffff") -> str:
    """Normaliza y valida un color HEX recibido de FastF1.

    FastF1 puede devolver valores vacíos, 'nan' o sin el prefijo '#'.

    Args:
        raw: Cadena de color tal como la devuelve FastF1.
        fallback: Color de sustitución cuando raw es inválido.

    Returns:
        Color normalizado sin '#', en minúsculas.

    Examples:
        >>> normalize_hex("E8002D")
        'e8002d'
        >>> normalize_hex("nan")
        'ffffff'
    """
    color = str(raw).strip().lower()
    return color if color and color != "nan" else fallback


def lighten_color(hex_color: str, factor: float = 0.4) -> str:
    """Aclara un color HEX mezclándolo con blanco.

    Usado para diferenciar visualmente a los compañeros de equipo en las
    gráficas, ya que comparten el mismo color base de equipo.

    Args:
        hex_color: Color en formato HEX, con o sin '#'.
        factor: Intensidad del aclarado (0.0 = sin cambio, 1.0 = blanco puro).

    Returns:
        Color aclarado en formato HEX con '#'.

    Examples:
        >>> lighten_color("#E8002D", factor=0.4)
        '#ef6685'
    """
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    r = int(r + (255 - r) * factor)
    g = int(g + (255 - g) * factor)
    b = int(b + (255 - b) * factor)
    return f"#{r:02x}{g:02x}{b:02x}"
