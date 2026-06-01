"""
Constantes globales de la aplicación.

Centraliza los parámetros de configuración que comparten todas las capas
(routers, services, core). Las rutas y orígenes CORS son configurables vía
variables de entorno (ver .env.example).

Actualizar MAX_YEAR al inicio de cada temporada.
"""

import os

# Rango de temporadas soportadas

MIN_YEAR: int = 2020
MAX_YEAR: int = 2026  # actualizar al inicio de cada nueva temporada

#  Compuestos de neumáticos

COMPOUNDS: list[str] = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]

# Letra corta por compuesto, usada en los DTOs de stints y summary.
COMPOUND_LABELS: dict[str, str] = {
    "SOFT": "S",
    "MEDIUM": "M",
    "HARD": "H",
    "INTERMEDIATE": "I",
    "WET": "W",
}

# Colores de fallback cuando FastF1 no puede resolver el color de un compuesto.
COMPOUND_FALLBACK_COLORS: dict[str, str] = {
    "SOFT": "#da291c",
    "MEDIUM": "#ffd600",
    "HARD": "#f0f0ec",
    "INTERMEDIATE": "#39b54a",
    "WET": "#0067ff",
}

# ---- Rutas de caché de FastF1 ---
#
# Configurables vía variables de entorno (.env). Si no se definen, se usan los
# valores por defecto. La selección entre HDD y local se hace dinámicamente en
# core/cache_config.py según disponibilidad.

CACHE_HDD_PATH: str = os.getenv("FASTF1_CACHE_HDD_PATH", "E:\\TFG_F1_Cache")
CACHE_LOCAL_PATH: str = os.getenv("FASTF1_CACHE_LOCAL_PATH", "fastf1_cache_local")

# ---- CORS ----
#
# Orígenes permitidos para peticiones cross-origin desde el frontend.
# Separados por comas en la variable de entorno CORS_ORIGINS.

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
