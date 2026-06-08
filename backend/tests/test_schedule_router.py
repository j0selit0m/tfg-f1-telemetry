"""
Tests del router de schedule — RF-01, RF-02, RF-03.

Cubre los endpoints que alimentan el SidebarFilter del frontend:
    GET /api/schedule/{year}                          -> RF-01
    GET /api/schedule/{year}/{event}/sessions         -> RF-02
    GET /api/session/{year}/{event}/{session}/drivers -> RF-03

Todos los tests mockean FastF1 para evitar llamadas reales a la API
y garantizar que los tests sean reproducibles y rápidos.
"""

import time
from unittest.mock import AsyncMock, patch


# ---------------------------------------------------------------------------
# RF-01 — Obtener calendario de temporada
# ---------------------------------------------------------------------------


class TestGetSchedule:
    """RF-01: El sistema devuelve la lista de GPs de una temporada."""

    def test_calendario_ano_valido_devuelve_lista_gps(self, client, mock_schedule_df):
        """Caso positivo: año válido dentro del rango soportado devuelve GPs."""
        with patch(
            "routers.schedule.fastf1.get_event_schedule", return_value=mock_schedule_df
        ):
            response = client.get("/api/schedule/2023")

        assert response.status_code == 200
        data = response.json()
        # Solo GPs oficiales (round_number > 0), excluye pretemporada
        assert len(data) == 2
        assert data[0]["event_name"] == "Bahrain Grand Prix"
        assert data[0]["country"] == "Bahrain"
        assert data[0]["round_number"] == 1

    def test_calendario_excluye_pretemporada(self, client, mock_schedule_df):
        """Caso positivo: los eventos con RoundNumber=0 (pretemporada) no se incluyen."""
        with patch(
            "routers.schedule.fastf1.get_event_schedule", return_value=mock_schedule_df
        ):
            response = client.get("/api/schedule/2023")

        data = response.json()
        round_numbers = [gp["round_number"] for gp in data]
        assert 0 not in round_numbers

    def test_calendario_ano_menor_minimo_devuelve_422(self, client):
        """Caso negativo: año por debajo del mínimo soportado devuelve 422."""
        response = client.get("/api/schedule/2019")
        assert response.status_code == 422

    def test_calendario_ano_mayor_maximo_devuelve_422(self, client):
        """Caso negativo: año por encima del máximo soportado devuelve 422."""
        response = client.get("/api/schedule/2099")
        assert response.status_code == 422

    def test_calendario_fastf1_falla_devuelve_503(self, client):
        """Caso negativo: si FastF1 lanza una excepción, el backend devuelve 503."""
        with patch(
            "routers.schedule.fastf1.get_event_schedule",
            side_effect=Exception("FastF1 error"),
        ):
            response = client.get("/api/schedule/2023")
        assert response.status_code == 503

    def test_calendario_rendimiento_responde_rapido(self, client, mock_schedule_df):
        """Test de rendimiento: el endpoint responde en menos de 200ms con datos mockeados."""
        with patch(
            "routers.schedule.fastf1.get_event_schedule", return_value=mock_schedule_df
        ):
            inicio = time.time()
            response = client.get("/api/schedule/2023")
            duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.2, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.2s"
        )


# ---------------------------------------------------------------------------
# RF-02 — Obtener sesiones de un Gran Premio
# ---------------------------------------------------------------------------


