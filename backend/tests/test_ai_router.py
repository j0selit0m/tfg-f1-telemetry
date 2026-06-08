"""
Tests del router de análisis con IA.

Cubre los tres endpoints del módulo de análisis inteligente:
    POST /api/ai/summary-analysis  -> análisis de estadísticas de resumen
    POST /api/ai/stints-analysis   -> análisis de métricas de stints
    POST /api/ai/laps-analysis     -> análisis narrativo de datos de vueltas

Gemini se mockea en todos los tests para evitar llamadas reales a la API
y garantizar tests deterministas y rápidos.
"""

import time
from unittest.mock import AsyncMock, patch


# ---------------------------------------------------------------------------
# Payloads de ejemplo reutilizables
# ---------------------------------------------------------------------------

SUMMARY_PAYLOAD = {
    "year": 2023,
    "event_name": "Bahrain Grand Prix",
    "session_name": "Race",
    "driver_names": {"HAM": "Lewis Hamilton"},
    "drivers": [
        {
            "driver_code": "HAM",
            "best_lap": "1:33.456",
            "best_lap_number": 5,
            "average": "1:35.000",
            "median": "1:34.500",
            "std_dev": "0.500",
            "consistency": 98.5,
            "valid_laps": 20,
            "strategy": ["S", "M"],
        }
    ],
}

STINTS_PAYLOAD = {
    "year": 2023,
    "event_name": "Bahrain Grand Prix",
    "session_name": "Race",
    "driver_names": {"HAM": "Lewis Hamilton"},
    "drivers": ["HAM"],
    "stints": [
        {
            "stint_number": 1,
            "drivers": {
                "HAM": {
                    "compound_label": "S",
                    "duration_laps": 20,
                    "best_lap": "1:33.456",
                    "average": "1:35.000",
                    "consistency": 98.5,
                }
            },
        }
    ],
}

LAPS_PAYLOAD = {
    "year": 2023,
    "event_name": "Bahrain Grand Prix",
    "session_name": "Race",
    "driver_names": {"HAM": "Lewis Hamilton"},
    "drivers": ["HAM"],
    "laps": [
        {
            "lap_number": 1,
            "entries": {
                "HAM": {
                    "lap_time": "1:33.456",
                    "sector1": "28.000",
                    "sector2": "35.000",
                    "sector3": "30.456",
                    "compound": "SOFT",
                    "tyre_life": 1,
                    "position": 1,
                    "track_status": "1",
                    "pit_in": False,
                    "pit_out": False,
                    "is_fastest_lap": True,
                }
            },
        }
    ],
}


# ---------------------------------------------------------------------------
# POST /api/ai/summary-analysis
# ---------------------------------------------------------------------------


