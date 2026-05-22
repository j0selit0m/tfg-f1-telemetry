"""
FastF1 Tester
==========================================

Cubre exclusivamente los métodos de FastF1 que utiliza el backend,
uno a uno, en el mismo orden en que aparecen en la arquitectura.

Docs de referencia: https://docs.fastf1.dev/api_reference/index.html

Configuración: ajusta las constantes del bloque RUNNER al final.
"""

import warnings

warnings.filterwarnings("ignore")

import fastf1
import fastf1.plotting
import pandas as pd

# ── Caché ─────────────────────────────────────────────────────────────────────

fastf1.Cache.enable_cache("E:/TFG_F1_Cache")


# ── Helper de presentación ────────────────────────────────────────────────────


def sep(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


# ══════════════════════════════════════════════════════════════════════════════
#  1. SCHEDULE  →  routers/schedule.py
#     get_event_schedule, get_event + detección dinámica de SessionN
# ══════════════════════════════════════════════════════════════════════════════


def test_schedule(year: int = 2023) -> None:
    """
    Cubre los dos endpoints de filtrado del backend:
        GET /api/schedule/{year}
        GET /api/schedule/{year}/{event_name}/sessions
    """
    sep("1. SCHEDULE — get_event_schedule + get_event")

    # ── Calendario completo ───────────────────────────────────────────────────
    schedule = fastf1.get_event_schedule(year)
    print(f"\nget_event_schedule({year})  shape={schedule.shape}")
    print("Columnas clave:")
    for col in ["RoundNumber", "EventName", "Country", "EventFormat"]:
        print(f"  {col:<20} ej: {repr(schedule[col].iloc[1])}")

    print(f"\nEventFormat únicos: {schedule['EventFormat'].unique().tolist()}")
    print("  'conventional' = fin de semana estándar")
    print("  'sprint'       = fin de semana con Sprint Shootout + Sprint")

    # ── Detección dinámica de SessionN — GP estándar ──────────────────────────
    print(f"\nget_event({year}, 'Bahrain')  → GP estándar")
    event_std = fastf1.get_event(year, "Bahrain")
    keys_std = [
        k for k in event_std.index if k.startswith("Session") and k[-1].isdigit()
    ]
    print(f"  Claves detectadas: {keys_std}")
    for key in keys_std:
        print(f"    {key} = {event_std.get(key)!r}")

    # ── Detección dinámica de SessionN — GP con Sprint ────────────────────────
    print(f"\nget_event({year}, 'Azerbaijan')  → GP con Sprint")
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


# ══════════════════════════════════════════════════════════════════════════════
#  2. SESSION LOAD  →  core/session_loader.py
#     Las dos variantes de carga: metadata y con telemetría
# ══════════════════════════════════════════════════════════════════════════════


def test_session_load(year=2023, gp="Bahrain") -> tuple:
    """
    Reproduce las dos funciones de core/session_loader.py:
        load_session_metadata()       → telemetry=False  (análisis)
        load_session_with_telemetry() → telemetry=True   (telemetría)
    """
    sep("2. SESSION LOAD — metadata vs telemetría completa")

    # ── Carga ligera (analysis, laps, summary, stints) ────────────────────────
    session_meta = fastf1.get_session(year, gp, "R")
    session_meta.load(laps=True, telemetry=False, weather=False, messages=True)
    print("\nload(telemetry=False)  → para endpoints de análisis")
    print(f"  session.laps    shape={session_meta.laps.shape}")
    print(f"  session.results shape={session_meta.results.shape}")
    print("  get_car_data()  disponible: False  (lanzaría excepción)")

    # ── Carga completa (telemetría) ───────────────────────────────────────────
    session_tel = fastf1.get_session(year, gp, "R")
    session_tel.load(laps=True, telemetry=True, weather=False, messages=False)
    lap = session_tel.laps.pick_driver(
        session_tel.results["Abbreviation"].iloc[0]
    ).pick_fastest(only_by_time=True)
    car = lap.get_car_data()
    print("\nload(telemetry=True)   → solo para endpoint de telemetría")
    print(f"  get_car_data()  shape={car.shape}  columnas={list(car.columns)}")

    return session_meta, session_tel


# ══════════════════════════════════════════════════════════════════════════════
#  3. DRIVERS Y COLORES  →  routers/schedule.py + core/compounds.py
#     session.results, get_driver_color, get_compound_color
# ══════════════════════════════════════════════════════════════════════════════


def test_drivers_and_colors(session: fastf1.core.Session) -> None:
    """
    Cubre el endpoint:
        GET /api/session/{year}/{event_name}/{session_name}/drivers

    Verifica que get_driver_color usa ABREVIATURA como clave,
    no número de coche — decisión crítica para el backend.
    """
    sep("3. DRIVERS Y COLORES — results, driver_color, compound_color")

    # ── session.results ───────────────────────────────────────────────────────
    r = session.results
    print(f"\nsession.results  shape={r.shape}")
    print("Columnas usadas en el backend:")
    for col in ["DriverNumber", "Abbreviation", "FullName", "TeamName", "TeamColor"]:
        print(f"  {col:<20} ej: {repr(r[col].iloc[0])}")

    # ── get_driver_color: abreviatura vs número ───────────────────────────────
    abbr = r["Abbreviation"].iloc[0]
    number = r["DriverNumber"].iloc[0]

    color_abbr = fastf1.plotting.get_driver_color(abbr, session)
    try:
        color_num = fastf1.plotting.get_driver_color(number, session)
    except Exception as e:
        color_num = f"ERROR: {e}"

    print(
        f"\nget_driver_color('{abbr}', session)    = '{color_abbr}'  ← el backend usa esto"
    )
    print(f"get_driver_color('{number}', session)  = '{color_num}'")

    # ── get_compound_color ────────────────────────────────────────────────────
    print("\nget_compound_color por temporada (dinámico):")
    for compound in ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]:
        try:
            color = fastf1.plotting.get_compound_color(compound, session)
            print(f"  {compound:<15} → {color}")
        except Exception:
            print(f"  {compound:<15} → fallback #888888")


