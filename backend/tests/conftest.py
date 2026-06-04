"""
Fixtures compartidos para la suite de tests del backend de PitWall.

Proporciona mocks reutilizables de FastF1 y Gemini para evitar
llamadas reales a la API o a la caché de datos.
"""

import pandas as pd
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# App cliente
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def client():
    """Cliente HTTP de FastAPI para tests de integración.

    Se crea una sola vez por sesión de tests para reutilizar
    la instancia de la app sin reiniciarla en cada test.
    """
    from main import app

    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Mock de calendario FastF1
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_schedule_df():
    """DataFrame que simula el calendario devuelto por fastf1.get_event_schedule."""
    return pd.DataFrame(
        {
            "RoundNumber": [0, 1, 2],
            "EventName": [
                "Pre-Season Testing",
                "Bahrain Grand Prix",
                "Saudi Arabian Grand Prix",
            ],
            "Country": ["Bahrain", "Bahrain", "Saudi Arabia"],
        }
    )


# ---------------------------------------------------------------------------
# Mock de evento FastF1
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_event():
    """Series que simula el objeto evento devuelto por fastf1.get_event."""
    return pd.Series(
        {
            "EventName": "Bahrain Grand Prix",
            "Country": "Bahrain",
            "Session1": "Practice 1",
            "Session1Date": pd.Timestamp("2023-03-03"),
            "Session2": "Practice 2",
            "Session2Date": pd.Timestamp("2023-03-04"),
            "Session3": "Practice 3",
            "Session3Date": pd.Timestamp("2023-03-04"),
            "Session4": "Qualifying",
            "Session4Date": pd.Timestamp("2023-03-04"),
            "Session5": "Race",
            "Session5Date": pd.Timestamp("2023-03-05"),
        }
    )


# ---------------------------------------------------------------------------
# Mock de sesión FastF1 para pilotos
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_session_with_drivers():
    """Sesión FastF1 simulada con results DataFrame para el endpoint de drivers."""
    session = MagicMock()
    session.results = pd.DataFrame(
        {
            "DriverNumber": ["44", "63"],
            "Abbreviation": ["HAM", "RUS"],
            "FullName": ["Lewis Hamilton", "George Russell"],
            "TeamName": ["Mercedes", "Mercedes"],
            "TeamColor": ["00D2BE", "00D2BE"],
        }
    )
    return session
