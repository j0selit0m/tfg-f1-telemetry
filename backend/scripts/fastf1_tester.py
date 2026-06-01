"""
FastF1 Tester
==========================================

Cubre los métodos de FastF1

Docs de referencia: https://docs.fastf1.dev/api_reference/index.html

Configuración: ajusta las constantes del bloque RUNNER al final.
"""

import warnings

warnings.filterwarnings("ignore")

import os
import sys

import fastf1
import fastf1.plotting
import pandas as pd

# Caché — reutiliza la configuración del backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import CACHE_HDD_PATH, CACHE_LOCAL_PATH

cache_path = (
    CACHE_HDD_PATH
    if os.path.isdir(os.path.dirname(CACHE_HDD_PATH) or CACHE_HDD_PATH)
    else CACHE_LOCAL_PATH
)
os.makedirs(cache_path, exist_ok=True)
fastf1.Cache.enable_cache(cache_path)
print(f"Cache en: {cache_path}")


def sep(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


# =================================================
#  1. SCHEDULE
#     fastf1.get_event_schedule()
#     fastf1.get_event()
#     Detección dinámica de SessionN
#
#     Docs: https://docs.fastf1.dev/api_reference/events.html
# =================================================


def test_schedule(year: int = 2023) -> None:
    """
    Métodos probados:
        fastf1.get_event_schedule(year)
        fastf1.get_event(year, event_name)
        event["SessionN"] (acceso dinámico)
    """
    sep("1. SCHEDULE — get_event_schedule + get_event")

    # Calendario completo
    schedule = fastf1.get_event_schedule(year)
    print(f"\nget_event_schedule({year})  shape={schedule.shape}")
    print("Columnas clave:")
    for col in ["RoundNumber", "EventName", "Country", "EventFormat"]:
        print(f"  {col:<20} ej: {repr(schedule[col].iloc[1])}")

    print(f"\nEventFormat unicos: {schedule['EventFormat'].unique().tolist()}")
    print("  'conventional' = fin de semana estandar")
    print("  'sprint'       = fin de semana con Sprint Shootout + Sprint")

    # GP estandar
    print(f"\nget_event({year}, 'Bahrain')  -> GP estandar")
    event_std = fastf1.get_event(year, "Bahrain")
    keys_std = [
        k for k in event_std.index if k.startswith("Session") and k[-1].isdigit()
    ]
    print(f"  Claves detectadas: {keys_std}")
    for key in keys_std:
        print(f"    {key} = {event_std.get(key)!r}")

    # GP con Sprint
    print(f"\nget_event({year}, 'Azerbaijan')  -> GP con Sprint")
    try:
        event_sprint = fastf1.get_event(year, "Azerbaijan")
        keys_sprint = [
            k for k in event_sprint.index if k.startswith("Session") and k[-1].isdigit()
        ]
        print(f"  Claves detectadas: {keys_sprint}")
        for key in keys_sprint:
            print(f"    {key} = {event_sprint.get(key)!r}")
    except Exception as e:
        print(f"  No disponible: {e}")


# =================================================
#  2. SESSION LOAD
#     fastf1.get_session()
#     session.load() — dos variantes: metadata y telemetría completa
#
#     Docs: https://docs.fastf1.dev/api_reference/core.html#fastf1.core.Session.load
# =================================================


def test_session_load(year=2023, gp="Bahrain") -> tuple:
    """
    Métodos probados:
        fastf1.get_session(year, gp, identifier)
        session.load(laps, telemetry, weather, messages)
    """
    sep("2. SESSION LOAD — metadata vs telemetria completa")

    # Carga ligera (para analysis, laps, summary, stints)
    session_meta = fastf1.get_session(year, gp, "R")
    session_meta.load(laps=True, telemetry=False, weather=False, messages=True)
    print("\nload(telemetry=False)  -> para endpoints de analisis")
    print(f"  session.laps    shape={session_meta.laps.shape}")
    print(f"  session.results shape={session_meta.results.shape}")
    print("  get_car_data()  disponible: False  (lanzaria excepcion)")

    # Carga completa (para telemetria y track map)
    session_tel = fastf1.get_session(year, gp, "R")
    session_tel.load(laps=True, telemetry=True, weather=False, messages=False)
    lap = session_tel.laps.pick_driver(
        session_tel.results["Abbreviation"].iloc[0]
    ).pick_fastest(only_by_time=True)
    car = lap.get_car_data()
    print("\nload(telemetry=True)   -> para endpoint de telemetria y track map")
    print(f"  get_car_data()  shape={car.shape}  columnas={list(car.columns)}")

    return session_meta, session_tel


# ==============================================================
#  3. DRIVERS Y COLORES
#     session.results — DataFrame con info de cada piloto
#     fastf1.plotting.get_driver_color()
#     fastf1.plotting.get_compound_color()
#
#     Docs: https://docs.fastf1.dev/api_reference/plotting.html
# ==============================================================


def test_drivers_and_colors(session: fastf1.core.Session) -> None:
    """
    Métodos probados:
        session.results (DataFrame)
        fastf1.plotting.get_driver_color(identifier, session)
        fastf1.plotting.get_compound_color(compound, session)
    """
    sep("3. DRIVERS Y COLORES — results, driver_color, compound_color")

    r = session.results
    print(f"\nsession.results  shape={r.shape}")
    for col in ["DriverNumber", "Abbreviation", "FullName", "TeamName", "TeamColor"]:
        print(f"  {col:<20} ej: {repr(r[col].iloc[0])}")

    # get_driver_color: abreviatura vs numero
    abbr = r["Abbreviation"].iloc[0]
    number = r["DriverNumber"].iloc[0]

    color_abbr = fastf1.plotting.get_driver_color(abbr, session)
    try:
        color_num = fastf1.plotting.get_driver_color(number, session)
    except Exception as e:
        color_num = f"ERROR: {e}"

    print(f"\nget_driver_color('{abbr}', session)    = '{color_abbr}'")
    print(f"get_driver_color('{number}', session)  = '{color_num}'")

    # get_compound_color
    print("\nget_compound_color por temporada (dinamico):")
    for compound in ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]:
        try:
            color = fastf1.plotting.get_compound_color(compound, session)
            print(f"  {compound:<15} -> {color}")
        except Exception:
            print(f"  {compound:<15} -> fallback #888888")


