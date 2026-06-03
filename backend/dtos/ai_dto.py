"""
DTOs del dominio de análisis con IA.

Contratos de datos entre el endpoint de análisis inteligente
y el cliente React. El request recibe los datos ya procesados
que el frontend tiene en estado; la response devuelve el texto
generado por Gemini.
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


# --- Laps Analysis Request ---


class LapDriverInput(BaseModel):
    """Datos objetivos de un piloto extraídos de la tabla de vueltas."""

    driver: str
    best_lap_time: str | None = Field(None, description="Mejor vuelta M:SS.mmm")
    best_lap_number: int | None = Field(None, description="Número de la mejor vuelta")
    pit_laps: list[int] = Field(
        default_factory=list, description="Vueltas donde entró a boxes"
    )
    sc_laps: list[int] = Field(
        default_factory=list, description="Vueltas bajo Safety Car (track_status 4)"
    )
    vsc_laps: list[int] = Field(
        default_factory=list, description="Vueltas bajo VSC (track_status 6)"
    )
    total_laps: int = Field(..., description="Total de vueltas completadas")
    start_position: int | None = Field(None, description="Posición en vuelta 1")
    end_position: int | None = Field(None, description="Posición en última vuelta")


class LapsAnalysisRequest(BaseModel):
    """Payload que envía el frontend con los datos objetivos de la vista de vueltas."""

    year: int
    event_name: str
    session_name: str
    drivers: list[LapDriverInput]
