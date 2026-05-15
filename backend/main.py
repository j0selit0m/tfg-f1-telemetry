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

        # Parseo a Array de Objetos para facilitar el renderizado en el Frontend (React).
        return df.to_dict(orient="records")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NIVEL 2: Obtener las sesiones de un Gran Premio específico
@app.get("/api/schedule/{year}/{event_name}/sessions")
async def get_sessions(year: int, event_name: str):
    try:
        # Descarga la información básica del evento
        event = fastf1.get_event(year, event_name)

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
@app.get("/api/session/{year}/{event_name}/{session_name}/drivers")
async def get_drivers(year: int, event_name: str, session_name: str):
    try:
        session = fastf1.get_session(year, event_name, session_name)

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
                    "full_name": driver_info["FullName"],
                    "team_name": driver_info["TeamName"],
                    "team_color": f"#{team_color}",  # Pre-formateamos la cadena a un valor CSS válido
                }
            )

        return sorted(drivers_data, key=lambda x: x["abbreviation"])
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
@app.get("/api/analysis/{year}/{event_name}/{session_name}/laps")
async def get_lap_data(year: int, event_name: str, session_name: str, drivers: str):
    """
    Endpoint principal para alimentar la tabla de datos y gráficas del Frontend.
    Recibe los parámetros de ruta para ubicar la sesión y un Query Parameter 'drivers'.
    La API soporta identificadores flexibles separados por coma: dorsales,
    abreviaturas o nombres (ej: ?drivers=ALO,VER o ?drivers=1,16).
    """
    try:
        session = fastf1.get_session(year, event_name, session_name)

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


# =====================================================
# MAPA DE COMPUESTOS (colores y etiquetas oficiales F1)
# =====================================================
# Dict estático de fallback. Los colores están hardcodeados según la paleta
# oficial de Pirelli. En producción, sustituir por fastf1.plotting.get_compound_color()
# para obtener el color exacto por temporada de forma dinámica.
COMPOUND_COLORS = {
    "SOFT": {"bg": "#E8002D", "label": "S"},
    "MEDIUM": {"bg": "#FFC906", "label": "M"},
    "HARD": {"bg": "#FFFFFF", "label": "H"},
    "INTER": {"bg": "#43B02A", "label": "I"},
    "WET": {"bg": "#0067FF", "label": "W"},
}