# ==============================================================
#  4. LAPS — DataFrame y métodos de filtrado
#     session.laps
#     pick_drivers(), pick_fastest(), pick_wo_box(), pick_laps()
#     Columnas: LapTime, Sector1-3Time, Compound, TyreLife, Stint,
#               Position, TrackStatus, PitInTime, PitOutTime,
#               Deleted, DeletedReason, IsPersonalBest, IsAccurate
#
#     Docs: https://docs.fastf1.dev/api_reference/core.html#fastf1.core.Laps
# ==============================================================


def test_laps(session: fastf1.core.Session) -> None:
    """
    Métodos probados:
        session.laps
        laps.pick_drivers([...])
        laps.pick_drivers(str)
        drv_laps.pick_fastest(only_by_time=True)
        drv_laps.pick_wo_box()
        drv_laps.pick_laps(lap_number)
    """
    sep("4. LAPS — pick_drivers, pick_fastest, pick_wo_box, pick_laps")

    laps = session.laps
    abbr1 = session.results["Abbreviation"].iloc[0]
    abbr2 = session.results["Abbreviation"].iloc[1]

    # pick_drivers (plural)
    multi = laps.pick_drivers([abbr1, abbr2])
    print(f"\npick_drivers(['{abbr1}', '{abbr2}'])  shape={multi.shape}")
    print(f"  Pilotos en resultado: {sorted(multi['Driver'].unique().tolist())}")

    # pick_fastest: con y sin only_by_time
    drv_laps = laps.pick_drivers(abbr1)
    f_default = drv_laps.pick_fastest()
    f_by_time = drv_laps.pick_fastest(only_by_time=True)

    print(
        f"\npick_fastest()                   -> vuelta {int(f_default['LapNumber'])}"
        f"  IsPersonalBest={f_default['IsPersonalBest']}"
    )
    print(
        f"pick_fastest(only_by_time=True)  -> vuelta {int(f_by_time['LapNumber'])}"
        f"  IsPersonalBest={f_by_time['IsPersonalBest']}"
    )
    print("  only_by_time=True busca el minimo puro de LapTime,")
    print("  ignorando la flag IsPersonalBest que puede estar mal.")

    # pick_wo_box
    wo_box = drv_laps.pick_wo_box()
    print("\npick_wo_box():")
    print(f"  Total vueltas : {len(drv_laps)}")
    print(
        f"  Sin pit laps  : {len(wo_box)}  (excluidas {len(drv_laps) - len(wo_box)} in/out laps)"
    )
    print("  Excluye vueltas de entrada y salida de boxes.")

    # pick_laps (vuelta especifica)
    lap_5 = drv_laps.pick_laps(5)
    print(f"\npick_laps(5)  shape={lap_5.shape}")
    if not lap_5.empty:
        print(f"  LapTime: {lap_5.iloc[0]['LapTime']}")

    # Columnas del DataFrame de laps
    sample = drv_laps.iloc[5] if len(drv_laps) > 5 else drv_laps.iloc[0]
    print(f"\nColumnas de laps (vuelta {int(sample['LapNumber'])} de {abbr1}):")
    cols_used = [
        "LapTime",
        "LapNumber",
        "Sector1Time",
        "Sector2Time",
        "Sector3Time",
        "Compound",
        "TyreLife",
        "Stint",
        "Position",
        "TrackStatus",
        "IsPersonalBest",
        "IsAccurate",
        "Deleted",
        "DeletedReason",
        "PitInTime",
        "PitOutTime",
    ]
    for col in cols_used:
        val = sample[col]
        is_na = pd.isna(val) if not isinstance(val, bool) else False
        print(f"  {col:<20} = {repr(val):<35} na={is_na}")

    # Deleted y DeletedReason
    deleted = laps[laps["Deleted"].eq(True)]
    print(f"\nVueltas borradas en toda la sesion: {len(deleted)}")
    if not deleted.empty:
        print(
            deleted[["Driver", "LapNumber", "LapTime", "DeletedReason"]]
            .head(5)
            .to_string(index=False)
        )
        print(f"Motivos unicos: {deleted['DeletedReason'].unique().tolist()}")
    else:
        print("  (ninguna vuelta borrada en esta sesion)")

    # Stint, PitInTime, PitOutTime
    print(f"\nStints de {abbr1}:")
    cols = drv_laps[
        ["LapNumber", "Stint", "Compound", "TyreLife", "PitInTime", "PitOutTime"]
    ]
    print(cols.to_string(index=False))
    print(
        f"\nStints unicos: {sorted(int(s) for s in drv_laps.dropna(subset=['Stint'])['Stint'].unique())}"
    )
    print("  PitInTime  notna() -> entro a boxes en esa vuelta")
    print("  PitOutTime notna() -> salio de boxes en esa vuelta")


