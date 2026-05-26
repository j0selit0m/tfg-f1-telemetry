"""
DTOs del dominio de mapa de circuito.

Contratos de datos entre el endpoint de track map
y el cliente React (vista de Track Map).
"""

from pydantic import BaseModel, Field


class MicrosectorPoint(BaseModel):
    """Un punto del trazado con el piloto más rápido en su microsector."""

    x: float = Field(..., description="Coordenada X rotada [m]")
    y: float = Field(..., description="Coordenada Y rotada [m]")
    distance: float = Field(..., description="Distancia desde el inicio de vuelta [m]")
    fastest: str = Field(
        ..., description="Abreviatura del piloto más rápido en este microsector"
    )


class DriverLapInfo(BaseModel):
    """Metadatos de la vuelta usada para cada piloto."""

    driver: str = Field(..., description="Código de 3 letras del piloto")
    lap_number: int = Field(..., description="Número de vuelta efectivamente usado")


class TrackMapResponse(BaseModel):
    """Respuesta completa: trazado del circuito con microsectores coloreados."""

    session: str
    drivers: list[DriverLapInfo]
    points: list[MicrosectorPoint]