# ══════════════════════════════════════════════════════════════════════════════
#  4. LAPS ANALYSIS  →  services/lap_service, summary_service, stint_service
#     pick_drivers, pick_fastest(only_by_time), pick_wo_box,
#     Stint/PitInTime/PitOutTime, Deleted/DeletedReason
# ══════════════════════════════════════════════════════════════════════════════


def test_laps_analysis(session: fastf1.core.Session) -> None:
    """
    Cubre los tres endpoints de análisis:
        GET /api/analysis/.../laps
        GET /api/analysis/.../summary
        GET /api/analysis/.../stints
    """
    sep("4. LAPS ANALYSIS — pick_drivers, pick_wo_box, stints, Deleted")

    abbr1 = session.results["Abbreviation"].iloc[0]
    abbr2 = session.results["Abbreviation"].iloc[1]
    laps = session.laps

    # ── pick_drivers (plural) — usado en los tres services ────────────────────
    multi = laps.pick_drivers([abbr1, abbr2])
    print(f"\npick_drivers(['{abbr1}', '{abbr2}'])  shape={multi.shape}")
    print(f"  Pilotos en resultado: {sorted(multi['Driver'].unique().tolist())}")

    # ── pick_fastest: con y sin only_by_time ──────────────────────────────────
    drv_laps = laps.pick_drivers(abbr1)
    f_default = drv_laps.pick_fastest()
    f_by_time = drv_laps.pick_fastest(only_by_time=True)

    print(
        f"\npick_fastest()                   → vuelta {int(f_default['LapNumber'])}"
        f"  IsPersonalBest={f_default['IsPersonalBest']}"
    )
    print(
        f"pick_fastest(only_by_time=True)  → vuelta {int(f_by_time['LapNumber'])}"
        f"  IsPersonalBest={f_by_time['IsPersonalBest']}"
    )
    print("  El backend siempre usa only_by_time=True para evitar que una vuelta")
    print("  marcada PB pero luego borrada distorsione las estadísticas.")

    # ── pick_wo_box — usado en summary_service ────────────────────────────────
    wo_box = drv_laps.pick_wo_box()
    print("\npick_wo_box():")
    print(f"  Total vueltas : {len(drv_laps)}")
    print(
        f"  Sin pit laps  : {len(wo_box)}  (excluidas {len(drv_laps) - len(wo_box)} in/out laps)"
    )
    print("  El backend lo usa en summary_service para no distorsionar")
    print("  la media con los ~20-30s del pit stop.")

    # ── Stint, PitInTime, PitOutTime — usado en stint_service ────────────────
    print(f"\nColumnas de stint para {abbr1}:")
    cols = drv_laps[
        ["LapNumber", "Stint", "Compound", "TyreLife", "PitInTime", "PitOutTime"]
    ]
    print(cols.to_string(index=False))
    print(
        f"\nStints únicos: {sorted(int(s) for s in drv_laps.dropna(subset=['Stint'])['Stint'].unique())}"
    )
    print("  PitInTime  notna() → entró a boxes en esa vuelta")
    print("  PitOutTime notna() → salió de boxes en esa vuelta")

    # ── Deleted y DeletedReason ───────────────────────────────────────────────
    deleted = laps[laps["Deleted"].eq(True)]
    print(f"\nVueltas borradas en toda la sesión: {len(deleted)}")
    if not deleted.empty:
        print(
            deleted[["Driver", "LapNumber", "LapTime", "DeletedReason"]]
            .head(5)
            .to_string(index=False)
        )
        print(f"Motivos únicos: {deleted['DeletedReason'].unique().tolist()}")
    else:
        print("  (ninguna vuelta borrada en esta sesión)")


