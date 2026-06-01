"""
Inicialización de la caché de FastF1.

Se ejecuta una sola vez al importar main.py. Selecciona la ruta de caché
en función de si el HDD externo está disponible o no. La comprobación es
cross-platform: en Windows comprueba la unidad, en Unix-like el directorio
padre.
"""

import os
import fastf1

from config import CACHE_HDD_PATH, CACHE_LOCAL_PATH


def setup_cache() -> str:
    """Selecciona y activa la ruta de caché de FastF1.

    Prioriza el HDD externo para no consumir espacio en el disco del sistema.
    Si no está disponible, cae en la ruta local de forma silenciosa.

    Returns:
        Ruta de caché activada.
    """
    if _hdd_available(CACHE_HDD_PATH):
        os.makedirs(CACHE_HDD_PATH, exist_ok=True)
        path = CACHE_HDD_PATH
        print(f"Caché FastF1 en HDD: {path}")
    else:
        os.makedirs(CACHE_LOCAL_PATH, exist_ok=True)
        path = CACHE_LOCAL_PATH
        print(f"HDD no detectado. Caché local: {path}")

    fastf1.Cache.enable_cache(path)
    return path


def _hdd_available(path: str) -> bool:
    """Comprueba si la ruta del HDD externo es accesible.

    Cross-platform: en Windows valida la letra de unidad; en Unix-like
    valida que el directorio padre exista.
    """
    if os.name == "nt":
        drive = os.path.splitdrive(path)[0]
        return bool(drive) and os.path.exists(drive + os.sep)
    parent = os.path.dirname(path) or "/"
    return os.path.exists(parent)
