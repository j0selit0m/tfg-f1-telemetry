"""
FastF1 Endpoint Tester
==========================================

Cada método prueba UN endpoint real de FastF1 y muestra
exactamente qué devuelve: shape, columnas, tipos y sample de datos.

Docs de referencia: https://docs.fastf1.dev/api_reference/index.html
"""

import warnings

warnings.filterwarnings("ignore")

import fastf1
import fastf1.plotting
import pandas as pd
from pathlib import Path

# ── Caché local (evita re-descargar) ──────────────────────────────────────────
HDD_DRIVE_LETTER = "E:"
CACHE_FOLDER_NAME = "TFG_F1_Cache"

fastf1.Cache.enable_cache(f"{HDD_DRIVE_LETTER}/{CACHE_FOLDER_NAME}")

# ══════════════════════════════════════════════════════════════════════════════


def sep(title: str) -> None:
    """Separador visual para el terminal."""
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


def show_df(df: pd.DataFrame, label: str = "", rows: int = 5) -> None:
    """Muestra shape, columnas con dtype, y las primeras filas."""
    print(f"\n[{label}]  shape={df.shape}")
    print("Columnas y tipos:")
    for col in df.columns:
        print(
            f"  {col:<30} {str(df[col].dtype):<15}  ej: {repr(df[col].iloc[0]) if len(df) > 0 else 'vacío'}"
        )
    print(f"\nPrimeras {rows} filas:")
    print(df.head(rows).to_string(index=False))


# ══════════════════════════════════════════════════════════════════════════════
#  1. SESSION
# ══════════════════════════════════════════════════════════════════════════════


def test_get_session(year=2023, gp="Bahrain", session_type="Q") -> fastf1.core.Session:
    """
    fastf1.get_session(year, gp, session_type)
    session.load(laps, telemetry, weather, messages)

    session_type: 'R' | 'Q' | 'S' | 'FP1' | 'FP2' | 'FP3'
    """
    sep("1. get_session + session.load")

    session = fastf1.get_session(year, gp, session_type)
    print(f"Objeto devuelto: {type(session)}")
    print(f"  event['EventName'] = {session.event['EventName']}")
    print(f"  session.name       = {session.name}")

    # load() controla qué datos se descargan
    session.load(
        laps=True,  # session.laps  → Laps DataFrame
        telemetry=True,  # lap.get_car_data() / get_pos_data()
        weather=True,  # session.weather_data
        messages=True,  # session.race_control_messages + Deleted/DeletedReason en laps
    )

    print("\nAtributos disponibles tras session.load():")
    print(f"  session.drivers            = {session.drivers[:5]}...")
    print(f"  session.laps               → Laps  shape={session.laps.shape}")
    print(
        f"  session.results            → SessionResults  shape={session.results.shape}"
    )
    print(
        f"  session.weather_data       → DataFrame  shape={session.weather_data.shape}"
    )
    print(
        f"  session.race_control_msgs  → DataFrame  shape={session.race_control_messages.shape}"
    )

    return session


# ══════════════════════════════════════════════════════════════════════════════
#  2. LAPS  (session.laps)
# ══════════════════════════════════════════════════════════════════════════════