class TestSummaryAnalysis:
    """Tests del endpoint de análisis IA de estadísticas de resumen."""

    def test_summary_payload_valido_devuelve_analisis(self, client):
        """Caso positivo: payload correcto devuelve texto de análisis generado por Gemini."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            return_value="Hamilton showed strong pace throughout the race.",
        ):
            response = client.post("/api/ai/summary-analysis", json=SUMMARY_PAYLOAD)

        assert response.status_code == 200
        data = response.json()
        assert "analysis" in data
        assert isinstance(data["analysis"], str)
        assert len(data["analysis"]) > 0

    def test_summary_drivers_vacios_devuelve_422(self, client):
        """Caso negativo: lista de drivers vacía devuelve 422."""
        payload = {**SUMMARY_PAYLOAD, "drivers": []}
        response = client.post("/api/ai/summary-analysis", json=payload)
        assert response.status_code == 422

    def test_summary_sin_year_devuelve_422(self, client):
        """Caso negativo: payload sin campo year requerido devuelve 422."""
        payload = {k: v for k, v in SUMMARY_PAYLOAD.items() if k != "year"}
        response = client.post("/api/ai/summary-analysis", json=payload)
        assert response.status_code == 422

    def test_summary_gemini_falla_devuelve_502(self, client):
        """Caso negativo: si Gemini devuelve error, el backend devuelve 502."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Gemini API error 429"),
        ):
            response = client.post("/api/ai/summary-analysis", json=SUMMARY_PAYLOAD)
        assert response.status_code == 502

    def test_summary_rendimiento_con_gemini_mockeado(self, client):
        """Test de rendimiento: el endpoint responde en menos de 100ms con Gemini mockeado."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            return_value="Analysis text.",
        ):
            inicio = time.time()
            response = client.post("/api/ai/summary-analysis", json=SUMMARY_PAYLOAD)
            duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.1, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.1s"
        )


# ---------------------------------------------------------------------------
# POST /api/ai/stints-analysis
# ---------------------------------------------------------------------------


class TestStintsAnalysis:
    """Tests del endpoint de análisis IA de métricas de stints."""

    def test_stints_payload_valido_devuelve_analisis(self, client):
        """Caso positivo: payload correcto devuelve texto de análisis generado por Gemini."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            return_value="Hamilton completed a two-stint strategy on soft and medium tyres.",
        ):
            response = client.post("/api/ai/stints-analysis", json=STINTS_PAYLOAD)

        assert response.status_code == 200
        assert "analysis" in response.json()

    def test_stints_drivers_vacios_devuelve_422(self, client):
        """Caso negativo: lista de drivers vacía devuelve 422."""
        payload = {**STINTS_PAYLOAD, "drivers": []}
        response = client.post("/api/ai/stints-analysis", json=payload)
        assert response.status_code == 422

    def test_stints_gemini_falla_devuelve_502(self, client):
        """Caso negativo: si Gemini devuelve error, el backend devuelve 502."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Gemini API error 503"),
        ):
            response = client.post("/api/ai/stints-analysis", json=STINTS_PAYLOAD)
        assert response.status_code == 502

    def test_stints_rendimiento_con_gemini_mockeado(self, client):
        """Test de rendimiento: el endpoint responde en menos de 100ms con Gemini mockeado."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            return_value="Analysis text.",
        ):
            inicio = time.time()
            response = client.post("/api/ai/stints-analysis", json=STINTS_PAYLOAD)
            duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.1, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.1s"
        )


# ---------------------------------------------------------------------------
# POST /api/ai/laps-analysis
# ---------------------------------------------------------------------------


class TestLapsAnalysis:
    """Tests del endpoint de análisis IA narrativo de datos de vueltas."""

    def test_laps_payload_valido_devuelve_analisis(self, client):
        """Caso positivo: payload correcto devuelve texto narrativo generado por Gemini."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            return_value="The 2023 Bahrain Grand Prix Race saw Hamilton lead from start to finish.",
        ):
            response = client.post("/api/ai/laps-analysis", json=LAPS_PAYLOAD)

        assert response.status_code == 200
        data = response.json()
        assert "analysis" in data
        assert isinstance(data["analysis"], str)

    def test_laps_drivers_vacios_devuelve_422(self, client):
        """Caso negativo: lista de drivers vacía devuelve 422."""
        payload = {**LAPS_PAYLOAD, "drivers": []}
        response = client.post("/api/ai/laps-analysis", json=payload)
        assert response.status_code == 422

    def test_laps_laps_vacias_devuelve_200(self, client):
        """Caso edge: lista de laps vacía es válida — devuelve análisis con datos vacíos."""
        payload = {**LAPS_PAYLOAD, "laps": []}
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            return_value="No lap data available for analysis.",
        ):
            response = client.post("/api/ai/laps-analysis", json=payload)
        assert response.status_code == 200

    def test_laps_gemini_falla_devuelve_502(self, client):
        """Caso negativo: si Gemini devuelve error, el backend devuelve 502."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Gemini API error 429"),
        ):
            response = client.post("/api/ai/laps-analysis", json=LAPS_PAYLOAD)
        assert response.status_code == 502

    def test_laps_rendimiento_con_gemini_mockeado(self, client):
        """Test de rendimiento: el endpoint responde en menos de 100ms con Gemini mockeado."""
        with patch(
            "services.ai_service.generate_content",
            new_callable=AsyncMock,
            return_value="Analysis text.",
        ):
            inicio = time.time()
            response = client.post("/api/ai/laps-analysis", json=LAPS_PAYLOAD)
            duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.1, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.1s"
        )
