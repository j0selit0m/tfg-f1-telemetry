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


"""
Módulo de estadísticas resumen por piloto.

Calcula métricas agregadas de rendimiento (mejor vuelta, media, mediana,
consistencia, vueltas válidas y estrategia de neumáticos) para una sesión
y un conjunto de pilotos seleccionados.
"""

# Etiquetas cortas de compuestos. FastF1 expone los colores pero no las letras,
# por eso este mapa pequeño se mantiene local.
_COMPOUND_LABELS: dict[str, str] = {
    "SOFT": "S",
    "MEDIUM": "M",
    "HARD": "H",
    "INTERMEDIATE": "I",
    "WET": "W",
}


# ── DTOs ──────────────────────────────────────────────────────────────────────


class BestLapDTO(BaseModel):
    time: str | None = Field(None, description="Tiempo en formato M:SS.mmm")
    lap_number: int | None = Field(None, description="Número de la vuelta más rápida")


class StintCompoundDTO(BaseModel):
    """Compuesto usado en un stint, listo para renderizar como pill/chip."""

    compound: str = Field(..., description="SOFT, MEDIUM, HARD, INTERMEDIATE, WET")
    color: str = Field(..., description="Color HEX oficial F1 (dinámico por temporada)")
    label: str = Field(..., description="Letra corta: S, M, H, I, W")


class DriverSummaryDTO(BaseModel):
    """Estadísticas resumen de un piloto en una sesión."""

    best_lap: BestLapDTO
    average: str | None = Field(None, description="Media de tiempos válidos, M:SS.mmm")
    median: str | None = Field(None, description="Mediana de tiempos válidos, M:SS.mmm")
    std_dev: str | None = Field(None, description="Desviación estándar, SS.mmm")
    consistency: float = Field(
        ..., description="(1 - std/mean) * 100. 100 = vueltas idénticas"
    )
    valid_laps: int = Field(
        ..., description="Vueltas completadas no borradas (incluye VSC/SC)"
    )
    strategy: list[StintCompoundDTO] = Field(
        ..., description="Secuencia de compuestos por stint en orden"
    )