def test_laps(session: fastf1.core.Session) -> None:
    """
    session.laps               → Laps (todos los pilotos)
    session.laps.pick_driver() → Laps (un piloto)
    session.laps.pick_fastest()→ Lap  (una vuelta)

    Columnas clave para el TFG:
      LapTime, Sector1/2/3Time, SpeedI1/I2/FL/ST,
      Compound, TyreLife, IsPersonalBest, IsAccurate,
      TrackStatus, Deleted, DeletedReason
    """
    sep("2. session.laps — Timing Data")

    laps = session.laps
    show_df(laps, "session.laps (todos los pilotos)")

    # Pick por piloto
    drv = session.drivers[0]
    drv_laps = laps.pick_driver(drv)
    print(f"\nsession.laps.pick_driver('{drv}')  → shape={drv_laps.shape}")

    # Vuelta rápida
    fastest = drv_laps.pick_fastest()
    print(f"\npick_fastest()  → tipo={type(fastest).__name__}")
    print(f"  LapTime        = {fastest['LapTime']}")
    print(f"  Sector1Time    = {fastest['Sector1Time']}")
    print(f"  Sector2Time    = {fastest['Sector2Time']}")
    print(f"  Sector3Time    = {fastest['Sector3Time']}")
    print(f"  SpeedI1        = {fastest['SpeedI1']} km/h")
    print(f"  SpeedI2        = {fastest['SpeedI2']} km/h")
    print(f"  SpeedFL        = {fastest['SpeedFL']} km/h")
    print(f"  SpeedST        = {fastest['SpeedST']} km/h  ← speed trap")
    print(f"  Compound       = {fastest['Compound']}")
    print(f"  TyreLife       = {fastest['TyreLife']} vueltas")
    print(f"  IsPersonalBest = {fastest['IsPersonalBest']}")
    print(f"  IsAccurate     = {fastest['IsAccurate']}")
    print(f"  TrackStatus    = {fastest['TrackStatus']}")
    print(f"  Deleted        = {fastest['Deleted']}")

    # Filtros útiles de Laps
    print("\nFiltros disponibles en Laps:")
    print("  .pick_driver('VER')           → vueltas de un piloto")
    print("  .pick_drivers(['VER','HAM'])   → múltiples pilotos")
    print("  .pick_fastest()               → la vuelta más rápida")
    print("  .pick_laps([1,2,3])           → vueltas específicas")
    print("  .pick_track_status('1')       → solo vueltas en verde")
    print("  .pick_accurate()              → IsAccurate=True")
    print("  .pick_wo_box()                → sin inlap/outlap")
    print("  .pick_tyre_compounds(['SOFT'])→ filtra por compound")


# ══════════════════════════════════════════════════════════════════════════════
#  3. CAR TELEMETRY  (lap.get_car_data / get_pos_data / get_telemetry)
# ══════════════════════════════════════════════════════════════════════════════


