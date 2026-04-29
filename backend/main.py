import os
import fastf1
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# =====================================================
# CONFIGURACIÓN DE LA CACHÉ
# =====================================================
# Definimos la ruta en el HDD externo (E:)
HDD_DRIVE_LETTER = "E:"
CACHE_FOLDER_NAME = "TFG_F1_Cache"
HDD_PATH = os.path.join(HDD_DRIVE_LETTER + os.sep, CACHE_FOLDER_NAME)

if not os.path.exists(HDD_DRIVE_LETTER + os.sep):
    print(f"⚠️ ADVERTENCIA: No se detecta {HDD_DRIVE_LETTER}. Usando caché local.")
    FINAL_CACHE_PATH = "fastf1_cache_local"
else:
    if not os.path.exists(HDD_PATH):
        os.makedirs(HDD_PATH)
    FINAL_CACHE_PATH = HDD_PATH
    print(f"✅ Caché configurada en: {FINAL_CACHE_PATH}")

# Activación global. A partir de aquí, FastF1 intercepta las peticiones de red y lee de disco.
fastf1.Cache.enable_cache(FINAL_CACHE_PATH)

# =====================================================
# INICIALIZACIÓN DE LA API Y SEGURIDAD (CORS)
# =====================================================

# Habilitamos CORS (Cross-Origin Resource Sharing) para autorizar explícitamente
# el tráfico entre el cliente local (puerto 5173) y este servidor (puerto 8000),
# resolviendo la restricción de seguridad por la política de mismo origen del navegador.

app = FastAPI(title="TFG Formula 1 API - Tracing Insights Model")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# ENDPOINTS: FILTRO DE SELECCIÓN
# =====================================================


# NIVEL 1: Obtener el calendario de la temporada
@app.get("/api/schedule/{year}")
async def get_schedule(year: int):
    try:
        schedule = fastf1.get_event_schedule(year)

        # Optimizamos el payload enviando solo los campos necesarios para la UI.
        df = schedule[["RoundNumber", "EventName", "Country"]]

        # Saneamiento de datos: Evitamos Errores 500 en la API oficial eliminando
        # eventos duplicados (como los múltiples test de pretemporada en años de cambio de reglamento, 2026 pej).
        df_clean = df.drop_duplicates(subset=["RoundNumber", "EventName"])

        # Parseo a Array de Objetos para facilitar el renderizado en el Frontend (React).
        return df_clean.to_dict(orient="records")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NIVEL 2: Obtener las sesiones de un Gran Premio específico
@app.get("/api/schedule/{year}/{round}/sessions")
async def get_sessions(year: int, round: int):
    try:
        # Descarga la información básica del evento
        event = fastf1.get_event(year, round)

        sessions = []

        # Buscamos dinámicamente cuántas sesiones existen realmente en el objeto
        # Filtramos las claves que empiezan por 'Session' seguidas de un número (ej: 'Session1')
        session_keys = [
            key
            for key in event.index
            if key.startswith("Session") and key[-1].isdigit()
        ]

        for key in session_keys:
            session_name = event.get(key)
            session_date = event.get(f"{key}Date")

            if pd.notna(session_name):
                sessions.append(
                    {
                        "id": session_name,
                        # Convertimos a ISO 8601 para que el parser de fechas de JS (React) lo consuma nativamente
                        "date": session_date.isoformat()
                        if pd.notna(session_date)
                        else None,
                    }
                )

        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NIVEL 3: Obtener los Pilotos de una sesión con sus colores de equipo
@app.get("/api/session/{year}/{round}/{session_name}/drivers")
async def get_drivers(year: int, round: int, session_name: str):
    try:
        session = fastf1.get_session(year, round, session_name)

        # Optimización de I/O: Cargamos exclusivamente la tabla de resultados.
        # Deshabilitar la telemetría y meteorología reduce drásticamente el uso de memoria RAM y ancho de banda.
        session.load(telemetry=False, weather=False, messages=False)

        drivers_data = []
        for _, driver_info in session.results.iterrows():
            # Saneamiento del código de color HEX.
            # Prevenimos fallos de renderizado en el CSS del Frontend si la API oficial devuelve nulos (NaN)
            team_color = str(driver_info.get("TeamColor", "ffffff"))
            if team_color == "nan" or not team_color:
                team_color = "ffffff"

            drivers_data.append(
                {
                    "driver_number": driver_info["DriverNumber"],
                    "abbreviation": driver_info["Abbreviation"],
                    "broadcast_name": driver_info["BroadcastName"],
                    "team_name": driver_info["TeamName"],
                    "team_color": f"#{team_color}",  # Pre-formateamos la cadena a un valor CSS válido
                }
            )

        return drivers_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Función auxiliar para convertir Timedelta a formato "Minutos:Segundos.Milisegundos"
