"""
TFG Formula 1 API
Backend de análisis de telemetría F1 con FastAPI + FastF1.
"""

import asyncio
import os
import fastf1
import fastf1.plotting
import pandas as pd
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


from telemetry import router as telemetry_router


# ── Configuración de caché ────────────────────────────────────────────────────

_HDD_PATH = os.path.join("E:" + os.sep, "TFG_F1_Cache")
_LOCAL_PATH = "fastf1_cache_local"


def _setup_cache() -> str:
    """Selecciona la ruta de caché: HDD externo si está disponible, local si no."""
    if os.path.exists("E:" + os.sep):
        os.makedirs(_HDD_PATH, exist_ok=True)
        print(f"✅ Caché en HDD: {_HDD_PATH}")
        return _HDD_PATH
    print(f"⚠️  HDD no detectado. Usando caché local: {_LOCAL_PATH}")
    return _LOCAL_PATH


fastf1.Cache.enable_cache(_setup_cache())


# ── Constantes ────────────────────────────────────────────────────────────────

MIN_YEAR = 2018
MAX_YEAR = 2025  # Actualizar con cada nueva temporada

COMPOUNDS = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]


# ── DTOs (Contratos Backend → Frontend) ──────────────────────────────────────


class EventDTO(BaseModel):
    """Gran Premio del calendario de una temporada."""

    round_number: int = Field(..., description="Número de ronda en la temporada")
    event_name: str = Field(..., description="Nombre oficial del Gran Premio")
    country: str = Field(..., description="País del circuito")


class SessionDTO(BaseModel):
    """Sesión disponible dentro de un Gran Premio."""

    id: str = Field(
        ..., description="Identificador de sesión: R, Q, FP1, FP2, FP3, S, SS"
    )
    date: str | None = Field(None, description="Fecha en formato ISO 8601")


class DriverDTO(BaseModel):
    """Piloto con sus colores de equipo para las visualizaciones del frontend."""

    driver_number: str
    abbreviation: str
    full_name: str
    team_name: str
    team_color: str = Field(..., description="Color primario del equipo en HEX")
    driver_color: str = Field(..., description="Color diferenciado por piloto en HEX")


class DriversResponseDTO(BaseModel):
    """Pilotos y colores de compuestos de una sesión."""

    drivers: list[DriverDTO]
    compounds: dict[str, str] = Field(
        ..., description="Mapa compuesto → color HEX oficial F1"
    )


# ── Inicialización de la app ──────────────────────────────────────────────────

app = FastAPI(
    title="TFG Formula 1 API",
    description="Backend de análisis de telemetría F1, inspirado en Tracing Insights.",
    version="1.0.0",
)

# CORS: autoriza el tráfico del cliente React local (puerto 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry_router)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _lighten_color(hex_color: str, factor: float = 0.4) -> str:
    """Aclara un color HEX mezclándolo con blanco.

    Usado para diferenciar visualmente a los compañeros de equipo en las gráficas,
    ya que comparten el mismo color base de equipo.

    Args:
        hex_color: Color en formato HEX, con o sin '#'.
        factor: Intensidad del aclarado (0.0 = sin cambio, 1.0 = blanco puro).

    Returns:
        Color aclarado en formato HEX con '#'.
    """
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    r = int(r + (255 - r) * factor)
    g = int(g + (255 - g) * factor)
    b = int(b + (255 - b) * factor)
    return f"#{r:02x}{g:02x}{b:02x}"


def _normalize_hex(raw: str, fallback: str = "ffffff") -> str:
    """Normaliza y valida un color HEX recibido de FastF1.

    FastF1 puede devolver valores vacíos, 'nan' o sin el prefijo '#'.
    """
    color = str(raw).strip().lower()
    return color if color and color != "nan" else fallback


# ── Endpoints: Filtros de sesión (SidebarFilter del frontend) ─────────────────


@app.get(
    "/api/schedule/{year}",
    response_model=list[EventDTO],
    tags=["Filtros"],
    summary="Calendario de una temporada",
)
async def get_schedule(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
) -> list[EventDTO]:
    """Devuelve todos los Grandes Premios de una temporada.

    FastF1 es síncrono, por lo que se delega en un thread pool
    para no bloquear el event loop de FastAPI.
    """
    try:
        schedule = await asyncio.to_thread(fastf1.get_event_schedule, year)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo obtener el calendario de FastF1: {e}",
        )

    return [
        EventDTO(
            round_number=int(row["RoundNumber"]),
            event_name=str(row["EventName"]),
            country=str(row["Country"]),
        )
        for _, row in schedule.iterrows()
    ]


