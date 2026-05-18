// =============================================================================
// StintAnalysis.jsx
//
// RESPONSABILIDAD: Muestra el análisis comparativo de stints entre pilotos.
// Cada stint es una fila; cada piloto, una columna. Si un piloto no usó ese
// stint, su celda muestra un guion.
//
// ENDPOINT:
//   GET /api/analysis/{year}/{event_name}/{session_name}/stints?drivers=ALO,VER
//
// ARQUITECTURA INTERNA (todo en un solo archivo para coherencia con el proyecto):
//   1. DTOs          → Clases que modelan la respuesta del backend
//   2. Service       → Función encargada de hacer el fetch a FastAPI
//   3. Hook          → Orquesta estado, carga, error y cancelación
//   4. Subcomponentes → Piezas visuales reutilizables (rueda, celda, skeleton)
//   5. Componente principal → Exportación default
//
// USO EN App.jsx:
//   import StintAnalysis from './components/StintAnalysis';
//   <StintAnalysis filters={activeFilters} />
//
// PROP 'filters' esperada (misma forma que emite SidebarFilter):
//   { year: "2024", round: "Bahrain Grand Prix", session: "Race", driver: "VER,LEC" }
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

// URL base del backend FastAPI. Se lee de la variable de entorno si existe;
// si no, cae al servidor local de desarrollo.
const API_BASE = 'http://localhost:8000/api';

// =============================================================================
// 1. DTOs (Data Transfer Objects)
//
// Estas clases actúan como contrato entre el backend y el frontend.
// Garantizan que cada campo tenga un valor por defecto seguro aunque la API
// devuelva null, undefined o un campo inesperado.
// =============================================================================

/**
 * Modela la mejor vuelta registrada dentro de un stint concreto.
 */
class BestLapInStintDTO {
    /**
     * @param {object} raw - Fragmento crudo del JSON: { time, lap_in_stint }
     */
    constructor(raw = {}) {
        /** @type {string} Tiempo de la vuelta en formato "m:ss.mmm" */
        this.time       = raw.time         ?? '--:--.---';
        /** @type {number} Número de vuelta dentro del stint (relativo, no absoluto) */
        this.lapInStint = raw.lap_in_stint ?? 0;
    }
}

/**
 * Modela los datos de rendimiento de un piloto en un stint concreto.
 */
class StintDriverDataDTO {
    /**
     * @param {object} raw - Objeto crudo del piloto dentro de un stint
     */
    constructor(raw = {}) {
        /** @type {string} Nombre del compuesto: "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET" */
        this.compound      = raw.compound       ?? 'UNKNOWN';
        /** @type {string} Color hexadecimal oficial de la F1 para este compuesto */
        this.compoundColor = raw.compound_color ?? '#FFFFFF';
        /** @type {string} Etiqueta corta: "S" | "M" | "H" | "I" | "W" */
        this.compoundLabel = raw.compound_label ?? '?';
        /** @type {number} Número de vueltas completadas en este stint */
        this.durationLaps  = raw.duration_laps  ?? 0;
        /** @type {string} Tiempo total del stint en formato "mm:ss.mmm" */
        this.durationTime  = raw.duration_time  ?? '--:--:---';
        /** @type {BestLapInStintDTO} Mejor vuelta dentro del stint */
        this.bestLap       = new BestLapInStintDTO(raw.best_lap);
        /** @type {string} Tiempo promedio de vuelta del stint */
        this.average       = raw.average        ?? '--:--.---';
        /** @type {string} Mediana de los tiempos de vuelta del stint */
        this.median        = raw.median         ?? '--:--.---';
        /** @type {string} Desviación estándar (ej: "2.768s") */
        this.stdDev        = raw.std_dev        ?? '0.000s';
        /** @type {number} Índice de consistencia de 0 a 100 */
        this.consistency   = typeof raw.consistency === 'number' ? raw.consistency : 0;
    }
}

/**
 * Modela un stint completo: su número y los datos de todos los pilotos.
 * Si un piloto no utilizó ese stint, su valor en 'drivers' será null.
 */