# =====================================================
# ENDPOINT: Summary Statistics (modelo Tracing Insights)
# =====================================================
@app.get("/api/analysis/{year}/{event_name}/{session_name}/summary")
async def get_summary_stats(
    year: int, event_name: str, session_name: str, drivers: str
):
    """
    Calcula y devuelve el cuadro de resumen estadístico por piloto.

    Métricas devueltas por piloto:
      - best_lap:    Vuelta más rápida real con su número de vuelta
      - average:     Media de tiempos sobre vueltas válidas
      - median:      Mediana de tiempos sobre vueltas válidas
      - std_dev:     Desviación estándar (indicador de consistencia bruta)
      - consistency: Índice porcentual -> (1 - std/mean) * 100
      - valid_laps:  Total de vueltas completadas sin borrar (incluye VSC/SC)
      - strategy:    Secuencia de compuestos usados en orden de stint

    Query Params:
      - drivers: Abreviaturas separadas por coma (ej: "ALO,VER")
    """
    try:
        session = fastf1.get_session(year, event_name, session_name)

        session.load(telemetry=False, weather=False, messages=False)

        # Normalizamos la entrada: strip() elimina espacios accidentales tras la coma
        # (ej: "ALO, VER" -> ["ALO", "VER"]) y upper() garantiza el match con FastF1.
        driver_list = [d.strip().upper() for d in drivers.split(",")]

        # pick_drivers() acepta abreviaturas, dorsales o nombres completos indistintamente.
        # Cargamos todos los pilotos de una vez para hacer un único acceso al DataFrame.
        all_laps = session.laps.pick_drivers(driver_list)

        response_data = {}

        for driver_abbr in driver_list:
            # Aislamos las vueltas del piloto actual del DataFrame combinado.
            # .copy() evita el SettingWithCopyWarning de pandas al modificar el slice.
            driver_laps = all_laps[all_laps["Driver"] == driver_abbr].copy()

            if driver_laps.empty:
                response_data[driver_abbr] = None
                continue

            # ---- CONTEO: válidas para el campo valid_laps ----
            # Incluimos VSC, SC y pit in/out: Tracing Insights muestra 66 en una carrera
            # de 66 vueltas, lo que confirma que no excluyen ningún tipo de vuelta del conteo.
            # Solo descartamos las que no tienen tiempo registrado o fueron borradas
            # por los comisarios (infracción de track limits, etc.).
            laps_for_count = driver_laps[
                driver_laps["LapTime"].notna() & ~driver_laps["Deleted"].fillna(False)
            ]

            # ---- ESTADÍSTICAS: válidas para average, median, std, consistency ----
            # Excluimos pit in/out con pick_wo_box() porque esas vueltas incluyen
            # el tiempo de pit stop (~20-30s extra) y distorsionan todas las métricas.
            # A diferencia del conteo, aquí SÍ incluimos VSC/SC: aunque son
            # artificialmente lentas por el reglamento, siguen siendo representativas
            # del comportamiento del coche.
            # pick_wo_box() se guarda en variable para no encadenar la llamada tres veces.
            laps_for_stats = driver_laps.pick_wo_box()
            laps_for_stats = laps_for_stats[
                laps_for_stats["LapTime"].notna()
                & ~laps_for_stats["Deleted"].fillna(False)
            ]

            if laps_for_stats.empty:
                response_data[driver_abbr] = None
                continue

            # Convertimos la columna LapTime (Timedelta) a segundos float para
            # poder operar con las funciones estadísticas estándar de pandas/numpy.
            lap_times_s = laps_for_stats["LapTime"].dt.total_seconds()
            mean_s = lap_times_s.mean()
            median_s = lap_times_s.median()
            std_s = lap_times_s.std()  # ddof=1 por defecto (estimación muestral)

            # pick_fastest(only_by_time=True) opera sobre el conjunto ya filtrado.
            # only_by_time=True ignora el flag IsPersonalBest y busca el mínimo puro,
            # evitando que una vuelta marcada como PB pero luego borrada interfiera.
            best_lap = laps_for_stats.pick_fastest(only_by_time=True)

            if best_lap is None:
                response_data[driver_abbr] = None
                continue

            # ---- CONSISTENCY ----
            # Fórmula derivada del coeficiente de variación inverso.
            # Un piloto con std=0 tendría 100% (vueltas idénticas).
            consistency = round((1 - std_s / mean_s) * 100, 2) if mean_s > 0 else 0.0

            # ---- STRATEGY: secuencia de compuestos por stint ----
            # Usamos driver_laps completas (no laps_for_stats) para no perder
            # las vueltas de pit que marcan el cambio de stint y compuesto.
            # dropna() sobre Stint y Compound antes de agrupar previene que una vuelta
            # con datos incompletos genere un stint fantasma en el groupby.
            # El detalle analítico de cada stint (duración, media, mediana...)
            # se sirve en el endpoint /stints, no aquí.
            strategy = []
            stint_groups = driver_laps.dropna(subset=["Stint", "Compound"]).groupby(
                "Stint", sort=True
            )

            for _, stint_laps in stint_groups:
                # Tomamos el compuesto de la primera vuelta del stint.
                # Es más fiable que el modo estadístico porque FastF1 puede registrar
                # un compuesto distinto en vueltas de transición.
                compound_raw = str(stint_laps["Compound"].iloc[0]).upper()
                compound_info = COMPOUND_COLORS.get(
                    compound_raw, {"bg": "#888888", "label": "?"}
                )
                strategy.append(
                    {
                        "compound": compound_raw,
                        "color": compound_info["bg"],
                        "label": compound_info["label"],
                    }
                )

            # ---- CONSTRUCCIÓN DEL DTO FINAL ----
            # Reutilizamos format_timedelta() convirtiendo los floats estadísticos
            # a pd.Timedelta para no duplicar lógica de formateo.
            # El casting explícito a float/int es CRÍTICO: los tipos nativos de
            # Numpy (float64, int64) rompen el serializador JSON de FastAPI.
            response_data[driver_abbr] = {
                "best_lap": {
                    "time": format_timedelta(best_lap["LapTime"]),
                    "lap_number": int(best_lap["LapNumber"])
                    if pd.notna(best_lap["LapNumber"])
                    else None,
                },
                "average": format_timedelta(pd.to_timedelta(mean_s, unit="s")),
                "median": format_timedelta(pd.to_timedelta(median_s, unit="s")),
                "std_dev": format_timedelta(pd.to_timedelta(std_s, unit="s")),
                "consistency": float(consistency),
                "valid_laps": int(len(laps_for_count)),
                "strategy": strategy,
            }

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