@app.get(
    "/api/schedule/{year}/{event_name}/sessions",
    response_model=list[SessionDTO],
    tags=["Filtros"],
    summary="Sesiones de un Gran Premio",
)
async def get_sessions(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
) -> list[SessionDTO]:
    """Devuelve las sesiones disponibles para un Gran Premio específico.

    Detecta dinámicamente las claves 'SessionN' del objeto Event de FastF1,
    lo que garantiza compatibilidad con formatos de fin de semana no estándar
    (ej: Sprint, Sprint Shootout).
    """
    try:
        event = await asyncio.to_thread(fastf1.get_event, year, event_name)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Gran Premio '{event_name}' ({year}) no encontrado: {e}",
        )

    session_keys = [
        k for k in event.index if k.startswith("Session") and k[-1].isdigit()
    ]

    return [
        SessionDTO(
            id=str(event.get(key)),
            date=event.get(f"{key}Date").isoformat()
            if pd.notna(event.get(f"{key}Date"))
            else None,
        )
        for key in session_keys
        if pd.notna(event.get(key))
    ]


@app.get(
    "/api/session/{year}/{event_name}/{session_name}/drivers",
    response_model=DriversResponseDTO,
    tags=["Filtros"],
    summary="Pilotos y colores de compuestos de una sesión",
)
async def get_drivers(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
    session_name: str = Path(
        ..., description="Tipo de sesión: R, Q, FP1, FP2, FP3, S, SS"
    ),
) -> DriversResponseDTO:
    """Devuelve los pilotos de una sesión con sus colores para las gráficas.

    Cuando dos pilotos comparten equipo, el segundo recibe una versión aclarada
    del color de equipo para poder diferenciarlos visualmente.

    Carga la sesión sin telemetría ni datos de vuelta para minimizar
    la latencia de este endpoint de selección.
    """
    try:
        session = fastf1.get_session(year, event_name, session_name)
        await asyncio.to_thread(
            session.load, laps=False, telemetry=False, weather=False, messages=False
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Sesión '{session_name}' de '{event_name}' ({year}) no encontrada: {e}",
        )

    drivers: list[DriverDTO] = []
    seen_teams: set[str] = set()

    for _, info in session.results.iterrows():
        team_color = _normalize_hex(info.get("TeamColor", ""))

        try:
            driver_color = fastf1.plotting.get_driver_color(
                info["Abbreviation"], session
            )
        except Exception:
            driver_color = f"#{team_color}"

        # El segundo piloto del mismo equipo recibe el color aclarado
        team_name = str(info["TeamName"])
        if team_name in seen_teams:
            driver_color = _lighten_color(driver_color)
        else:
            seen_teams.add(team_name)

        drivers.append(
            DriverDTO(
                driver_number=str(info["DriverNumber"]),
                abbreviation=str(info["Abbreviation"]),
                full_name=str(info["FullName"]),
                team_name=team_name,
                team_color=f"#{team_color}",
                driver_color=driver_color,
            )
        )

    compounds: dict[str, str] = {}
    for compound in COMPOUNDS:
        try:
            compounds[compound] = fastf1.plotting.get_compound_color(compound, session)
        except Exception as e:
            print(f"[DEBUG get_drivers] compound='{compound}' error='{e}'")
            compounds[compound] = "#888888"

    return DriversResponseDTO(
        drivers=sorted(drivers, key=lambda d: d.abbreviation),
        compounds=compounds,
    )


"""
Módulo de análisis de vueltas por sesión.

Expone el endpoint de datos de vuelta, pre-agrupados por número de vuelta
para que el frontend pueda renderizar la tabla directamente sin transformaciones.
"""


# ── Caché en memoria ──────────────────────────────────────────────────────────
#
# Misma estrategia que telemetry.py: evita recargar la sesión si ya fue
# solicitada. Aquí cargamos sin telemetría ya que solo necesitamos metadata.
#
_session_cache: dict[str, fastf1.core.Session] = {}