# ==============================================================
#  5. CAR TELEMETRY
#     lap.get_car_data()
#     car_data.add_distance()
#     Columnas: Distance, Speed, Throttle, Brake, RPM, nGear, DRS, Time
#
#     Docs: https://docs.fastf1.dev/api_reference/core.html#fastf1.core.Telemetry
# ==============================================================


def test_car_telemetry(session: fastf1.core.Session) -> None:
    """
    Métodos probados:
        lap.get_car_data()
        car_data.add_distance()
        Acceso a columnas de telemetria de coche
    """
    sep("5. CAR TELEMETRY — get_car_data, add_distance")

    abbr = session.results["Abbreviation"].iloc[0]
    lap = session.laps.pick_drivers(abbr).pick_fastest(only_by_time=True)

    car = lap.get_car_data().add_distance()
    print(f"\nget_car_data().add_distance()  shape={car.shape}")
    print("Columnas y rangos:")
    print(
        f"  Distance  (float)  {car['Distance'].min():.0f} - {car['Distance'].max():.0f} m"
    )
    print(
        f"  Speed     (float)  {car['Speed'].min():.0f} - {car['Speed'].max():.0f} km/h"
    )
    print(
        f"  Throttle  (float)  {car['Throttle'].min():.0f} - {car['Throttle'].max():.0f} %"
    )
    print(f"  Brake     (bool)   valores unicos: {sorted(car['Brake'].unique())}")
    print(f"  RPM       (float)  {car['RPM'].min():.0f} - {car['RPM'].max():.0f}")
    print(f"  nGear     (int)    {car['nGear'].min()} - {car['nGear'].max()}")
    print(f"  DRS       (int)    valores unicos: {sorted(car['DRS'].unique())}")
    print(
        f"\nFrecuencia: {len(car)} samples en {car['Time'].iloc[-1].total_seconds():.1f}s"
        f"  (~{len(car) / car['Time'].iloc[-1].total_seconds():.0f} Hz)"
    )


# ==============================================================
#  6. MERGED TELEMETRY (para Track Map)
#     lap.get_telemetry()
#     Columnas extra vs get_car_data: X, Y, RelativeDistance
#
#     Docs: https://docs.fastf1.dev/api_reference/core.html#fastf1.core.Lap.get_telemetry
# ==============================================================