class SummaryResponseDTO(BaseModel):
    """Estructura coherente con el endpoint de vueltas: drivers + mapa de summaries."""

    drivers: list[str] = Field(..., description="Pilotos en el orden del request")
    summaries: dict[str, DriverSummaryDTO | None] = Field(
        ...,
        description="Mapa abbreviation → DriverSummaryDTO. None si el piloto no tiene datos válidos.",
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _build_strategy(
    driver_laps: pd.DataFrame, session: fastf1.core.Session
) -> list[StintCompoundDTO]:
    """Construye la secuencia de compuestos por stint con colores oficiales FastF1.

    Toma el compuesto de la primera vuelta del stint en vez del modo estadístico:
    FastF1 puede registrar un compuesto distinto en vueltas de transición y la
    primera vuelta es siempre la fuente de verdad.
    """
    strategy: list[StintCompoundDTO] = []
    stint_groups = driver_laps.dropna(subset=["Stint", "Compound"]).groupby(
        "Stint", sort=True
    )

    for _, stint_laps in stint_groups:
        compound = str(stint_laps["Compound"].iloc[0]).upper()
        try:
            color = fastf1.plotting.get_compound_color(compound, session)
        except Exception:
            color = "#888888"
        strategy.append(
            StintCompoundDTO(
                compound=compound,
                color=color,
                label=_COMPOUND_LABELS.get(compound, "?"),
            )
        )
    return strategy


def _build_driver_summary(
    driver_laps: pd.DataFrame, session: fastf1.core.Session
) -> DriverSummaryDTO | None:
    """Calcula todas las estadísticas para un piloto. None si no hay datos válidos.

    Aplica dos filtros distintos según el caso:
      - Conteo de vueltas: incluye VSC/SC/pit (criterio Tracing Insights).
        Solo se descartan vueltas sin tiempo o borradas por los comisarios.
      - Estadísticas: además excluye pit in/out con pick_wo_box(), ya que
        incluyen ~20-30s del pit stop y distorsionarían todas las métricas.
        Se mantienen las vueltas bajo VSC/SC porque siguen siendo
        representativas del comportamiento del coche.
    """
    if driver_laps.empty:
        return None

    valid_for_count = driver_laps[
        driver_laps["LapTime"].notna() & ~driver_laps["Deleted"].fillna(False)
    ]

    laps_for_stats = driver_laps.pick_wo_box()
    laps_for_stats = laps_for_stats[
        laps_for_stats["LapTime"].notna() & ~laps_for_stats["Deleted"].fillna(False)
    ]

    if laps_for_stats.empty:
        return None

    lap_times_s = laps_for_stats["LapTime"].dt.total_seconds()
    mean_s = lap_times_s.mean()
    median_s = lap_times_s.median()
    std_s = lap_times_s.std()  # ddof=1 por defecto (estimación muestral)

    # only_by_time=True ignora IsPersonalBest y busca el mínimo puro,
    # evitando que una vuelta marcada como PB pero luego borrada interfiera.
    best_lap = laps_for_stats.pick_fastest(only_by_time=True)
    if best_lap is None:
        return None

    consistency = round((1 - std_s / mean_s) * 100, 2) if mean_s > 0 else 0.0

    return DriverSummaryDTO(
        best_lap=BestLapDTO(
            time=_format_timedelta(best_lap["LapTime"]),
            lap_number=int(best_lap["LapNumber"])
            if pd.notna(best_lap["LapNumber"])
            else None,
        ),
        average=_format_timedelta(pd.to_timedelta(mean_s, unit="s")),
        median=_format_timedelta(pd.to_timedelta(median_s, unit="s")),
        std_dev=_format_timedelta(pd.to_timedelta(std_s, unit="s")),
        consistency=float(consistency),
        valid_laps=int(len(valid_for_count)),
        strategy=_build_strategy(driver_laps, session),
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────


@app.get(
    "/api/analysis/{year}/{event_name}/{session_name}/summary",
    response_model=SummaryResponseDTO,
    tags=["Análisis"],
    summary="Estadísticas resumen por piloto",
)
async def get_summary_stats(
    year: int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name: str = Path(..., min_length=2, description="Nombre del Gran Premio"),
    session_name: str = Path(..., description="Tipo de sesión: Race, Qualifying..."),
    drivers: str = Query(
        ...,
        description="Abreviaturas de pilotos separadas por coma",
        example="ALO,SAI,VER",
    ),
) -> SummaryResponseDTO:
    """
    Devuelve estadísticas agregadas por piloto: mejor vuelta, media, mediana,
    desviación estándar, índice de consistencia, vueltas válidas y estrategia
    de neumáticos.

    **Criterios de filtrado:**
    - Conteo de vueltas: incluye VSC/SC/pit, excluye solo borradas y sin tiempo.
    - Estadísticas: excluye pit in/out (distorsionan ~20-30s).
    - Consistencia: (1 - std/mean) * 100. Cuanto más alto, vueltas más uniformes.
    """
    try:
        session = await _load_session(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sesión no encontrada: {e}")

    driver_list = [d.strip().upper() for d in drivers.split(",")]
    all_laps = session.laps.pick_drivers(driver_list)

    summaries: dict[str, DriverSummaryDTO | None] = {}
    for driver_abbr in driver_list:
        driver_laps = all_laps[all_laps["Driver"] == driver_abbr].copy()
        summaries[driver_abbr] = _build_driver_summary(driver_laps, session)

    return SummaryResponseDTO(drivers=driver_list, summaries=summaries)


"""
Módulo de análisis de stints por piloto.
 
Devuelve métricas estadísticas por stint (duración, mejor vuelta, media,
mediana, desviación estándar y consistencia) para los pilotos seleccionados.
La respuesta es simétrica: si un piloto no tiene datos para un stint concreto,
su valor es null en lugar de omitirse.
"""

# ── DTOs ──────────────────────────────────────────────────────────────────────
 
class StintBestLapDTO(BaseModel):
    time:         str | None = Field(None, description="Tiempo en formato M:SS.mmm")
    lap_in_stint: int | None = Field(None, description="Posición de la vuelta dentro del stint")
 
 
class StintDriverDTO(BaseModel):
    """Métricas de un piloto para un stint concreto."""
    compound:       str            = Field(..., description="SOFT, MEDIUM, HARD, INTERMEDIATE, WET")
    compound_color: str            = Field(..., description="Color HEX oficial F1 de esa temporada")
    compound_label: str            = Field(..., description="Letra corta: S, M, H, I, W")
    duration_laps:  int            = Field(..., description="Total de vueltas del stint")
    duration_time:  str | None     = Field(None, description="Tiempo total del stint en M:SS.mmm")
    best_lap:       StintBestLapDTO | None = Field(None, description="Mejor vuelta del stint")
    average:        str | None     = Field(None, description="Media de tiempos válidos en M:SS.mmm")
    median:         str | None     = Field(None, description="Mediana de tiempos válidos en M:SS.mmm")
    std_dev:        str | None     = Field(None, description="Desviación estándar en SS.mmm")
    consistency:    float | None   = Field(None, description="(1 - std/mean) * 100")
 
 
class StintEntryDTO(BaseModel):
    """Un stint con los datos de todos los pilotos seleccionados."""
    stint_number: int
    drivers: dict[str, StintDriverDTO | None] = Field(
        ...,
        description="Mapa abbreviation → StintDriverDTO. None si el piloto no tiene ese stint.",
    )
 
 
class StintsResponseDTO(BaseModel):
    """Estructura consistente con el resto de endpoints de análisis."""
    drivers: list[str]          = Field(..., description="Pilotos en el orden del request")
    stints:  list[StintEntryDTO]
 
 
# ── Helpers ───────────────────────────────────────────────────────────────────
 
def _format_timedelta(td) -> str | None:
    """Convierte un Timedelta de Pandas a string legible M:SS.mmm o SS.mmm."""
    if pd.isna(td):
        return None
    total_seconds = td.total_seconds()
    minutes      = int(total_seconds // 60)
    seconds      = int(total_seconds % 60)
    milliseconds = int((total_seconds * 1000) % 1000)
    if minutes > 0:
        return f"{minutes}:{seconds:02d}.{milliseconds:03d}"
    return f"{seconds}.{milliseconds:03d}"
 
 
def _get_compound_color(compound: str, session: fastf1.core.Session) -> str:
    """Obtiene el color oficial del compuesto con fallback a colores hardcodeados."""
    _FALLBACK: dict[str, str] = {
        "SOFT":         "#da291c",
        "MEDIUM":       "#ffd600",
        "HARD":         "#f0f0ec",
        "INTERMEDIATE": "#39b54a",
        "WET":          "#0067ff",
    }
    try:
        return fastf1.plotting.get_compound_color(compound, session)
    except Exception:
        return _FALLBACK.get(compound, "#888888")
 
 
def _build_stint_driver(
    stint_laps_all: pd.DataFrame,
    compound:       str,
    session:        fastf1.core.Session,
) -> StintDriverDTO:
    """Calcula las métricas de un piloto para un stint concreto.
 
    Las pit in/out NO se excluyen con pick_wo_box() porque stint_laps_all
    ya está filtrado por stint — las vueltas de transición pertenecen a
    stints distintos. Sí se excluyen vueltas borradas y sin tiempo registrado.
    """
    valid_times      = stint_laps_all["LapTime"].dropna()
    total_duration   = valid_times.sum() if not valid_times.empty else None
 
    laps_for_stats = stint_laps_all[
        stint_laps_all["LapTime"].notna() & ~stint_laps_all["Deleted"].fillna(False)
    ]
 
    base = dict(
        compound=       compound,
        compound_color= _get_compound_color(compound, session),
        compound_label= _COMPOUND_LABELS.get(compound, "?"),
        duration_laps=  int(len(stint_laps_all)),
        duration_time=  _format_timedelta(total_duration),
    )
 
    if laps_for_stats.empty:
        return StintDriverDTO(**base, best_lap=None, average=None, median=None, std_dev=None, consistency=None)
 
    lap_times_s = laps_for_stats["LapTime"].dt.total_seconds()
    mean_s      = lap_times_s.mean()
    median_s    = lap_times_s.median()
    std_s       = lap_times_s.std()  # ddof=1 (estimación muestral)
 
    best_lap    = laps_for_stats.pick_fastest(only_by_time=True)
 
    # Posición relativa de la mejor vuelta dentro del stint.
    # Se usa stint_laps_all como referencia para que "Lap 6" signifique
    # la 6ª vuelta del stint aunque alguna haya sido filtrada de las stats.
    lap_in_stint = int(
        (stint_laps_all["LapNumber"] <= int(best_lap["LapNumber"])).sum()
    ) if pd.notna(best_lap["LapNumber"]) else None
 
    consistency = (
        round((1 - std_s / mean_s) * 100, 1)
        if mean_s > 0 and pd.notna(std_s)
        else None
    )
 
    return StintDriverDTO(
        **base,
        best_lap=StintBestLapDTO(
            time=         _format_timedelta(best_lap["LapTime"]),
            lap_in_stint= lap_in_stint,
        ),
        average=     _format_timedelta(pd.to_timedelta(mean_s,   unit="s")),
        median=      _format_timedelta(pd.to_timedelta(median_s, unit="s")),
        std_dev=     _format_timedelta(pd.to_timedelta(std_s,    unit="s")),
        consistency= float(consistency) if consistency is not None else None,
    )
 
 
# ── Endpoint ──────────────────────────────────────────────────────────────────
 
@app.get(
    "/api/analysis/{year}/{event_name}/{session_name}/stints",
    response_model=StintsResponseDTO,
    tags=["Análisis"],
    summary="Métricas estadísticas por stint",
)
async def get_stint_analysis(
    year:         int = Path(..., ge=MIN_YEAR, le=MAX_YEAR, description="Temporada F1"),
    event_name:   str = Path(..., min_length=2,             description="Nombre del Gran Premio"),
    session_name: str = Path(...,                           description="Tipo de sesión: Race, Qualifying..."),
    drivers:      str = Query(
        ...,
        description="Abreviaturas de pilotos separadas por coma",
        example="ALO,SAI",
    ),
) -> StintsResponseDTO:
    """
    Devuelve las métricas estadísticas de cada stint para los pilotos seleccionados.
 
    La respuesta es simétrica: si el piloto A tiene 4 stints y el B tiene 3,
    el stint 4 aparece con datos del piloto A y null en el piloto B.
    """
    try:
        session = await _load_session(year, event_name, session_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Sesión no encontrada: {e}")
 
    driver_list = [d.strip().upper() for d in drivers.split(",")]
    all_laps    = session.laps.pick_drivers(driver_list)
 
    all_stint_numbers = sorted(
        int(s) for s in all_laps.dropna(subset=["Stint"])["Stint"].unique()
    )
 
    stints: list[StintEntryDTO] = []
 
    for stint_num in all_stint_numbers:
        drivers_data: dict[str, StintDriverDTO | None] = {}
 
        for driver_abbr in driver_list:
            stint_laps = (
                all_laps[
                    (all_laps["Driver"] == driver_abbr) &
                    (all_laps["Stint"]  == stint_num)
                ]
                .copy()
                .sort_values("LapNumber")
                .reset_index(drop=True)
            )
 
            if stint_laps.empty:
                drivers_data[driver_abbr] = None
                continue
 
            compound = str(stint_laps["Compound"].iloc[0]).upper()
            drivers_data[driver_abbr] = _build_stint_driver(stint_laps, compound, session)
 
        stints.append(StintEntryDTO(stint_number=stint_num, drivers=drivers_data))
 
    return StintsResponseDTO(drivers=driver_list, stints=stints)