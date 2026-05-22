"""
Constantes globales de la aplicación.

Centraliza los parámetros de configuración que comparten todas las capas
(routers, services, core). Actualizar MAX_YEAR al inicio de cada temporada.
"""

# ── Rango de temporadas soportadas ────────────────────────────────────────────

MIN_YEAR: int = 2018
MAX_YEAR: int = 2026  # ⬅ actualizar al inicio de cada nueva temporada

# ── Compuestos de neumáticos ──────────────────────────────────────────────────

COMPOUNDS: list[str] = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]

# Letra corta por compuesto, usada en los DTOs de stints y summary.
COMPOUND_LABELS: dict[str, str] = {
    "SOFT":         "S",
    "MEDIUM":       "M",
    "HARD":         "H",
    "INTERMEDIATE": "I",
    "WET":          "W",
}

# Colores de fallback cuando FastF1 no puede resolver el color de un compuesto.
COMPOUND_FALLBACK_COLORS: dict[str, str] = {
    "SOFT":         "#da291c",
    "MEDIUM":       "#ffd600",
    "HARD":         "#f0f0ec",
    "INTERMEDIATE": "#39b54a",
    "WET":          "#0067ff",
}

# ── Rutas de caché de FastF1 ──────────────────────────────────────────────────

# Ruta preferida (HDD externo). Si no está disponible, se usa la local.
CACHE_HDD_PATH: str  = "E:\\TFG_F1_Cache"
CACHE_LOCAL_PATH: str = "fastf1_cache_local"