class StintDTO {
    /**
     * @param {object} raw - Objeto crudo { stint_number, drivers: { VER: {...}, LEC: null } }
     */
    constructor(raw = {}) {
        /** @type {number} Número ordinal del stint (1, 2, 3...) */
        this.stintNumber = raw.stint_number ?? 0;

        /**
         * @type {Object.<string, StintDriverDataDTO|null>}
         * Diccionario piloto → datos (o null si no participó en este stint).
         * Usamos Object.fromEntries para construirlo de forma inmutable.
         */
        this.drivers = Object.fromEntries(
            Object.entries(raw.drivers ?? {}).map(([code, data]) => [
                code,
                data ? new StintDriverDataDTO(data) : null,
            ])
        );
    }
}

/**
 * Modela la respuesta completa del endpoint /stints.
 * Envuelve el array de stints y expone una propiedad calculada.
 */
class StintsResponseDTO {
    /**
     * @param {Array} rawArray - Array crudo de objetos stint del backend
     */
    constructor(rawArray = []) {
        /** @type {StintDTO[]} Lista ordenada de stints */
        this.stints = rawArray.map(s => new StintDTO(s));
    }

    /**
     * Número total de stints en la respuesta.
     * Útil para calcular el número de filas de la tabla.
     * @returns {number}
     */
    get totalStints() {
        return this.stints.length;
    }
}

// =============================================================================
// 2. SERVICE
//
// Responsabilidad única: comunicación con el backend.
// No conoce React, no maneja estado, solo hace el fetch y mapea a DTOs.
// =============================================================================

/**
 * Obtiene el análisis de stints para los pilotos indicados.
 *
 * @param {object} params
 * @param {string}      params.year    - Temporada (ej: "2024")
 * @param {string}      params.round   - Nombre del Gran Premio (ej: "Bahrain Grand Prix")
 * @param {string}      params.session - Tipo de sesión (ej: "Race")
 * @param {string}      params.driver  - Pilotos separados por coma (ej: "VER,LEC")
 * @param {AbortSignal} signal         - Señal de cancelación del AbortController
 *
 * @returns {Promise<StintsResponseDTO>}
 * @throws {Error} Si la respuesta HTTP no es 2xx
 */
async function fetchStints({ year, round, session, driver }, signal) {
    // Construimos la URL codificando el evento y la sesión por si contienen espacios
    const url = `${API_BASE}/analysis/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/stints?drivers=${driver}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal, // Permite cancelar la petición desde el hook si los filtros cambian
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Error ${res.status}: ${body}`);
    }

    // El backend devuelve un array; lo envolvemos en el DTO raíz
    const raw = await res.json();
    return new StintsResponseDTO(raw);
}

// =============================================================================
// 3. HOOK — useStintAnalysis
//
// Capa de orquestación entre el Service y los componentes React.
// Gestiona: datos, estado de carga, error, y cancelación automática de peticiones.
// =============================================================================

/**
 * Hook personalizado que obtiene y gestiona el análisis de stints.
 *
 * @param {object|null} filters - Filtros activos de SidebarFilter
 * @returns {{ data: StintsResponseDTO|null, isLoading: boolean, error: string|null, refetch: function }}
 */
function useStintAnalysis(filters) {
    const [data,      setData]      = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error,     setError]     = useState(null);

    // 'tick' actúa como token de re-fetch: incrementarlo fuerza una nueva petición
    // sin cambiar los filtros. Lo usamos en el botón "RELOAD".
    const [tick, setTick] = useState(0);

    // useCallback evita que la función 'refetch' se recree en cada render,
    // lo que podría causar renders innecesarios en componentes hijo.
    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        // Guard de programación defensiva: no lanzar la petición si faltan datos esenciales.
        // Esto ocurre cuando el usuario aún no ha completado los filtros del Sidebar.
        if (!filters?.year || !filters?.round || !filters?.session || !filters?.driver) {
            setData(null);
            return;
        }

        // AbortController permite cancelar la petición fetch si:
        //   a) El componente se desmonta (cleanup de useEffect)
        //   b) Los filtros cambian antes de que la respuesta llegue (evita race conditions)
        const controller = new AbortController();
        setIsLoading(true);
        setError(null);

        fetchStints(filters, controller.signal)
            .then(setData)
            .catch(err => {
                // AbortError no es un error real; ocurre en el cleanup normal del hook
                if (err.name !== 'AbortError') {
                    setError(err.message ?? 'Error desconocido');
                }
            })
            .finally(() => setIsLoading(false));

        // Función de cleanup: cancela la petición en vuelo si el efecto se re-ejecuta
        return () => controller.abort();

    // Dependencias primitivas en lugar del objeto 'filters' completo.
    // Depender del objeto causaría re-renders cada vez que App.jsx se re-renderiza,
    // ya que objetos distintos con el mismo contenido no son === en JavaScript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, filters?.session, filters?.driver, tick]);

    return { data, isLoading, error, refetch };
}