def test_telemetry(session: fastf1.core.Session) -> fastf1.core.Telemetry:
    """
    Telemetry — los 3 métodos del objeto Lap:

      lap.get_car_data()   → Speed, RPM, nGear, Throttle, Brake, DRS
      lap.get_pos_data()   → X, Y, Z, Status
      lap.get_telemetry()  → merge de los dos anteriores

    Todos devuelven un objeto Telemetry (subclase de DataFrame).
    Docs: https://docs.fastf1.dev/api_reference/telemetry.html
    """
    sep("3. Telemetry — get_car_data / get_pos_data / get_telemetry")

    drv = session.drivers[0]
    lap = session.laps.pick_driver(drv).pick_fastest()

    # ── 3a. Car Data (ECU) ────────────────────────────────────────────────────
    car = lap.get_car_data()
    print("\n--- lap.get_car_data() ---")
    print(f"tipo     : {type(car).__name__}  (subclase de DataFrame)")
    print(f"shape    : {car.shape}")
    print("Columnas:")
    print(f"  Time        (timedelta) tiempo desde inicio de vuelta")
    print(f"  SessionTime (timedelta) tiempo desde inicio de sesión")
    print(f"  Date        (datetime)  timestamp absoluto")
    print(f"  Speed       (float)     km/h            ej: {car['Speed'].iloc[0]:.1f}")
    print(f"  RPM         (float)     revoluciones    ej: {car['RPM'].iloc[0]:.0f}")
    print(f"  nGear       (int)       marcha 0-8      ej: {car['nGear'].iloc[0]}")
    print(
        f"  Throttle    (float)     0-100%          ej: {car['Throttle'].iloc[0]:.1f}"
    )
    print(f"  Brake       (bool)      frenando        ej: {car['Brake'].iloc[0]}")
    print(f"  DRS         (int)       0/10/12/14      ej: {car['DRS'].iloc[0]}")
    print(f"  Source      (str)       car/pos/interp  ej: {car['Source'].iloc[0]!r}")
    print(
        f"\nFrecuencia aprox: {len(car)} samples en {car['Time'].iloc[-1].total_seconds():.1f}s"
    )
    print(f"  → ~{len(car) / car['Time'].iloc[-1].total_seconds():.0f} Hz")

    # DRS — valores posibles
    print(f"\nValores DRS únicos en esta vuelta: {sorted(car['DRS'].unique())}")
    print("  0        → DRS cerrado")
    print("  10/12/14 → DRS abierto (diferentes estados de detección)")

    # ── 3b. add_distance() ────────────────────────────────────────────────────
    car = car.add_distance()
    print(f"\nDespués de .add_distance():")
    print(
        f"  Distance (float) metros desde inicio    ej: {car['Distance'].iloc[-1]:.1f} m al final"
    )

    # ── 3c. Pos Data (GPS) ────────────────────────────────────────────────────
    pos = lap.get_pos_data()
    print("\n--- lap.get_pos_data() ---")
    print(f"shape    : {pos.shape}")
    print(
        f"  X (float)  posición X en 1/10 m  rango: [{pos['X'].min():.0f}, {pos['X'].max():.0f}]"
    )
    print(
        f"  Y (float)  posición Y en 1/10 m  rango: [{pos['Y'].min():.0f}, {pos['Y'].max():.0f}]"
    )
    print(
        f"  Z (float)  altitud   en 1/10 m   rango: [{pos['Z'].min():.0f}, {pos['Z'].max():.0f}]"
    )
    print(f"  Status (str)  OnTrack/OffTrack    ej: {pos['Status'].iloc[0]!r}")

    # ── 3d. get_telemetry() = merge car + pos ─────────────────────────────────
    tel = lap.get_telemetry()
    print("\n--- lap.get_telemetry() ---")
    print("  Equivale a get_car_data().merge_channels(get_pos_data())")
    print(f"  shape: {tel.shape}  columnas: {list(tel.columns)}")

    # ── 3e. merge_channels() manual ───────────────────────────────────────────
    print("\n--- merge_channels() ---")
    print("  # Para el TFG, merge con distancia:")
    print("  tel = lap.get_car_data().add_distance()")
    print("        .merge_channels(lap.get_pos_data())")
    print("  → disponibles: Speed, RPM, nGear, Throttle, Brake, DRS,")
    print("                 Distance, X, Y, Z, Status")

    return car


# ══════════════════════════════════════════════════════════════════════════════
#  4. TELEMETRY SLICING
# ══════════════════════════════════════════════════════════════════════════════


def test_telemetry_slicing(session: fastf1.core.Session) -> None:
    """
    Métodos de corte del objeto Telemetry:
      slice_by_lap(ref_laps)
      slice_by_time(start, end)
      slice_by_mask(boolean_array)

    Útil para: aislar una zona del circuito, un sector, una frenada, etc.
    """
    sep("4. Telemetry Slicing")

    drv = session.drivers[0]
    laps = session.laps.pick_driver(drv)
    lap = laps.pick_fastest()

    # Telemetría completa del piloto para toda la sesión
    # (necesita SessionTime para slice_by_lap)
    full_tel = session.laps.pick_driver(drv).get_telemetry()

    print("Métodos de slicing disponibles en Telemetry:\n")

    # slice_by_lap
    sliced_lap = full_tel.slice_by_lap(lap)
    print(
        f"slice_by_lap(lap)          → {sliced_lap.shape[0]} samples  "
        f"(vuelta {int(lap['LapNumber'])})"
    )

    # slice_by_time
    import pandas as pd

    start = lap["LapStartTime"]
    end = lap["LapStartTime"] + lap["LapTime"]
    sliced_time = full_tel.slice_by_time(start, end)
    print(
        f"slice_by_time(start, end)  → {sliced_time.shape[0]} samples  "
        f"(mismo resultado vía SessionTime)"
    )

    # slice_by_mask — ejemplo: solo puntos donde DRS está abierto
    car = lap.get_car_data().add_distance()
    drs_open = car["DRS"] > 0
    sliced_drs = car.slice_by_mask(drs_open)
    print(f"slice_by_mask(DRS > 0)     → {sliced_drs.shape[0]} samples con DRS abierto")
    if len(sliced_drs) > 0:
        print(
            f"  Distancia con DRS: "
            f"{sliced_drs['Distance'].min():.0f}–{sliced_drs['Distance'].max():.0f} m"
        )

    print("\n  # Caso de uso para el TFG:")
    print("  # Aislar datos de una frenada concreta:")
    print("  braking = car.slice_by_mask(car['Brake'] == True)")
    print("  # Aislar primer sector:")
    print("  s1_end = lap['Sector1SessionTime']")
    print("  s1_tel = full_tel.slice_by_time(lap['LapStartTime'], s1_end)")