async def _load_session(
    year: int, event_name: str, session_name: str
) -> fastf1.core.Session:
    """Carga una sesión sin telemetría usando caché en memoria."""
    cache_key = f"{year}_{event_name}_{session_name}"
    if cache_key not in _session_cache:
        session = fastf1.get_session(year, event_name, session_name)
        await asyncio.to_thread(
            session.load, telemetry=False, weather=False, messages=False
        )
        _session_cache[cache_key] = session
    return _session_cache[cache_key]


# ── DTOs ──────────────────────────────────────────────────────────────────────


class LapDTO(BaseModel):
    """Datos de una vuelta individual de un piloto."""

    lap_time: str | None = Field(None, description="Tiempo total en formato M:SS.mmm")
    lap_time_seconds: float | None = Field(
        None, description="Tiempo en segundos para gráficas y ordenación"
    )
    is_fastest_lap: bool = Field(
        False, description="True solo en la vuelta más rápida del piloto"
    )
    sector1: str | None = Field(None, description="Sector 1 en formato SS.mmm")
    sector2: str | None = Field(None, description="Sector 2 en formato SS.mmm")
    sector3: str | None = Field(None, description="Sector 3 en formato SS.mmm")
    compound: str | None = Field(
        None, description="SOFT, MEDIUM, HARD, INTERMEDIATE, WET"
    )
    tyre_life: int | None = Field(None, description="Vueltas de vida del neumático")
    stint: int | None = Field(None, description="Número de stint")
    position: int | None = Field(
        None, description="Posición en pista al finalizar la vuelta"
    )
    track_status: str | None = Field(
        None, description="1=verde · 2=VSC · 4=SC · 5=roja"
    )
    is_personal_best: bool = Field(
        ...,
        description="FastF1 puede marcarlo True en múltiples vueltas. Usar is_fastest_lap para destacar una sola.",
    )
    is_accurate: bool = Field(..., description="False si es in/out lap o hay SC/VSC")
    deleted: bool = Field(..., description="Vuelta eliminada por los comisarios")
    pit_in: bool = Field(..., description="El piloto entró a boxes en esta vuelta")
    pit_out: bool = Field(..., description="El piloto salió de boxes en esta vuelta")


class LapRowDTO(BaseModel):
    """Fila de la tabla: una vuelta con los datos de todos los pilotos seleccionados."""

    lap_number: int
    entries: dict[str, LapDTO | None] = Field(
        ...,
        description="Mapa abbreviation → LapDTO. None si el piloto no tiene dato para esa vuelta.",
    )


class LapsResponseDTO(BaseModel):
    """
    Respuesta pre-agrupada para renderizado directo en el frontend.
    'drivers' define el orden de las columnas; 'laps' define las filas.
    """

    drivers: list[str] = Field(
        ..., description="Abreviaturas en el mismo orden que el request"
    )
    laps: list[LapRowDTO]


# ── Helpers ───────────────────────────────────────────────────────────────────


def _format_timedelta(td) -> str | None:
    """Convierte un Timedelta de Pandas a string legible M:SS.mmm o SS.mmm.

    Resuelve la incompatibilidad de serialización JSON de los objetos Timedelta
    y delega el formateo al backend para no cargar al cliente React.
    """
    if pd.isna(td):
        return None
    total_seconds = td.total_seconds()
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds * 1000) % 1000)
    if minutes > 0:
        return f"{minutes}:{seconds:02d}.{milliseconds:03d}"
    return f"{seconds}.{milliseconds:03d}"


