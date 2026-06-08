"""
DTOs del dominio de sesión: calendario, sesiones y pilotos.

Contratos de datos entre los endpoints de filtrado (schedule router)
y el cliente React (SidebarFilter).
"""

from pydantic import BaseModel, Field


class EventDTO(BaseModel):
    """Gran Premio del calendario de una temporada."""

    round_number: int = Field(..., description="Número de ronda en la temporada")
    event_name: str = Field(..., description="Nombre oficial del Gran Premio")
    country: str = Field(..., description="País del circuito")


class SessionDTO(BaseModel):
    """Sesión disponible dentro de un Gran Premio."""

    id: str = Field(..., description="Identificador: R, Q, FP1, FP2, FP3, S, SS")
    date: str | None = Field(None, description="Fecha en formato ISO 8601")


class DriverDTO(BaseModel):
    """Piloto con sus colores de equipo para las visualizaciones del frontend."""

    driver_number: str
    abbreviation: str
    full_name: str
    team_name: str
    team_color: str = Field(..., description="Color primario del equipo en HEX")
    driver_color: str = Field(..., description="Color diferenciado por piloto en HEX")


class DriversResponseDTO(BaseModel):
    """Pilotos y colores de compuestos de una sesión."""

    drivers: list[DriverDTO]
    compounds: dict[str, str] = Field(
        ..., description="Mapa compuesto -> color HEX oficial F1"
    )
