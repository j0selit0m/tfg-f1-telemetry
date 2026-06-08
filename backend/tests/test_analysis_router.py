"""
Tests del router de análisis — RF-04, RF-05, RF-06.

Cubre los endpoints que alimentan las pestañas principales de PitWall:
    GET /api/analysis/{year}/{event}/{session}/laps    -> RF-04
    GET /api/analysis/{year}/{event}/{session}/summary -> RF-05
    GET /api/analysis/{year}/{event}/{session}/stints  -> RF-06

Los services se mockean directamente para desacoplar los tests
de la lógica de FastF1 y centrarse en el comportamiento del router.
"""

import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from dtos.analysis_dto import (
    BestLapDTO,
    DriverSummaryDTO,
    LapRowDTO,
    LapsResponseDTO,
    StintCompoundDTO,
    StintsResponseDTO,
    SummaryResponseDTO,
)


# ---------------------------------------------------------------------------
# Fixtures de DTOs de respuesta mockeados
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_laps_response():
    """LapsResponseDTO simulado con una vuelta y un piloto."""
    return LapsResponseDTO(
        drivers=["HAM"],
        laps=[
            LapRowDTO(
                lap_number=1,
                entries={"HAM": None},
            )
        ],
    )


@pytest.fixture
def mock_summary_response():
    """SummaryResponseDTO simulado con un piloto y estadísticas básicas."""
    return SummaryResponseDTO(
        drivers=["HAM"],
        summaries={
            "HAM": DriverSummaryDTO(
                best_lap=BestLapDTO(time="1:33.456", lap_number=5),
                average="1:35.000",
                median="1:34.500",
                std_dev="0.500",
                consistency=98.5,
                valid_laps=20,
                strategy=[
                    StintCompoundDTO(compound="SOFT", color="#da291c", label="S")
                ],
            )
        },
    )


@pytest.fixture
def mock_stints_response():
    """StintsResponseDTO simulado con un stint y un piloto."""
    from dtos.analysis_dto import StintEntryDTO, StintDriverDTO, StintBestLapDTO

    return StintsResponseDTO(
        drivers=["HAM"],
        stints=[
            StintEntryDTO(
                stint_number=1,
                drivers={
                    "HAM": StintDriverDTO(
                        compound="SOFT",
                        compound_label="S",
                        compound_color="#da291c",
                        duration_laps=20,
                        duration_time=None,
                        best_lap=StintBestLapDTO(time="1:33.456", lap_in_stint=5),
                        average="1:35.000",
                        median="1:34.500",
                        std_dev="0.500",
                        consistency=98.5,
                    )
                },
            )
        ],
    )


# ---------------------------------------------------------------------------
# RF-04 — Obtener datos de vuelta agrupados
# ---------------------------------------------------------------------------


class TestGetLapData:
    """RF-04: El sistema devuelve vueltas agrupadas por número de vuelta."""

    def test_lap_data_sesion_valida_devuelve_dto(self, client, mock_laps_response):
        """Caso positivo: sesión y pilotos válidos devuelven LapsResponseDTO."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_laps_response", return_value=mock_laps_response
            ):
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/laps?drivers=HAM"
                )

        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
        assert "laps" in data
        assert "HAM" in data["drivers"]

    def test_lap_data_sin_parametro_drivers_devuelve_422(self, client):
        """Caso negativo: llamar sin el parámetro drivers requerido devuelve 422."""
        response = client.get("/api/analysis/2023/Bahrain Grand Prix/Race/laps")
        assert response.status_code == 422

    def test_lap_data_sesion_inexistente_devuelve_404(self, client):
        """Caso negativo: sesión que no existe en FastF1 devuelve 404."""
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            side_effect=Exception("Session not found"),
        ):
            response = client.get(
                "/api/analysis/2023/Bahrain Grand Prix/FP99/laps?drivers=HAM"
            )
        assert response.status_code == 404

    def test_lap_data_ano_invalido_devuelve_422(self, client):
        """Caso negativo: año fuera del rango soportado devuelve 422."""
        response = client.get(
            "/api/analysis/2019/Bahrain Grand Prix/Race/laps?drivers=HAM"
        )
        assert response.status_code == 422

    def test_lap_data_rendimiento_responde_rapido(self, client, mock_laps_response):
        """Test de rendimiento: el endpoint responde en menos de 500ms con datos mockeados."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_laps_response", return_value=mock_laps_response
            ):
                inicio = time.time()
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/laps?drivers=HAM"
                )
                duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.5, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.5s"
        )


# ---------------------------------------------------------------------------
# RF-05 — Obtener estadísticas resumen por piloto
# ---------------------------------------------------------------------------


