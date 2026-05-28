"""
DTOs del dominio de telemetría.

Contratos de datos entre el endpoint de telemetría completa
y el cliente React (vista de Telemetría).
"""

from pydantic import BaseModel, Field


class TelemetryPointDTO(BaseModel):
    """Un punto de muestreo de telemetría (~240 ms entre muestras)."""

    distance: float = Field(
        ..., description="Distancia desde el inicio de la vuelta [m]"
    )
    speed: int = Field(..., description="Velocidad [km/h]")
    throttle: float = Field(..., description="Presión del acelerador [0-100 %]")
    brake: int = Field(..., description="Freno aplicado: 0 = no, 1 = sí")
    rpm: int = Field(..., description="Revoluciones del motor [rpm]")
    gear: int = Field(..., description="Marcha engranada [1-8]")
    drs: int = Field(
        ..., description="Estado DRS: 0/1 cerrado · 8 elegible · 10/12/14 abierto"
    )


class CornerDistanceDTO(BaseModel):
    """Información de una curva del circuito."""

    number: int = Field(..., description="Número de curva")
    letter: str = Field(
        ..., description="Letra identificadora (ej: 'a' en la curva 10a)"
    )
    distance: float = Field(
        ..., description="Distancia desde el inicio de la vuelta [m]"
    )


class DriverTelemetryDTO(BaseModel):
    """Telemetría completa de un piloto para una vuelta concreta."""

    key: str = Field(..., description="Identificador único: 'ALO:Race:44'")
    driver: str = Field(..., description="Código de 3 letras del piloto")
    session: str = Field(..., description="Nombre de la sesión: Race, Qualifying…")
    lap_number: int
    data: list[TelemetryPointDTO]


class TelemetryResponse(BaseModel):
    """Respuesta completa: curvas del circuito + telemetría de todos los pilotos."""

    corners: list[CornerDistanceDTO]
    drivers: list[DriverTelemetryDTO]