# ══════════════════════════════════════════════════════════════════════════════
#  5. ADD_DRIVER_AHEAD
# ══════════════════════════════════════════════════════════════════════════════


def test_driver_ahead(session: fastf1.core.Session) -> None:
    """
    Telemetry.add_driver_ahead()
    → columnas: DriverAhead (str), DistanceToDriverAhead (float, metros)

    Nota: aplicar solo a vueltas individuales para reducir error de integración.
    """
    sep("5. add_driver_ahead()")

    drv = session.drivers[0]
    lap = session.laps.pick_driver(drv).pick_fastest()
    car = lap.get_car_data().add_distance()

    try:
        car = car.add_driver_ahead()
        print(f"shape tras add_driver_ahead(): {car.shape}")
        print("Columnas nuevas:")
        print(f"  DriverAhead          (str)   → número del coche delante")
        print(f"  DistanceToDriverAhead (float) → metros hasta el coche delante")
        sample = car[car["DriverAhead"].notna()].head(3)
        if len(sample):
            print(f"\nEjemplo (3 samples):")
            print(
                sample[
                    ["Distance", "Speed", "DriverAhead", "DistanceToDriverAhead"]
                ].to_string(index=False)
            )
    except Exception as e:
        print(f"  No disponible en sesión de Qualifying: {e}")
        print("  (add_driver_ahead es más útil en Race)")


# ══════════════════════════════════════════════════════════════════════════════
#  6. CIRCUIT INFO
# ══════════════════════════════════════════════════════════════════════════════


def test_circuit_info(session: fastf1.core.Session) -> None:
    """
    session.get_circuit_info()
    → CircuitInfo con: corners, marshal_lights, marshal_sectors, rotation

    Docs: https://docs.fastf1.dev/api_reference/circuit_info.html
    Datos de MultiViewer (https://multiviewer.app)
    """
    sep("6. session.get_circuit_info()")

    ci = session.get_circuit_info()
    print(f"tipo: {type(ci).__name__}")
    print(f"ci.rotation = {ci.rotation}°  (rotar mapa del circuito)")

    print("\nci.corners:")
    print(f"  shape={ci.corners.shape}")
    print("  Columnas: X, Y, Number, Letter, Angle, Distance")
    print(ci.corners.head(5).to_string(index=False))

    print("\nci.marshal_sectors:")
    print(f"  shape={ci.marshal_sectors.shape}")
    print(ci.marshal_sectors.to_string(index=False))

    print("\nci.marshal_lights:")
    print(f"  shape={ci.marshal_lights.shape}")
    print(ci.marshal_lights.head(3).to_string(index=False))

    print("\n  # Para el TFG — superponer curvas sobre la gráfica de telemetría:")
    print("  # ci.corners['Distance'] → posición km de cada curva")
    print("  # Eje X = Distance, añadir líneas verticales en cada curva")


# ══════════════════════════════════════════════════════════════════════════════
#  7. RESULTS
# ══════════════════════════════════════════════════════════════════════════════


def test_results(session: fastf1.core.Session) -> None:
    """
    session.results  → SessionResults (subclase de DataFrame)
    Docs: https://docs.fastf1.dev/api_reference/results.html
    """
    sep("7. session.results")

    r = session.results
    print(f"tipo : {type(r).__name__}  shape={r.shape}")
    print("Columnas:")
    for col in r.columns:
        print(f"  {col:<25} {str(r[col].dtype):<15}  ej: {repr(r[col].iloc[0])}")


