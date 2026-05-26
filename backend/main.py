"""
TFG Formula 1 API — Entry point.

Responsabilidades de este módulo:
    1. Inicializar la caché de FastF1.
    2. Crear la instancia de FastAPI con su metadata.
    3. Registrar el middleware CORS.
    4. Incluir los routers de cada dominio.

Toda la lógica de negocio reside en services/, la validación de parámetros
en routers/ y los contratos de datos en dtos/.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from core.cache_config import setup_cache
from routers import analysis_router, schedule_router, telemetry_router, track_router

# ── Caché de FastF1 ───────────────────────────────────────────────────────────
# Se inicializa al arrancar el servidor, antes de registrar ninguna ruta.

setup_cache()

# ── Aplicación ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="TFG Formula 1 API",
    description="Backend de análisis de telemetría F1.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Autoriza el tráfico del cliente React local (puerto 5173).

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(schedule_router)
app.include_router(telemetry_router)
app.include_router(analysis_router)
app.include_router(track_router)