# ══════════════════════════════════════════════════════════════════════════════
#  5. CAR TELEMETRY  →  services/telemetry_service.py
#     get_car_data, add_distance, get_circuit_info
# ══════════════════════════════════════════════════════════════════════════════


def test_car_telemetry(session: fastf1.core.Session) -> None:
    """
    Cubre el endpoint:
        GET /api/telemetry/{year}/{event_name}/full

    Métodos usados en telemetry_service.py:
        lap.get_car_data().add_distance()
        session.get_circuit_info()
    """
    sep("5. CAR TELEMETRY — get_car_data, add_distance, get_circuit_info")

    abbr = session.results["Abbreviation"].iloc[0]
    lap = session.laps.pick_drivers(abbr).pick_fastest(only_by_time=True)

    # ── get_car_data + add_distance ───────────────────────────────────────────
    car = lap.get_car_data().add_distance()
    print(f"\nget_car_data().add_distance()  shape={car.shape}")
    print("Columnas y rangos:")
    print(
        f"  Distance  (float)  {car['Distance'].min():.0f} – {car['Distance'].max():.0f} m"
    )
    print(
        f"  Speed     (float)  {car['Speed'].min():.0f} – {car['Speed'].max():.0f} km/h"
    )
    print(
        f"  Throttle  (float)  {car['Throttle'].min():.0f} – {car['Throttle'].max():.0f} %"
    )
    print(f"  Brake     (bool)   valores únicos: {sorted(car['Brake'].unique())}")
    print(f"  RPM       (float)  {car['RPM'].min():.0f} – {car['RPM'].max():.0f}")
    print(f"  nGear     (int)    {car['nGear'].min()} – {car['nGear'].max()}")
    print(f"  DRS       (int)    valores únicos: {sorted(car['DRS'].unique())}")
    print(
        f"\nFrecuencia: {len(car)} samples en {car['Time'].iloc[-1].total_seconds():.1f}s"
        f"  (~{len(car) / car['Time'].iloc[-1].total_seconds():.0f} Hz)"
    )

    # ── get_circuit_info ──────────────────────────────────────────────────────
    ci = session.get_circuit_info()
    print("\nsession.get_circuit_info()")
    print(f"  rotation        : {ci.rotation}°")
    print(f"  corners  shape  : {ci.corners.shape}")
    print(f"  Columnas corners: {list(ci.corners.columns)}")
    print("\nPrimeras 5 curvas:")
    print(ci.corners[["Number", "Letter", "Distance"]].head(5).to_string(index=False))
    print("\n  ci.corners['Distance'] comparte el mismo eje X que car_data['Distance']")
    print("  → permite superponer marcas de curva sobre la gráfica de telemetría")


# ══════════════════════════════════════════════════════════════════════════════
#  RUNNER
# ══════════════════════════════════════════════════════════════════════════════


def run_all():
    """Ejecuta los 5 tests en el mismo orden que las capas del backend."""

    # ── Configura aquí la sesión a testear ────────────────────────────────────
    YEAR = 2023
    GP = "Bahrain"
    # ─────────────────────────────────────────────────────────────────────────

    test_schedule(YEAR)
    session_meta, session_tel = test_session_load(YEAR, GP)

    test_drivers_and_colors(session_meta)
    test_laps_analysis(session_meta)
    test_car_telemetry(session_tel)

    print("\n\n✓ Todos los tests ejecutados.\n")


if __name__ == "__main__":
    run_all()

    # Para testear una función concreta:
    # test_schedule(2024)
    # session_meta, session_tel = test_session_load(2023, "Monaco")
    # test_laps_analysis(session_meta)