# ══════════════════════════════════════════════════════════════════════════════
#  8. WEATHER DATA
# ══════════════════════════════════════════════════════════════════════════════


def test_weather(session: fastf1.core.Session) -> None:
    """
    session.weather_data → DataFrame con datos meteorológicos muestreados
    """
    sep("8. session.weather_data")

    w = session.weather_data
    if w is None or len(w) == 0:
        print("Sin datos de weather para esta sesión.")
        return

    show_df(w, "session.weather_data")
    print("\nEstadísticas numéricas:")
    print(w.describe().to_string())


# ══════════════════════════════════════════════════════════════════════════════
#  9. RACE CONTROL MESSAGES
# ══════════════════════════════════════════════════════════════════════════════


def test_race_control(session: fastf1.core.Session) -> None:
    """
    session.race_control_messages → DataFrame
    Contiene: banderas, Safety Car, VSC, penalizaciones, etc.
    También activa las columnas Deleted/DeletedReason en session.laps
    (requiere messages=True en session.load())
    """
    sep("9. session.race_control_messages")

    try:
        msgs = session.race_control_messages
        show_df(msgs, "race_control_messages", rows=8)
        print(
            "\nCategorías únicas:",
            msgs["Category"].unique().tolist() if "Category" in msgs.columns else "—",
        )
    except Exception as e:
        print(f"  No disponible: {e}")


# ══════════════════════════════════════════════════════════════════════════════
#  10. PLOTTING HELPERS  (para el frontend — colores oficiales)
# ══════════════════════════════════════════════════════════════════════════════


def test_plotting_helpers(session: fastf1.core.Session) -> None:

    sep("10. fastf1.plotting — colores oficiales")

    # Usar abbreviation en lugar del número de driver
    drv = session.results["Abbreviation"].iloc[0]  # 'VER', 'HAM', etc.
    team = session.results["TeamName"].iloc[0]

    drv_color = fastf1.plotting.get_driver_color(drv, session)
    team_color = fastf1.plotting.get_team_color(team, session)

    print(f"Piloto: {drv}  |  Equipo: {team}")
    print(f"  get_driver_color('{drv}', session)  = '{drv_color}'  (hex)")
    print(f"  get_team_color('{team}', session)   = '{team_color}'  (hex)")

    print("\nMapas de colores completos:")
    driver_map = fastf1.plotting.get_driver_color_mapping(session)
    for d, c in list(driver_map.items())[:5]:
        print(f"  {d}: {c}")
    print("  ...")

    print("\nCompounds y sus colores:")
    for c in fastf1.plotting.list_compounds(session):
        color = fastf1.plotting.get_compound_color(c, session)
        print(f"  {c:<15} → {color}")


# ══════════════════════════════════════════════════════════════════════════════
#  RUNNER PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════


def run_all():
    """Ejecuta todos los tests en orden."""

    # ── Configurar aquí la sesión a testear ───────────────────────────────────
    YEAR = 2023
    GP = "Bahrain"  # Nombre del GP o número de ronda (1, 2, ...)
    SESSION_TYPE = "Q"  # R | Q | S | FP1 | FP2 | FP3
    # ─────────────────────────────────────────────────────────────────────────

    session = test_get_session(YEAR, GP, SESSION_TYPE)

    test_laps(session)
    test_telemetry(session)
    test_telemetry_slicing(session)
    test_driver_ahead(session)
    test_circuit_info(session)
    test_results(session)
    test_weather(session)
    test_race_control(session)
    test_plotting_helpers(session)

    print("\n\n✓ Todos los endpoints testeados.\n")


# ── Modo individual — comenta/descomenta lo que quieras probar ─────────────
if __name__ == "__main__":
    run_all()

    # O prueba uno solo:
    # session = test_get_session(2023, "Monaco", "R")
    # test_telemetry(session)
    # test_circuit_info(session)
