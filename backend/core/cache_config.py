"""
Inicialización de la caché de FastF1.

Se ejecuta una sola vez al importar main.py. Selecciona la ruta de caché
en función de si el HDD externo está disponible o no.
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
    if os.path.exists(os.path.splitdrive(CACHE_HDD_PATH)[0] + os.sep):
        os.makedirs(CACHE_HDD_PATH, exist_ok=True)
        path = CACHE_HDD_PATH
        print(f"✅ Caché FastF1 en HDD: {path}")
    else:
        path = CACHE_LOCAL_PATH
        print(f"⚠️  HDD no detectado. Caché local: {path}")

    fastf1.Cache.enable_cache(path)
    return path