class TestGetSummary:
    """RF-05: El sistema devuelve estadísticas agregadas por piloto."""

    def test_summary_sesion_valida_devuelve_dto(self, client, mock_summary_response):
        """Caso positivo: sesión y pilotos válidos devuelven SummaryResponseDTO."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_summary_response",
                return_value=mock_summary_response,
            ):
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/summary?drivers=HAM"
                )

        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
        assert "summaries" in data
        assert "HAM" in data["summaries"]

    def test_summary_contiene_metricas_esperadas(self, client, mock_summary_response):
        """Caso positivo: las estadísticas incluyen best_lap, average, consistency."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_summary_response",
                return_value=mock_summary_response,
            ):
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/summary?drivers=HAM"
                )

        ham = response.json()["summaries"]["HAM"]
        assert "best_lap" in ham
        assert "average" in ham
        assert "consistency" in ham
        assert "valid_laps" in ham
        assert "strategy" in ham

    def test_summary_piloto_sin_vueltas_validas_devuelve_null(self, client):
        """Caso negativo: piloto sin vueltas válidas aparece con None en summaries."""
        mock_session = MagicMock()
        mock_response = SummaryResponseDTO(
            drivers=["XXX"],
            summaries={"XXX": None},
        )
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_summary_response", return_value=mock_response
            ):
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/summary?drivers=XXX"
                )

        assert response.status_code == 200
        assert response.json()["summaries"]["XXX"] is None

    def test_summary_sesion_inexistente_devuelve_404(self, client):
        """Caso negativo: sesión inexistente devuelve 404."""
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            side_effect=Exception("Not found"),
        ):
            response = client.get(
                "/api/analysis/2023/GP Inventado/Race/summary?drivers=HAM"
            )
        assert response.status_code == 404

    def test_summary_rendimiento_responde_rapido(self, client, mock_summary_response):
        """Test de rendimiento: el endpoint responde en menos de 500ms con datos mockeados."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_summary_response",
                return_value=mock_summary_response,
            ):
                inicio = time.time()
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/summary?drivers=HAM"
                )
                duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.5, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.5s"
        )


# ---------------------------------------------------------------------------
# RF-06 — Obtener métricas por stint
# ---------------------------------------------------------------------------


class TestGetStints:
    """RF-06: El sistema devuelve métricas estadísticas por stint."""

    def test_stints_sesion_valida_devuelve_dto(self, client, mock_stints_response):
        """Caso positivo: sesión y pilotos válidos devuelven StintsResponseDTO."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_stints_response",
                return_value=mock_stints_response,
            ):
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/stints?drivers=HAM"
                )

        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
        assert "stints" in data
        assert len(data["stints"]) == 1

    def test_stints_contiene_datos_compuesto(self, client, mock_stints_response):
        """Caso positivo: cada stint incluye compuesto, duración y métricas."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_stints_response",
                return_value=mock_stints_response,
            ):
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/stints?drivers=HAM"
                )

        stint = response.json()["stints"][0]
        ham_stint = stint["drivers"]["HAM"]
        assert "compound" in ham_stint
        assert "duration_laps" in ham_stint
        assert "consistency" in ham_stint

    def test_stints_piloto_con_menos_stints_aparece_null(self, client):
        """Caso negativo: piloto con menos stints que otros aparece con None."""
        from dtos.analysis_dto import StintEntryDTO

        mock_session = MagicMock()
        mock_response = StintsResponseDTO(
            drivers=["HAM", "RUS"],
            stints=[
                StintEntryDTO(
                    stint_number=1,
                    drivers={"HAM": None, "RUS": None},
                )
            ],
        )
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_stints_response", return_value=mock_response
            ):
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/stints?drivers=HAM,RUS"
                )

        assert response.status_code == 200
        stint = response.json()["stints"][0]
        assert stint["drivers"]["HAM"] is None

    def test_stints_sesion_inexistente_devuelve_404(self, client):
        """Caso negativo: sesión inexistente devuelve 404."""
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            side_effect=Exception("Not found"),
        ):
            response = client.get(
                "/api/analysis/2023/GP Inventado/Race/stints?drivers=HAM"
            )
        assert response.status_code == 404

    def test_stints_rendimiento_responde_rapido(self, client, mock_stints_response):
        """Test de rendimiento: el endpoint responde en menos de 500ms con datos mockeados."""
        mock_session = MagicMock()
        with patch(
            "routers.analysis.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session,
        ):
            with patch(
                "routers.analysis.build_stints_response",
                return_value=mock_stints_response,
            ):
                inicio = time.time()
                response = client.get(
                    "/api/analysis/2023/Bahrain Grand Prix/Race/stints?drivers=HAM"
                )
                duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.5, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.5s"
        )
