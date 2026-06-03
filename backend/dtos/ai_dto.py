"""
DTOs del dominio de análisis con IA.

Contratos de datos entre los endpoints de análisis inteligente
y el cliente React. Cada request contiene los datos que el usuario
ve en pantalla; la response devuelve el texto generado por Gemini.
"""

from pydantic import BaseModel, Field


# --- Request ---


class DriverSummaryInput(BaseModel):
    """Estadísticas de un piloto tal como las muestra la vista de resumen."""

    driver_code: str = Field(..., description="Abreviatura de 3 letras: ALO, VER…")
    best_lap: str | None = Field(None, description="Mejor vuelta en formato M:SS.mmm")
    best_lap_number: int | None = Field(
        None, description="Número de la vuelta más rápida"
    )
    average: str | None = Field(None, description="Media de tiempos válidos")
    median: str | None = Field(None, description="Mediana de tiempos válidos")
    std_dev: str | None = Field(None, description="Desviación estándar")
    consistency: float = Field(..., description="Índice de consistencia (0-100)")
    valid_laps: int = Field(..., description="Vueltas completadas no borradas")
    strategy: list[str] = Field(
        ..., description="Secuencia de compuestos por stint: ['S','M','H']"
    )


class SummaryAnalysisRequest(BaseModel):
    """Payload que envía el frontend con todos los datos visibles en pantalla."""

    year: int
    event_name: str = Field(..., description="Nombre del Gran Premio")
    session_name: str = Field(..., description="Race, Qualifying, FP1…")
    drivers: list[DriverSummaryInput]
    driver_names: dict[str, str] = Field(default_factory=dict)


# --- Response ---


class AiAnalysisResponse(BaseModel):
    """Respuesta unificada para cualquier análisis con IA."""

    analysis: str = Field(..., description="Texto del análisis generado por Gemini")


# --- Stints Analysis Request ---


class StintDriverInput(BaseModel):
    """Métricas clave de un piloto en un stint concreto."""

    compound_label: str = Field(..., description="S, M, H, I, W")
    duration_laps: int
    best_lap: str | None = Field(None, description="Mejor vuelta del stint M:SS.mmm")
    average: str | None = Field(None, description="Media de tiempos válidos M:SS.mmm")
    consistency: float | None = Field(None, description="(1 - std/mean) * 100")


class StintEntryInput(BaseModel):
    """Un stint con los datos de todos los pilotos."""

    stint_number: int
    drivers: dict[str, StintDriverInput | None]


class StintsAnalysisRequest(BaseModel):
    """Payload que envía el frontend con los datos de la vista de stints."""

    year: int
    event_name: str
    session_name: str
    drivers: list[str]
    stints: list[StintEntryInput]
    driver_names: dict[str, str] = Field(default_factory=dict)


# --- Laps Analysis Request ---


class LapEntryInput(BaseModel):
    """Datos de una vuelta individual de un piloto."""

    lap_time: str | None = None
    sector1: str | None = None
    sector2: str | None = None
    sector3: str | None = None
    compound: str | None = None
    tyre_life: int | None = None
    position: int | None = None
    track_status: str | None = None
    pit_in: bool = False
    pit_out: bool = False
    is_fastest_lap: bool = False


class LapRowInput(BaseModel):
    """Una vuelta con los datos de todos los pilotos."""

    lap_number: int
    entries: dict[str, LapEntryInput | None]


class LapsAnalysisRequest(BaseModel):
    """Payload que envía el frontend con los datos vuelta a vuelta de la sesión."""

    year: int
    event_name: str
    session_name: str
    drivers: list[str]
    laps: list[LapRowInput]
    driver_names: dict[str, str] = Field(default_factory=dict)
