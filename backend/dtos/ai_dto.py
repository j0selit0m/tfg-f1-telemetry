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
