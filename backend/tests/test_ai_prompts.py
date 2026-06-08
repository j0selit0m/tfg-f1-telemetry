"""
Tests unitarios de core/ai_prompts.py.

Cubre las funciones helper puras del módulo de análisis con IA:
    _session_context() -> clasifica el tipo de sesión
    _driver_label()    -> construye la etiqueta de piloto con nombre

Son funciones sin efectos secundarios ni dependencias externas,
por lo que no requieren mocks ni fixtures.
"""

from core.ai_prompts import _session_context, _driver_label


# ---------------------------------------------------------------------------
# _session_context
# ---------------------------------------------------------------------------


class TestSessionContext:
    """Clasifica el tipo de sesión para adaptar las instrucciones del prompt."""

    def test_race_devuelve_race(self):
        """Caso positivo: 'Race' se clasifica como tipo race."""
        assert _session_context("Race") == "race"

    def test_sprint_devuelve_sprint(self):
        """Caso positivo: 'Sprint' se clasifica como tipo sprint."""
        assert _session_context("Sprint") == "sprint"

    def test_qualifying_devuelve_qualifying(self):
        """Caso positivo: 'Qualifying' se clasifica como tipo qualifying."""
        assert _session_context("Qualifying") == "qualifying"

    def test_sprint_qualifying_devuelve_qualifying(self):
        """Caso positivo: 'Sprint Qualifying' se clasifica como qualifying."""
        assert _session_context("Sprint Qualifying") == "qualifying"

    def test_fp1_devuelve_practice(self):
        """Caso positivo: 'FP1' se clasifica como tipo practice."""
        assert _session_context("FP1") == "practice"

    def test_fp2_devuelve_practice(self):
        """Caso positivo: 'FP2' se clasifica como tipo practice."""
        assert _session_context("FP2") == "practice"

    def test_fp3_devuelve_practice(self):
        """Caso positivo: 'FP3' se clasifica como tipo practice."""
        assert _session_context("FP3") == "practice"

    def test_sesion_desconocida_devuelve_practice(self):
        """Caso negativo: sesión desconocida cae en el tipo practice por defecto."""
        assert _session_context("SessionDesconocida") == "practice"

    def test_cadena_vacia_devuelve_practice(self):
        """Caso negativo: cadena vacía cae en el tipo practice por defecto."""
        assert _session_context("") == "practice"


# ---------------------------------------------------------------------------
# _driver_label
# ---------------------------------------------------------------------------


class TestDriverLabel:
    """Construye la etiqueta de piloto con nombre completo si está disponible."""

    def test_con_nombre_devuelve_codigo_y_nombre(self):
        """Caso positivo: código con nombre disponible devuelve 'ANT (Antonelli)'."""
        result = _driver_label("ANT", {"ANT": "Andrea Kimi Antonelli"})
        assert result == "ANT (Andrea Kimi Antonelli)"

    def test_sin_nombre_devuelve_solo_codigo(self):
        """Caso negativo: código sin nombre en el dict devuelve solo el código."""
        result = _driver_label("ANT", {})
        assert result == "ANT"

    def test_dict_vacio_devuelve_codigo(self):
        """Caso negativo: diccionario vacío devuelve solo el código."""
        result = _driver_label("VER", {})
        assert result == "VER"

    def test_codigo_no_presente_devuelve_codigo(self):
        """Caso negativo: código no presente en el dict devuelve solo el código."""
        result = _driver_label("HAM", {"VER": "Max Verstappen"})
        assert result == "HAM"

    def test_formato_correcto_con_parentesis(self):
        """Caso positivo: el formato incluye paréntesis alrededor del nombre."""
        result = _driver_label("NOR", {"NOR": "Lando Norris"})
        assert "(" in result and ")" in result
        assert result == "NOR (Lando Norris)"