def _build_lap_dto(lap: pd.Series) -> LapDTO:
    """Serializa una fila del DataFrame de FastF1 al DTO de vuelta.

    Realiza casting explícito a tipos primitivos Python para evitar que los
    tipos nativos de NumPy (int64, bool_) rompan el serializador JSON de FastAPI.
    """
    total_s = lap["LapTime"].total_seconds() if pd.notna(lap["LapTime"]) else None
    return LapDTO(
        lap_time=_format_timedelta(lap["LapTime"]),
        lap_time_seconds=round(total_s, 3) if total_s is not None else None,
        is_fastest_lap=False,  # se sobreescribe tras agrupar
        sector1=_format_timedelta(lap["Sector1Time"]),
        sector2=_format_timedelta(lap["Sector2Time"]),
        sector3=_format_timedelta(lap["Sector3Time"]),
        compound=str(lap["Compound"]) if pd.notna(lap["Compound"]) else None,
        tyre_life=int(lap["TyreLife"]) if pd.notna(lap["TyreLife"]) else None,
        stint=int(lap["Stint"]) if pd.notna(lap["Stint"]) else None,
        position=int(lap["Position"]) if pd.notna(lap["Position"]) else None,
        track_status=str(lap["TrackStatus"]) if pd.notna(lap["TrackStatus"]) else None,
        is_personal_best=bool(lap["IsPersonalBest"]),
        is_accurate=bool(lap["IsAccurate"]),
        deleted=bool(lap["Deleted"]),
        pit_in=pd.notna(lap["PitInTime"]),
        pit_out=pd.notna(lap["PitOutTime"]),
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────


@app.get(
    "/api/analysis/{year}/{event_name}/{session_name}/laps",
    response_model=LapsResponseDTO,
    tags=["Análisis"],
    summary="Datos de vuelta agrupados por número de vuelta",
)
async def get_lap_data(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
    session_name: str = Path(
        ..., description="Tipo de sesión: Race, Qualifying, Practice 1…"
    ),
    drivers: str = Query(
        ...,
        description="Abreviaturas de pilotos separadas por coma",
        example="ALO,SAI,VER",
    ),
) -> LapsResponseDTO:
    """
    Devuelve los datos de vuelta agrupados por número de vuelta,
    listos para renderizar una tabla donde filas = vueltas y columnas = pilotos.

    El campo 'entries' de cada fila contiene un mapa piloto → datos,
    con None si el piloto no tiene registro para esa vuelta concreta.
    """
    try:
        session = await _load_session(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sesión no encontrada: {e}")

    driver_list = [d.strip().upper() for d in drivers.split(",")]
    laps = session.laps.pick_drivers(driver_list)

    # Agrupamos por número de vuelta: {lap_number: {driver: LapDTO}}
    grouped: dict[int, dict[str, LapDTO]] = {}
    for _, lap in laps.iterrows():
        if pd.isna(lap["LapNumber"]):
            continue
        lap_number = int(lap["LapNumber"])
        driver = str(lap["Driver"])
        if lap_number not in grouped:
            grouped[lap_number] = {}
        grouped[lap_number][driver] = _build_lap_dto(lap)

    # Marcamos is_fastest_lap=True usando pick_fastest de FastF1
    for driver in driver_list:
        fastest = laps.pick_drivers(driver).pick_fastest(only_by_time=True)
        if fastest is not None and pd.notna(fastest["LapNumber"]):
            lap_num = int(fastest["LapNumber"])
            if lap_num in grouped and driver in grouped[lap_num]:
                grouped[lap_num][driver].is_fastest_lap = True

    # Construimos las filas ordenadas, rellenando con None los pilotos sin dato
    lap_rows = [
        LapRowDTO(
            lap_number=lap_num,
            entries={driver: grouped[lap_num].get(driver) for driver in driver_list},
        )
        for lap_num in sorted(grouped)
    ]

    return LapsResponseDTO(drivers=driver_list, laps=lap_rows)


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
# ENDPOINT: Summary Statistics
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


@app.get("/api/analysis/{year}/{event_name}/{session_name}/stints")
async def get_stint_analysis(
    year: int, event_name: str, session_name: str, drivers: str
):
    """
    Devuelve las métricas estadísticas de cada stint para los pilotos seleccionados.

    **Métricas por stint:** `duration`, `best_lap`, `average`, `median`, `std_dev`, `consistency`

    - Las vueltas de pit in/out se excluyen de las estadísticas pero sí cuentan en la duración.
    - Si un piloto no tiene datos para un stint (estrategias distintas), su valor es `null`.
    """
    try:
        session = fastf1.get_session(year, event_name, session_name)
        session.load(telemetry=False, weather=False, messages=False)

        driver_list = [d.strip().upper() for d in drivers.split(",")]
        all_laps = session.laps.pick_drivers(driver_list)

        # Recogemos los stints de todos los pilotos para una respuesta simétrica:
        # si el piloto A tiene 4 stints y el B tiene 3, el stint 4 aparece con
        # datos del piloto A y null en el piloto B.
        all_stint_numbers = sorted(
            int(s) for s in all_laps.dropna(subset=["Stint"])["Stint"].unique()
        )

        response_stints = []

        for stint_num in all_stint_numbers:
            stint_entry = {"stint_number": stint_num, "drivers": {}}

            for driver_abbr in driver_list:
                driver_laps = all_laps[all_laps["Driver"] == driver_abbr]

                # Aislamos el stint actual ordenado por vuelta.
                # reset_index() reindexia desde 0 para que iloc funcione
                # correctamente tras el filtrado y el sort.
                stint_laps_all = (
                    driver_laps[driver_laps["Stint"] == stint_num]
                    .copy()
                    .sort_values("LapNumber")
                    .reset_index(drop=True)
                )

                if stint_laps_all.empty:
                    stint_entry["drivers"][driver_abbr] = None
                    continue

                # Tomamos el compuesto de la primera vuelta del stint, más fiable
                # que el modo estadístico en vueltas de transición o cambio de box.
                compound_raw = str(stint_laps_all["Compound"].iloc[0]).upper()
                compound_info = COMPOUND_COLORS.get(
                    compound_raw, {"bg": "#888888", "label": "?"}
                )

                # DURACIÓN: sumamos todas las vueltas con tiempo válido del stint,
                # incluida la pit in. Comprobamos .empty antes porque pd.Timedelta(0)
                # es falsy y "sum() or None" daría None incorrectamente.
                valid_times = stint_laps_all["LapTime"].dropna()
                total_duration_td = valid_times.sum() if not valid_times.empty else None

                # ESTADÍSTICAS: excluimos vueltas borradas por comisarios y sin tiempo.
                # Las vueltas de VSC/SC se mantienen: son representativas del ritmo del coche.
                # pick_wo_box() no se usa aquí porque stint_laps_all ya está filtrado
                # por stint y las pit in/out pertenecen a stints de transición.
                laps_for_stats = stint_laps_all[
                    ~stint_laps_all["Deleted"].fillna(False)
                ]
                laps_for_stats = laps_for_stats[laps_for_stats["LapTime"].notna()]

                if laps_for_stats.empty:
                    stint_entry["drivers"][driver_abbr] = {
                        "compound": compound_raw,
                        "compound_color": compound_info["bg"],
                        "compound_label": compound_info["label"],
                        "duration_laps": int(len(stint_laps_all)),
                        "duration_time": format_timedelta(total_duration_td),
                        "best_lap": None,
                        "average": None,
                        "median": None,
                        "std_dev": None,
                        "consistency": None,
                    }
                    continue

                # Convertimos LapTime a segundos float para operar con pandas/numpy.
                lap_times_s = laps_for_stats["LapTime"].dt.total_seconds()

                # pick_fastest(only_by_time=True) ignora IsPersonalBest y busca
                # el mínimo puro sobre el conjunto ya filtrado.
                best_lap = laps_for_stats.pick_fastest(only_by_time=True)

                # Posición relativa de la mejor vuelta dentro del stint.
                # Usamos stint_laps_all como referencia para que "Lap 6" signifique
                # la 6ª vuelta del stint aunque alguna haya sido filtrada de las stats.
                lap_in_stint = int(
                    (stint_laps_all["LapNumber"] <= int(best_lap["LapNumber"])).sum()
                )

                mean_s, median_s, std_s = (
                    lap_times_s.mean(),
                    lap_times_s.median(),
                    lap_times_s.std(),  # ddof=1 por defecto (estimación muestral)
                )

                # std_dev se serializa como "X.XXXs" porque la desviación de un stint
                # siempre es de segundos y el formato M:SS.mmm sería ilegible aquí.
                consistency = (
                    round((1 - std_s / mean_s) * 100, 1)
                    if mean_s > 0 and pd.notna(std_s)
                    else None
                )

                # Casting explícito a tipos Python: los tipos Numpy (float64, int64)
                # rompen el serializador JSON de FastAPI.
                stint_entry["drivers"][driver_abbr] = {
                    "compound": compound_raw,
                    "compound_color": compound_info["bg"],
                    "compound_label": compound_info["label"],
                    "duration_laps": int(len(stint_laps_all)),
                    "duration_time": format_timedelta(total_duration_td),
                    "best_lap": {
                        "time": format_timedelta(best_lap["LapTime"]),
                        "lap_in_stint": lap_in_stint,
                    },
                    "average": format_timedelta(pd.to_timedelta(mean_s, unit="s")),
                    "median": format_timedelta(pd.to_timedelta(median_s, unit="s")),
                    "std_dev": f"{std_s:.3f}s" if pd.notna(std_s) else None,
                    "consistency": float(consistency)
                    if consistency is not None
                    else None,
                }

            response_stints.append(stint_entry)

        return response_stints

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