def test_merged_telemetry(session: fastf1.core.Session) -> None:
    """
    Métodos probados:
        lap.get_telemetry()  — fusiona car_data + pos_data
        Columnas exclusivas de pos_data: X, Y, RelativeDistance
    """
    sep("6. MERGED TELEMETRY — get_telemetry vs get_car_data")

    abbr = session.results["Abbreviation"].iloc[0]
    lap = session.laps.pick_drivers(abbr).pick_fastest(only_by_time=True)

    car = lap.get_car_data().add_distance()
    tel = lap.get_telemetry()

    print(
        f"\nget_car_data().add_distance()  shape={car.shape}  cols={len(car.columns)}"
    )
    print(f"get_telemetry()               shape={tel.shape}  cols={len(tel.columns)}")

    extra = sorted(set(tel.columns) - set(car.columns))
    print("\nColumnas extra en get_telemetry (vienen de pos_data):")
    for col in extra:
        sample = tel[col].dropna()
        if not sample.empty:
            print(f"  {col:<25} dtype={tel[col].dtype}  ej: {sample.iloc[0]}")
        else:
            print(f"  {col:<25} dtype={tel[col].dtype}  (vacia)")

    # RelativeDistance
    rel = tel["RelativeDistance"].dropna()
    print("\nRelativeDistance:")
    print(f"  rango    : {rel.min():.4f} - {rel.max():.4f}")
    print(f"  muestras : {len(rel)}")
    print(f"  dtype    : {rel.dtype}")
    print("  Distancia normalizada sobre el total de la vuelta.")
    print("  Permite dividir cualquier circuito en microsectores iguales.")

    # Coordenadas X/Y
    print("\nCoordenadas GPS:")
    print(f"  X  rango: {tel['X'].min():.0f} - {tel['X'].max():.0f}")
    print(f"  Y  rango: {tel['Y'].min():.0f} - {tel['Y'].max():.0f}")
    print("  Usadas para dibujar el trazado del circuito en SVG.")


# ==============================================================
#  7. CIRCUIT INFO
#     session.get_circuit_info()
#     ci.rotation
#     ci.corners — Number, Letter, Distance, X, Y, Angle
#
#     Docs: https://docs.fastf1.dev/api_reference/core.html#fastf1.core.Session.get_circuit_info
# ==============================================================


def test_circuit_info(session: fastf1.core.Session) -> None:
    """
    Métodos probados:
        session.get_circuit_info()
        ci.rotation    -> angulo de rotacion del circuito
        ci.corners     -> DataFrame con curvas
    """
    sep("7. CIRCUIT INFO — rotation, corners")

    ci = session.get_circuit_info()

    print("\nsession.get_circuit_info()")
    print(f"  rotation : {ci.rotation} grados")
    print("  Se aplica a X/Y para orientar el circuito como en TV.")

    corners = ci.corners
    print(f"\ncorners  shape={corners.shape}")
    print(f"  Columnas: {list(corners.columns)}")

    # Distance — usada en telemetry_service para superponer marcas de curva
    print("\ncorners['Distance'] (eje X compartido con car_data['Distance']):")
    print(
        f"  rango: {corners['Distance'].min():.0f} - {corners['Distance'].max():.0f} m"
    )

    # X, Y, Angle — usadas en track_service para posicionar curvas en el SVG
    print("\ncorners con X, Y, Angle (usadas en track map):")
    print(
        corners[["Number", "Letter", "Distance", "X", "Y", "Angle"]]
        .head(5)
        .to_string(index=False)
    )

    print("\n  Number   : numero de curva (1, 2, 3...)")
    print("  Letter   : tipo (L, R) o vacio")
    print("  Distance : distancia absoluta en metros desde salida")
    print("  X, Y     : coordenadas GPS, mismas que get_telemetry()")
    print("  Angle    : angulo de giro de la curva en grados")


# ==============================================================
#  RUNNER
# ==============================================================


def run_all():

    # Configura aqui la sesion a testear
    YEAR = 2023
    GP = "Bahrain"

    test_schedule(YEAR)
    session_meta, session_tel = test_session_load(YEAR, GP)

    test_drivers_and_colors(session_meta)
    test_laps(session_meta)
    test_car_telemetry(session_tel)
    test_merged_telemetry(session_tel)
    test_circuit_info(session_tel)

    print("\n\n  Todos los tests ejecutados.\n")


if __name__ == "__main__":
    run_all()

    # Para testear una funcion concreta:
    # test_schedule(2024)
    # session_meta, session_tel = test_session_load(2023, "Monaco")
    # test_laps(session_meta)