class TestGetSessions:
    """RF-02: El sistema devuelve las sesiones disponibles de un GP."""

    def test_sesiones_gp_convencional_devuelve_cinco_sesiones(self, client, mock_event):
        """Caso positivo: GP convencional tiene FP1, FP2, FP3, Qualifying y Race."""
        with patch("routers.schedule.fastf1.get_event", return_value=mock_event):
            response = client.get("/api/schedule/2023/Bahrain Grand Prix/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
        session_ids = [s["id"] for s in data]
        assert "Race" in session_ids
        assert "Qualifying" in session_ids

    def test_sesiones_include_fecha(self, client, mock_event):
        """Caso positivo: cada sesión incluye su fecha en formato ISO 8601."""
        with patch("routers.schedule.fastf1.get_event", return_value=mock_event):
            response = client.get("/api/schedule/2023/Bahrain Grand Prix/sessions")

        data = response.json()
        for session in data:
            assert session["date"] is not None

    def test_sesiones_evento_inexistente_devuelve_404(self, client):
        """Caso negativo: evento que no existe en FastF1 devuelve 404."""
        with patch(
            "routers.schedule.fastf1.get_event", side_effect=Exception("Not found")
        ):
            response = client.get("/api/schedule/2023/Evento Inventado/sessions")
        assert response.status_code == 404

    def test_sesiones_rendimiento_responde_rapido(self, client, mock_event):
        """Test de rendimiento: el endpoint responde en menos de 200ms con datos mockeados."""
        with patch("routers.schedule.fastf1.get_event", return_value=mock_event):
            inicio = time.time()
            response = client.get("/api/schedule/2023/Bahrain Grand Prix/sessions")
            duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.2, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.2s"
        )


# ---------------------------------------------------------------------------
# RF-03 — Obtener pilotos y colores de una sesión
# ---------------------------------------------------------------------------


class TestGetDrivers:
    """RF-03: El sistema devuelve los pilotos y colores de una sesión."""

    def test_pilotos_sesion_valida_devuelve_lista(
        self, client, mock_session_with_drivers
    ):
        """Caso positivo: sesión válida devuelve lista de pilotos con colores."""
        with patch(
            "routers.schedule.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session_with_drivers,
        ):
            with patch(
                "routers.schedule.fastf1.plotting.get_driver_color",
                return_value="#00D2BE",
            ):
                response = client.get(
                    "/api/session/2023/Bahrain Grand Prix/Race/drivers"
                )

        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
        assert "compounds" in data
        assert len(data["drivers"]) == 2

    def test_pilotos_contiene_campos_obligatorios(
        self, client, mock_session_with_drivers
    ):
        """Caso positivo: cada piloto incluye abreviatura, nombre completo y colores."""
        with patch(
            "routers.schedule.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session_with_drivers,
        ):
            with patch(
                "routers.schedule.fastf1.plotting.get_driver_color",
                return_value="#00D2BE",
            ):
                response = client.get(
                    "/api/session/2023/Bahrain Grand Prix/Race/drivers"
                )

        driver = response.json()["drivers"][0]
        assert "abbreviation" in driver
        assert "full_name" in driver
        assert "driver_color" in driver
        assert "team_color" in driver

    def test_pilotos_sesion_inexistente_devuelve_404(self, client):
        """Caso negativo: sesión que no existe en FastF1 devuelve 404."""
        with patch(
            "routers.schedule.load_session_metadata",
            new_callable=AsyncMock,
            side_effect=Exception("Session not found"),
        ):
            response = client.get("/api/session/2023/Bahrain Grand Prix/FP99/drivers")
        assert response.status_code == 404

    def test_pilotos_rendimiento_responde_rapido(
        self, client, mock_session_with_drivers
    ):
        """Test de rendimiento: el endpoint responde en menos de 200ms con sesión mockeada."""
        with patch(
            "routers.schedule.load_session_metadata",
            new_callable=AsyncMock,
            return_value=mock_session_with_drivers,
        ):
            with patch(
                "routers.schedule.fastf1.plotting.get_driver_color",
                return_value="#00D2BE",
            ):
                inicio = time.time()
                response = client.get(
                    "/api/session/2023/Bahrain Grand Prix/Race/drivers"
                )
                duracion = time.time() - inicio

        assert response.status_code == 200
        assert duracion < 0.2, (
            f"El endpoint tardó {duracion:.3f}s, máximo esperado 0.2s"
        )