// =============================================================================
// 4. SUBCOMPONENTES UI
//
// Piezas visuales pequeñas, sin estado propio, que reciben datos por props.
// Están fuera del componente principal para evitar que se redefinan en cada render.
// =============================================================================

/**
 * CompoundWheel — Rueda Pirelli que muestra la letra y el color del compuesto.
 * Usamos el mismo mapa de colores que TelemetryTable y SessionSummary
 * para mantener coherencia visual en toda la aplicación.
 *
 * @param {{ label: string, color: string, compound: string }} props
 */
function CompoundWheel({ label, color, compound }) {
    // Mapa de clases Tailwind para el borde y el texto de cada compuesto.
    // Coincide exactamente con el de TelemetryTable.
    const colorMap = {
        SOFT:         'border-red-600 text-red-500',
        MEDIUM:       'border-yellow-400 text-yellow-400',
        HARD:         'border-gray-200 text-gray-200',
        INTERMEDIATE: 'border-green-500 text-green-500',
        WET:          'border-blue-600 text-blue-500',
        UNKNOWN:      'border-purple-500 text-purple-500',
    };
    const colorClass = colorMap[compound?.toUpperCase()] ?? colorMap.UNKNOWN;

    return (
        <div
            className={`w-10 h-10 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-inner shrink-0 ${colorClass}`}
            title={compound}
        >
            {/* Letra del compuesto (S, M, H, I, W) */}
            <span className="font-black text-sm leading-none">{label}</span>
        </div>
    );
}

/**
 * StintCell — Celda de datos para un piloto en un stint concreto.
 *
 * Casos posibles:
 *   - driverData es null → el piloto no usó este stint → celda con guion
 *   - driverData es un StintDriverDataDTO → renderizamos todos los datos
 *
 * @param {{ driverData: StintDriverDataDTO|null }} props
 */
