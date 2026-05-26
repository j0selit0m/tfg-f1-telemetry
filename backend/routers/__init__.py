# schedule: endpoints de calendario, sesiones y pilotos (SidebarFilter)
from .schedule import router as schedule_router

# telemetry: endpoint de telemetría completa de coche
from .telemetry import router as telemetry_router

# analysis: endpoints de vueltas, resumen estadístico y stints
from .analysis import router as analysis_router

# track: endpoint de mapa de circuito con telemetría posicional
from .track import router as track_router

__all__ = ["schedule_router", "telemetry_router", "analysis_router", "track_router"]
