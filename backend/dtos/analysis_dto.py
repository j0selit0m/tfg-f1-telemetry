"""
DTOs del dominio de análisis: vueltas, resumen y stints.

Contratos de datos entre los tres endpoints de análisis
y el cliente React (vistas de Análisis).
"""

from pydantic import BaseModel, Field


# ── Laps ──────────────────────────────────────────────────────────────────────


class LapDTO(BaseModel):
    """Datos de una vuelta individual de un piloto."""

    lap_time: str | None = Field(None, description="Tiempo total en formato M:SS.mmm")
    lap_time_seconds: float | None = Field(
        None, description="Tiempo en segundos para gráficas y ordenación"
    )
    is_fastest_lap: bool = Field(
        False, description="True solo en la vuelta más rápida del piloto"
    )
    sector1: str | None = Field(None, description="Sector 1 en formato SS.mmm")
    sector2: str | None = Field(None, description="Sector 2 en formato SS.mmm")
    sector3: str | None = Field(None, description="Sector 3 en formato SS.mmm")
    compound: str | None = Field(
        None, description="SOFT, MEDIUM, HARD, INTERMEDIATE, WET"
    )
    tyre_life: int | None = Field(None, description="Vueltas de vida del neumático")
    stint: int | None = Field(None, description="Número de stint")
    position: int | None = Field(
        None, description="Posición en pista al finalizar la vuelta"
    )
    track_status: str | None = Field(
        None, description="1=verde · 2=VSC · 4=SC · 5=roja"
    )
    is_personal_best: bool = Field(
        ...,
        description="Marcado por FastF1; usar is_fastest_lap para destacar una sola vuelta",
    )
    is_accurate: bool = Field(..., description="False si es in/out lap o hay SC/VSC")
    deleted: bool = Field(..., description="Vuelta eliminada por los comisarios")
    pit_in: bool = Field(..., description="El piloto entró a boxes en esta vuelta")
    pit_out: bool = Field(..., description="El piloto salió de boxes en esta vuelta")


class LapRowDTO(BaseModel):
    """Fila de la tabla: una vuelta con los datos de todos los pilotos seleccionados."""

    lap_number: int
    entries: dict[str, LapDTO | None] = Field(
        ...,
        description="Mapa abbreviation → LapDTO. None si el piloto no tiene dato para esa vuelta.",
    )


class LapsResponseDTO(BaseModel):
    """Respuesta pre-agrupada para renderizado directo en el frontend.

    'drivers' define el orden de las columnas; 'laps' define las filas.
    """

    drivers: list[str] = Field(
        ..., description="Abreviaturas en el mismo orden que el request"
    )
    laps: list[LapRowDTO]


# ── Summary ───────────────────────────────────────────────────────────────────


class BestLapDTO(BaseModel):
    """Mejor vuelta de un piloto en la sesión."""

    time: str | None = Field(None, description="Tiempo en formato M:SS.mmm")
    lap_number: int | None = Field(None, description="Número de la vuelta más rápida")


class StintCompoundDTO(BaseModel):
    """Compuesto usado en un stint, listo para renderizar como pill/chip."""

    compound: str = Field(..., description="SOFT, MEDIUM, HARD, INTERMEDIATE, WET")
    color: str = Field(..., description="Color HEX oficial F1 (dinámico por temporada)")
    label: str = Field(..., description="Letra corta: S, M, H, I, W")


class DriverSummaryDTO(BaseModel):
    """Estadísticas resumen de un piloto en una sesión."""

    best_lap: BestLapDTO
    average: str | None = Field(None, description="Media de tiempos válidos, M:SS.mmm")
    median: str | None = Field(None, description="Mediana de tiempos válidos, M:SS.mmm")
    std_dev: str | None = Field(None, description="Desviación estándar, SS.mmm")
    consistency: float = Field(
        ..., description="(1 - std/mean) * 100. 100 = vueltas idénticas"
    )
    valid_laps: int = Field(
        ..., description="Vueltas completadas no borradas (incluye VSC/SC)"
    )
    strategy: list[StintCompoundDTO] = Field(
        ..., description="Secuencia de compuestos por stint en orden"
    )


class SummaryResponseDTO(BaseModel):
    """Estructura coherente con el endpoint de vueltas: drivers + mapa de summaries."""

    drivers: list[str] = Field(..., description="Pilotos en el orden del request")
    summaries: dict[str, DriverSummaryDTO | None] = Field(
        ...,
        description="Mapa abbreviation → DriverSummaryDTO. None si el piloto no tiene datos válidos.",
    )


# ── Stints ────────────────────────────────────────────────────────────────────


class StintBestLapDTO(BaseModel):
    """Mejor vuelta dentro de un stint concreto."""

    time: str | None = Field(None, description="Tiempo en formato M:SS.mmm")
    lap_in_stint: int | None = Field(
        None, description="Posición de la vuelta dentro del stint"
    )


class StintDriverDTO(BaseModel):
    """Métricas de un piloto para un stint concreto."""

    compound: str = Field(..., description="SOFT, MEDIUM, HARD, INTERMEDIATE, WET")
    compound_color: str = Field(
        ..., description="Color HEX oficial F1 de esa temporada"
    )
    compound_label: str = Field(..., description="Letra corta: S, M, H, I, W")
    duration_laps: int = Field(..., description="Total de vueltas del stint")
    duration_time: str | None = Field(
        None, description="Tiempo total del stint en M:SS.mmm"
    )
    best_lap: StintBestLapDTO | None = Field(None, description="Mejor vuelta del stint")
    average: str | None = Field(
        None, description="Media de tiempos válidos en M:SS.mmm"
    )
    median: str | None = Field(
        None, description="Mediana de tiempos válidos en M:SS.mmm"
    )
    std_dev: str | None = Field(None, description="Desviación estándar en SS.mmm")
    consistency: float | None = Field(None, description="(1 - std/mean) * 100")


class StintEntryDTO(BaseModel):
    """Un stint con los datos de todos los pilotos seleccionados."""

    stint_number: int
    drivers: dict[str, StintDriverDTO | None] = Field(
        ...,
        description="Mapa abbreviation → StintDriverDTO. None si el piloto no tiene ese stint.",
    )


class StintsResponseDTO(BaseModel):
    """Estructura consistente con el resto de endpoints de análisis."""

    drivers: list[str] = Field(..., description="Pilotos en el orden del request")
    stints: list[StintEntryDTO]
