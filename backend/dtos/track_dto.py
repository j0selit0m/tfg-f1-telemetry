"""
DTOs del dominio de mapa de circuito.

Contratos de datos entre el endpoint de track map
y el cliente React (vista de Track Map).
"""

from pydantic import BaseModel, Field


class MicrosectorPointDTO(BaseModel):
    """Un punto del trazado con el piloto más rápido en su microsector."""

    x: float = Field(..., description="Coordenada X rotada [m]")
    y: float = Field(..., description="Coordenada Y rotada [m]")
    distance: float = Field(..., description="Distancia desde el inicio de vuelta [m]")
    fastest: str = Field(
        ..., description="Abreviatura del piloto más rápido en este microsector"
    )


class SectorTimeDTO(BaseModel):
    """Tiempos de travesía de cada piloto en un microsector."""

    sector_number: int = Field(..., description="Número de sector (1-based)")
    fastest: str = Field(..., description="Abreviatura del piloto más rápido")
    times: dict[str, float] = Field(
        ..., description="Tiempo de travesía por piloto en milisegundos"
    )


class CornerPositionDTO(BaseModel):
    """Posición de una curva del circuito, con rotación ya aplicada."""

    number: int = Field(..., description="Número de curva")
    letter: str = Field(..., description="Letra identificadora (ej: 'a' en curva 10a)")
    x: float = Field(..., description="Coordenada X rotada [m]")
    y: float = Field(..., description="Coordenada Y rotada [m]")
    angle: float = Field(
        ..., description="Ángulo hacia el exterior de la curva [grados]"
    )


class DriverLapInfoDTO(BaseModel):
    """Metadatos de la vuelta usada para cada piloto."""

    driver: str = Field(..., description="Código de 3 letras del piloto")
    lap_number: int = Field(..., description="Número de vuelta efectivamente usado")


class TrackMapResponse(BaseModel):
    """Respuesta completa: trazado del circuito con microsectores coloreados."""

    session: str
    drivers: list[DriverLapInfoDTO]
    points: list[MicrosectorPointDTO]
    sectors: list[SectorTimeDTO]
    corners: list[CornerPositionDTO]