function StintCell({ driverData }) {

    // ── Caso: piloto sin datos en este stint ─────────────────────────────────
    if (!driverData) {
        return (
            <td className="border-r border-gray-800 bg-gray-900/10 text-center text-gray-700 text-2xl align-middle p-4">
                —
            </td>
        );
    }

    // ── Caso: datos disponibles ──────────────────────────────────────────────
    return (
        <td className="border-r border-gray-800 p-5 align-top bg-[#0a0a0c]">
            <div className="flex flex-col gap-4">

                {/* BLOQUE 1: Compuesto (rueda + nombre completo) + Duración
                    Muestra la rueda Pirelli, el nombre completo del compuesto (SOFT/MEDIUM/...)
                    y la duración del stint en vueltas y tiempo total. */}
                <div className="flex items-center justify-between gap-3">

                    {/* Lado izquierdo: rueda + nombre del compuesto */}
                    <div className="flex items-center gap-3">
                        <CompoundWheel
                            label={driverData.compoundLabel}
                            color={driverData.compoundColor}
                            compound={driverData.compound}
                        />
                        {/* Nombre completo del compuesto en texto grande y visible */}
                        <span className="font-black italic uppercase text-xl tracking-tight text-white">
                            {driverData.compound}
                        </span>
                    </div>

                    {/* Lado derecho: duración en vueltas y tiempo */}
                    <div className="text-right">
                        <span className="block font-black text-white text-lg leading-tight">
                            {driverData.durationLaps} laps
                        </span>
                        <span className="block font-mono text-sm text-gray-400 mt-1">
                            {driverData.durationTime}
                        </span>
                    </div>
                </div>

                {/* SEPARADOR */}
                <div className="h-px bg-gray-800" />

                {/* BLOQUE 2: Mejor vuelta
                    Destacada con borde rojo izquierdo igual que en SessionSummary.
                    Muestra el tiempo y en qué vuelta del stint se registró. */}
                <div className="border-l-2 border-red-600 pl-3 py-1">
                    <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                        Best Lap (L{driverData.bestLap.lapInStint})
                    </span>
                    <span className="block font-mono font-black text-2xl text-white tabular-nums">
                        {driverData.bestLap.time}
                    </span>
                </div>

                {/* BLOQUE 3: Métricas estadísticas
                    Promedio y mediana en dos columnas para facilitar la comparación visual. */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                            Avg
                        </span>
                        <span className="block font-mono text-lg text-gray-200 tabular-nums">
                            {driverData.average}
                        </span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                            Median
                        </span>
                        <span className="block font-mono text-lg text-gray-200 tabular-nums">
                            {driverData.median}
                        </span>
                    </div>
                </div>

                {/* BLOQUE 4: Consistencia
                    Solo el número, limpio. Sin barra ni etiquetas. */}
                <div className="border-t border-gray-800 pt-3">
                    <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                        Consistency
                    </span>
                    <span className="block font-mono font-black text-xl text-white tabular-nums">
                        {driverData.consistency.toFixed(1)}%
                    </span>
                </div>

            </div>
        </td>
    );
}

/**
 * SkeletonRow — Fila de carga animada que imita la silueta de una fila de datos real.
 * Se muestra mientras el hook está en estado isLoading.
 * Recibe el número de pilotos para generar el número correcto de columnas.
 *
 * @param {{ driverCount: number }} props
 */
function SkeletonRow({ driverCount }) {
    return (
        <tr className="border-b border-gray-800/50 animate-pulse">
            {/* Columna del número de stint */}
            <td className="p-4 border-r border-gray-800 text-center bg-black/50 w-20">
                <div className="h-8 w-12 bg-gray-800 rounded mx-auto" />
            </td>

            {/* Una celda skeleton por cada piloto */}
            {[...Array(driverCount)].map((_, i) => (
                <td key={i} className="border-r border-gray-800 p-5">
                    <div className="flex flex-col gap-4">
                        {/* Simula la rueda + nombre del compuesto */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-800 rounded-full shrink-0" />
                            <div className="h-6 bg-gray-800 rounded w-20" />
                        </div>
                        <div className="h-px bg-gray-800" />
                        {/* Simula la mejor vuelta */}
                        <div className="h-10 bg-gray-800 rounded w-36" />
                        {/* Simula avg + median */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="h-8 bg-gray-800 rounded" />
                            <div className="h-8 bg-gray-800 rounded" />
                        </div>
                        {/* Simula consistency */}
                        <div className="h-8 bg-gray-800 rounded w-20" />
                    </div>
                </td>
            ))}
        </tr>
    );
}

// =============================================================================
// 5. COMPONENTE PRINCIPAL — StintAnalysis
//
// Orquesta el hook, el layout y el renderizado condicional según el estado:
//   a) Sin filtros → pantalla de espera
//   b) Cargando    → spinner + skeleton rows
//   c) Error       → banner de error con botón de reintento
//   d) Con datos   → tabla pivotada (stints × pilotos)
// =============================================================================

export default function StintAnalysis({ filters }) {

    // Obtenemos datos, estado y la función de refresco desde el hook
    const { data, isLoading, error, refetch } = useStintAnalysis(filters);

    // Extraemos los códigos de piloto del string "VER,LEC" → ["VER", "LEC"]
    // para generar dinámicamente las columnas de la tabla
    const driverKeys = filters?.driver ? filters.driver.split(',') : [];

    // ── Estado inicial: el usuario no ha seleccionado filtros todavía ────────
    if (!filters) {
        return (
            <div className="flex h-full items-center justify-center flex-col opacity-50">
                <span className="text-6xl mb-4">🏁</span>
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">
                    Stint Analysis Standby
                </h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Selecciona parámetros y pilotos en el panel lateral para iniciar el análisis.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* ── CABECERA (mismo estilo HUD que TelemetryTable y SessionSummary) ── */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 px-5 py-4 shrink-0 flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                        Stint Analysis
                    </h3>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                        {filters.round} · {filters.session} · Season {filters.year}
                    </p>
                </div>
                {/* Botón de recarga manual — llama a refetch() del hook */}
                <button
                    onClick={refetch}
                    disabled={isLoading}
                    className="border border-gray-700 text-gray-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                    {isLoading ? '···' : '↻ RELOAD'}
                </button>
            </div>

            {/* ── BANNER DE ERROR (solo visible si la petición falló) ─────────── */}
            {error && !isLoading && (
                <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/20 px-5 py-3 shrink-0">
                    <span className="text-red-500 font-black text-lg shrink-0">⚠</span>
                    <span className="text-red-400 text-xs font-mono flex-1 break-all">{error}</span>
                    <button
                        onClick={refetch}
                        className="text-red-500 border border-red-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-red-900/30 transition-colors shrink-0"
                    >
                        RETRY
                    </button>
                </div>
            )}

            {/* ── CUERPO: TABLA PIVOTADA ────────────────────────────────────────
                Estructura: filas = stints, columnas = pilotos.
                'overflow-auto' permite scroll horizontal si hay muchos pilotos
                y scroll vertical si hay muchos stints.
            ────────────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto relative">

                {/* Spinner de carga — idéntico al de TelemetryTable */}
                {isLoading && (
                    <div className="absolute inset-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <div className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Processing Telemetry...
                        </div>
                    </div>
                )}

                <table className="w-full text-left border-collapse">

                    {/* CABECERA DE TABLA: columna STINT + una columna por piloto.
                        'sticky top-0' mantiene la cabecera visible al hacer scroll vertical. */}
                    <thead className="bg-gray-900 sticky top-0 z-10 shadow-lg">
                        <tr>
                            {/* Columna fija: número de stint */}
                            <th className="p-4 w-20 border-r border-b-2 border-gray-700 text-center text-sm uppercase font-black tracking-widest text-gray-400 bg-black">
                                STINT
                            </th>

                            {/* Una columna por piloto, generada dinámicamente desde driverKeys */}
                            {driverKeys.map(code => (
                                <th key={code} className="p-4 border-r border-b-2 border-gray-700 text-center bg-gray-900 min-w-[240px]">
                                    <span className="text-2xl font-black italic uppercase text-white tracking-tighter">
                                        {code}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="font-mono">

                        {/* SKELETON: se muestra mientras isLoading es true.
                            Usamos 3 filas fijas como placeholder visual. */}
                        {isLoading && (
                            <>
                                <SkeletonRow driverCount={driverKeys.length} />
                                <SkeletonRow driverCount={driverKeys.length} />
                                <SkeletonRow driverCount={driverKeys.length} />
                            </>
                        )}

                        {/* DATOS REALES: iteramos sobre el array de stints del DTO.
                            Cada fila representa un stint; dentro, iteramos los pilotos. */}
                        {!isLoading && data?.stints.map(stint => (
                            <tr
                                key={stint.stintNumber}
                                className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                            >
                                {/* Celda con el número de stint */}
                                <td className="p-4 border-r border-gray-800 text-center bg-black/50 align-top">
                                    <span className="text-xl font-black text-gray-400">
                                        S{stint.stintNumber}
                                    </span>
                                </td>

                                {/* Una StintCell por piloto.
                                    Si el piloto no tiene datos en este stint, driverData será null
                                    y StintCell renderizará la celda vacía con el guion. */}
                                {driverKeys.map(code => (
                                    <StintCell
                                        key={code}
                                        driverData={stint.drivers[code] ?? null}
                                    />
                                ))}
                            </tr>
                        ))}

                        {/* ESTADO VACÍO: la carga terminó pero no hay stints que mostrar */}
                        {!isLoading && !error && (!data || data.stints.length === 0) && (
                            <tr>
                                <td colSpan={driverKeys.length + 1} className="text-center py-16">
                                    <div className="flex flex-col items-center opacity-50">
                                        <span className="text-5xl mb-3">🏁</span>
                                        <p className="text-gray-500 font-black italic uppercase tracking-widest">
                                            No stint data available
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}

                    </tbody>
                </table>
            </div>
        </div>
    );
}