def format_timedelta(td):
    """
    Parsea los objetos Timedelta de Pandas a Strings legibles.
    Resuelve la incompatibilidad de serialización JSON y delega
    el coste de cálculo de formato al backend en lugar del cliente (React).
    """
    # Gestión de abandonos o sectores no completados (NaT en Pandas -> null en JSON)
    if pd.isna(td):
        return None

    total_seconds = td.total_seconds()
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds * 1000) % 1000)

    # Formato condicional: M:SS.mmm para vueltas completas, SS.mmm para sectores cortos.
    # Se aplica zero-padding (ej. :02d) para mantener la alineación tabular en el Frontend.
    if minutes > 0:
        return f"{minutes}:{seconds:02d}.{milliseconds:03d}"
    else:
        return f"{seconds}.{milliseconds:03d}"


# =====================================================
# MOTOR DE DATOS: Análisis detallado por vuelta
# =====================================================
@app.get("/api/analysis/{year}/{round}/{session_name}/laps")
async def get_lap_data(year: int, round: int, session_name: str, drivers: str):
    """
    Endpoint principal para alimentar la tabla de datos y gráficas del Frontend.
    Recibe los parámetros de ruta para ubicar la sesión y un Query Parameter 'drivers'.
    La API soporta identificadores flexibles separados por coma: dorsales,
    abreviaturas o nombres (ej: ?drivers=ALO,VER o ?drivers=1,16).
    """
    try:
        session = fastf1.get_session(year, round, session_name)

        # Mantenemos la telemetría pesada desactivada. Para construir la tabla
        # de tiempos y stints solo necesitamos la metadata de la vuelta, no los sensores a 20Hz.
        session.load(telemetry=False, weather=False, messages=False)

        # Parseo del Query Parameter (String) a Lista nativa
        driver_list = drivers.split(",")

        # Filtrado vectorizado: La función pick_drivers es multipropósito y cruzará
        # automáticamente nuestra lista (ej. ['ALO', 'SAI']) con la base de datos.
        laps = session.laps.pick_drivers(driver_list)

        response_data = []

        for _, lap in laps.iterrows():
            # Construcción del Payload.
            # CRÍTICO: Se realiza un "Casting" explícito a tipos primitivos de Python (int, bool).
            # Los tipos nativos de Numpy/Pandas (int64, bool_) rompen el serializador JSON de FastAPI.
            lap_data = {
                "Driver": lap["Driver"],
                "LapNumber": int(lap["LapNumber"])
                if pd.notna(lap["LapNumber"])
                else None,
                "Position": int(lap["Position"]) if pd.notna(lap["Position"]) else None,
                # Delegamos el cálculo matemático del tiempo a la función auxiliar
                "LapTime": format_timedelta(lap["LapTime"]),
                "Sector1": format_timedelta(lap["Sector1Time"]),
                "Sector2": format_timedelta(lap["Sector2Time"]),
                "Sector3": format_timedelta(lap["Sector3Time"]),
                "Compound": lap["Compound"],
                "TyreLife": int(lap["TyreLife"]) if pd.notna(lap["TyreLife"]) else None,
                "Stint": int(lap["Stint"]) if pd.notna(lap["Stint"]) else None,
                "TrackStatus": lap["TrackStatus"],
                # Booleanos para el renderizado condicional de la UI (ej. tachar vueltas no válidas)
                "IsPersonalBest": bool(lap["IsPersonalBest"]),
                "Deleted": bool(lap["Deleted"]),
                "IsAccurate": bool(lap["IsAccurate"]),
                # Separación de Pit In/Out para controlar el estado exacto del neumático en la UI
                "PitOut": pd.notna(lap["PitOutTime"]),
                "PitIn": pd.notna(lap["PitInTime"]),
            }
            response_data.append(lap_data)

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
