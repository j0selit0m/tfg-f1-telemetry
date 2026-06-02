"""Tests unitarios de utils/formatting.py."""

import pytest
import pandas as pd

from utils.formatting import format_timedelta, normalize_hex, lighten_color


# --- format_timedelta ---


class TestFormatTimedelta:
    """Convierte Timedelta de Pandas a string M:SS.mmm o SS.mmm."""

    def test_nulo_devuelve_none(self):
        assert format_timedelta(pd.NaT) is None

    def test_none_devuelve_none(self):
        assert format_timedelta(None) is None

    def test_menos_de_un_minuto(self):
        td = pd.to_timedelta(9.100, unit="s")
        assert format_timedelta(td) == "9.100"

    def test_mas_de_un_minuto(self):
        td = pd.to_timedelta(93.456, unit="s")
        assert format_timedelta(td) == "1:33.456"

    def test_minuto_exacto(self):
        td = pd.to_timedelta(60.0, unit="s")
        assert format_timedelta(td) == "1:00.000"

    def test_cero_segundos(self):
        td = pd.to_timedelta(0, unit="s")
        assert format_timedelta(td) == "0.000"

    def test_milisegundos_con_ceros_a_la_izquierda(self):
        td = pd.to_timedelta(61.005, unit="s")
        assert format_timedelta(td) == "1:01.005"

    def test_tiempo_largo_dos_minutos(self):
        td = pd.to_timedelta(125.789, unit="s")
        assert format_timedelta(td) == "2:05.789"


# --- normalize_hex ---


class TestNormalizeHex:
    """Normaliza colores HEX recibidos de FastF1."""

    def test_hex_valido_sin_hash(self):
        assert normalize_hex("E8002D") == "e8002d"

    def test_hex_con_espacios(self):
        assert normalize_hex("  FF5733  ") == "ff5733"

    def test_nan_devuelve_fallback(self):
        assert normalize_hex("nan") == "ffffff"

    def test_vacio_devuelve_fallback(self):
        assert normalize_hex("") == "ffffff"

    def test_fallback_personalizado(self):
        assert normalize_hex("nan", fallback="888888") == "888888"

    def test_mayusculas_a_minusculas(self):
        assert normalize_hex("AABBCC") == "aabbcc"


# --- lighten_color ---


class TestLightenColor:
    """Aclara un color HEX mezclándolo con blanco."""

    def test_factor_cero_no_cambia(self):
        assert lighten_color("#000000", factor=0.0) == "#000000"

    def test_factor_uno_blanco_puro(self):
        assert lighten_color("#000000", factor=1.0) == "#ffffff"

    def test_con_hash(self):
        result = lighten_color("#E8002D", factor=0.4)
        assert result.startswith("#")
        assert len(result) == 7

    def test_sin_hash(self):
        result = lighten_color("E8002D", factor=0.4)
        assert result.startswith("#")

    def test_blanco_no_cambia(self):
        assert lighten_color("#ffffff", factor=0.4) == "#ffffff"

    def test_resultado_es_mas_claro(self):
        original = "40, 40, 40"
        result = lighten_color("#282828", factor=0.5)
        r = int(result[1:3], 16)
        g = int(result[3:5], 16)
        b = int(result[5:7], 16)
        assert r > 0x28 and g > 0x28 and b > 0x28
