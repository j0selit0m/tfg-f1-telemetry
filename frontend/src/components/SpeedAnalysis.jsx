// =============================================================================
// SpeedAnalysis.jsx
//
// Visualización interactiva de telemetría de velocidad a lo largo de la pista.
//
// Zoom/Pan: implementado con estado de dominio propio sobre el eje X.
//   Al filtrar los datos al rango visible antes de pasarlos a Recharts,
//   las líneas se desplazan visualmente en lugar de quedarse estáticas.
//   El listener de rueda se registra con { passive: false } para poder
//   llamar preventDefault() y evitar que la página haga scroll al mismo tiempo.
//
// Crosshair: tracking directo del ratón sobre el div contenedor (no eventos
//   de Recharts, que solo disparan en puntos de datos exactos). La velocidad
//   de cada piloto se obtiene por interpolación lineal entre los dos puntos
//   más cercanos al cursor.
//
// Selección de vueltas: formato "ALO:Race:44, SAI:Qualifying:1".
//   El número de vuelta es opcional — si se omite el backend usa la fastest lap
//   de esa sesión. Al cambiar los filtros del sidebar el input se reinicia
//   con los valores por defecto (piloto + sesión seleccionada).
// =============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    ReferenceLine,
    ComposedChart,
    ResponsiveContainer,
    Legend,
} from 'recharts';

const API_BASE = 'http://localhost:8000/api';
const ZOOM_FACTOR = 0.15;

// Altura compartida por el div contenedor, el ResponsiveContainer y los estados
// de carga/vacío. Centralizada para evitar inconsistencias entre los tres.
const CHART_HEIGHT = 555;

// Ancho estimado del eje Y de Recharts (labels + ticks).
// Usado para convertir posición de píxeles a metros en el crosshair y el zoom.
// No corresponde a margin.left (que es 20), sino al área total que ocupa el eje.
const CHART_MARGIN_LEFT = 70;
const CHART_MARGIN_RIGHT = 30;

const SESSIONS = ['Race', 'Qualifying', 'FP1', 'FP2', 'FP3', 'Sprint'];

// =============================================================================
// 1. DTOs — Modelado de la respuesta del backend
// =============================================================================

class DataPointDTO {
    constructor(raw = {}) {
        this.distance = typeof raw.distance === 'number' ? raw.distance : 0;
        this.speed = typeof raw.speed === 'number' ? raw.speed : 0;
    }
}

class DriverTelemetryDTO {
    constructor(raw = {}) {
        this.key = (raw.key ?? '').replaceAll(':', '_'); // SAI_Race_65
        this.driverCode = raw.driver ?? '';
        this.session = raw.session ?? '';
        this.lapNumber = typeof raw.lap_number === 'number' ? raw.lap_number : 0;
        this.data = Array.isArray(raw.data) ? raw.data.map(d => new DataPointDTO(d)) : [];
    }
}

class CornerDTO {
    constructor(raw = {}) {
        this.number = typeof raw.number === 'number' ? raw.number : 0;
        this.letter = raw.letter ?? '';
        this.distance = typeof raw.distance === 'number' ? raw.distance : 0;
    }
    get displayLabel() {
        return this.letter ? `${this.number}${this.letter}` : `${this.number}`;
    }
}

class SpeedTelemetryDTO {
    constructor(raw = {}) {
        this.corners = Array.isArray(raw.corners) ? raw.corners.map(c => new CornerDTO(c)) : [];
        // Indexamos por key para acceso O(1) en crosshair e interpolación
        this.drivers = Object.fromEntries(
            (raw.drivers ?? []).map(d => {
                const dto = new DriverTelemetryDTO(d);
                return [dto.key, dto];
            })
        )
    }
    get maxDistance() {
        let max = 0;
        Object.values(this.drivers).forEach(driver => {
            if (driver.data.length > 0)
                max = Math.max(max, driver.data[driver.data.length - 1].distance);
        });
        return Math.ceil(max);
    }
}

// =============================================================================
// 2. SERVICE — Comunicación con el backend
// =============================================================================

// driverParam tiene el formato "ALO:Race:44,SAI:Qualifying:1" o "ALO:Race,SAI:Race".
// La sesión ya no va en el path — cada piloto lleva la suya en el query param.
async function fetchSpeedTelemetry({ year, round, driverParam }, signal) {
    const url = `${API_BASE}/telemetry/${year}/${encodeURIComponent(round)}/speed?drivers=${encodeURIComponent(driverParam)}`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return new SpeedTelemetryDTO(await res.json());
}

// =============================================================================
// 3. HOOK — useSpeedTelemetry
// =============================================================================

// driverParam reemplaza a los anteriores parámetros driver+session+laps.
// Contiene toda la información necesaria para la petición en un único string,
// lo que simplifica las dependencias del efecto y evita fetches dobles.
function useSpeedTelemetry(filters, driverParam) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!filters?.year || !filters?.round || !driverParam) {
            setData(null);
            return;
        }
        const controller = new AbortController();
        setIsLoading(true);
        setError(null);
        fetchSpeedTelemetry(
            { year: filters.year, round: filters.round, driverParam },
            controller.signal
        )
            .then(setData)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message ?? 'Error'); })
            .finally(() => setIsLoading(false));
        return () => controller.abort();
        // Las dependencias son primitivas para evitar re-ejecuciones por
        // cambios de referencia del objeto filters en el padre.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, driverParam]);

    return { data, isLoading, error };
}

// =============================================================================
// 4. HOOK — useChartZoom
//
// Gestiona el dominio visible del eje X [start, end] y los eventos de
// rueda, arrastre y doble clic para zoom y paneo.
//
// El listener de rueda se registra mediante un callback ref en lugar de useRef
// estándar. Un callback ref recibe el nodo DOM en el momento exacto en que
// aparece en pantalla, evitando el problema de que el useEffect se ejecute
// antes de que el elemento exista (ya que el gráfico está condicionado a `data`).
// =============================================================================

function useChartZoom(maxDistance) {
    const [domainStart, setDomainStart] = useState(0);
    const [domainEnd, setDomainEnd] = useState(0);

    // domainRef permite que el listener de rueda lea siempre el dominio actual
    // sin necesidad de re-registrarse cada vez que cambia el estado.
    const domainRef = useRef({ start: 0, end: 0, max: 0 });
    const nodeRef = useRef(null);
    const panRef = useRef({ active: false, startX: 0, startDomainStart: 0, startDomainEnd: 0 });

    useEffect(() => {
        if (maxDistance && maxDistance > 0) {
            setDomainStart(0);
            setDomainEnd(maxDistance);
            domainRef.current = { start: 0, end: maxDistance, max: maxDistance };
        }
    }, [maxDistance]);

    useEffect(() => {
        domainRef.current.start = domainStart;
        domainRef.current.end = domainEnd;
    }, [domainStart, domainEnd]);

    const applyDomain = useCallback((newStart, newEnd) => {
        const max = domainRef.current.max;
        const range = newEnd - newStart;
        let s = newStart;
        let e = newEnd;
        if (s < 0) { s = 0; e = range; }
        if (e > max) { e = max; s = max - range; }
        s = Math.max(0, s);
        e = Math.min(max, e);
        setDomainStart(s);
        setDomainEnd(e);
        domainRef.current.start = s;
        domainRef.current.end = e;
    }, []);

    // Convierte una posición X del ratón (clientX) a metros sobre la pista.
    const pixelToDistance = useCallback((clientX) => {
        if (!nodeRef.current) return null;
        const rect = nodeRef.current.getBoundingClientRect();
        const chartWidth = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const ratio = Math.max(0, Math.min(1,
            (clientX - rect.left - CHART_MARGIN_LEFT) / chartWidth
        ));
        const { start, end } = domainRef.current;
        return start + ratio * (end - start);
    }, []);

    // Callback ref: React lo llama con el nodo cuando el elemento se monta y
    // con null cuando se desmonta. Registramos el listener aquí para garantizar
    // que el nodo exista. La referencia al handler se guarda en el propio nodo
    // para poder eliminarlo en el cleanup sin necesidad de un ref adicional.
    const containerRef = useCallback((node) => {
        if (nodeRef.current?._onWheel) {
            nodeRef.current.removeEventListener('wheel', nodeRef.current._onWheel);
        }
        if (!node) { nodeRef.current = null; return; }

        function onWheel(e) {
            e.preventDefault();
            const rect = node.getBoundingClientRect();
            const chartWidth = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
            const mouseRatio = Math.max(0, Math.min(1,
                (e.clientX - rect.left - CHART_MARGIN_LEFT) / chartWidth
            ));
            const { start, end } = domainRef.current;
            const currentRange = end - start;
            const delta = e.deltaY > 0 ? 1 : -1;
            const newRange = Math.max(100, Math.min(
                domainRef.current.max,
                currentRange * (1 + delta * ZOOM_FACTOR)
            ));
            const mouseDistance = start + mouseRatio * currentRange;
            applyDomain(
                mouseDistance - mouseRatio * newRange,
                mouseDistance - mouseRatio * newRange + newRange
            );
        }

        node._onWheel = onWheel;
        node.addEventListener('wheel', onWheel, { passive: false });
        nodeRef.current = node;
    }, [applyDomain]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        panRef.current = {
            active: true,
            startX: e.clientX,
            startDomainStart: domainRef.current.start,
            startDomainEnd: domainRef.current.end,
        };
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!panRef.current.active || !nodeRef.current) return;
        const rect = nodeRef.current.getBoundingClientRect();
        const chartWidth = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const range = panRef.current.startDomainEnd - panRef.current.startDomainStart;
        const delta = -(e.clientX - panRef.current.startX) / chartWidth * range;
        applyDomain(
            panRef.current.startDomainStart + delta,
            panRef.current.startDomainEnd + delta
        );
    }, [applyDomain]);

    const handleMouseUp = useCallback(() => { panRef.current.active = false; }, []);

    const resetZoom = useCallback(() => {
        const max = domainRef.current.max;
        setDomainStart(0);
        setDomainEnd(max);
        domainRef.current.start = 0;
        domainRef.current.end = max;
    }, []);

    const zoomPercent = maxDistance && (domainEnd - domainStart) > 0
        ? Math.round((maxDistance / (domainEnd - domainStart)) * 100)
        : 100;

    return {
        domain: [domainStart, domainEnd],
        containerRef,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        resetZoom,
        zoomPercent,
        pixelToDistance,
    };
}

// =============================================================================
// 5. UTILIDADES
// =============================================================================

// Fusiona los arrays de datos de todos los pilotos en un único array ordenado
// por distancia, donde cada entrada contiene la velocidad de cada piloto.
// Recharts necesita este formato para renderizar múltiples líneas en el mismo eje.
function mergeDriverData(drivers) {
    const map = {};
    Object.entries(drivers).forEach(([key, driver]) => {
        driver.data.forEach(point => {
            if (!map[point.distance]) map[point.distance] = { distance: point.distance };
            map[point.distance][key] = point.speed;
        });
    });
    const result = Object.values(map).sort((a, b) => a.distance - b.distance);
    return result;
}

/**
 * Construye el string driverParam para el backend a partir de los filtros
 * del sidebar. Formato resultante: "ALO:Race,SAI:Race" (sin vuelta → fastest lap).
 * Se usa como valor por defecto cuando el usuario no ha especificado vueltas.
 *
 * @param {string} driverList - "ALO,SAI"
 * @param {string} session    - "Race"
 * @returns {string}          - "ALO:Race,SAI:Race"
 */
function buildParamFromRows(rows) {
    return rows
        .map(r => r.lap ? `${r.driver}:${r.session}:${r.lap}` : `${r.driver}:${r.session}`)
        .join(',');
}

/**
 * Parsea el input del usuario al formato que espera el backend.
 * Acepta "ALO:Race:44, SAI:Qualifying:1" o "ALO:Race, SAI:Qualifying" (sin vuelta).
 *
 * @param {string} input - Texto introducido por el usuario
 * @returns {string|null} - String para el backend, o null si el formato es inválido
 */
function parseDriverInput(input) {
    const entries = input.split(',').map(s => s.trim()).filter(Boolean);
    const result = [];

    for (const entry of entries) {
        const parts = entry.split(':').map(s => s.trim());
        if (parts.length < 2) return null;
        const [code, session, lap] = parts;
        if (!code || !session) return null;
        if (lap && isNaN(lap)) return null;
        result.push(lap ? `${code}:${session}:${lap}` : `${code}:${session}`);
    }

    return result.length > 0 ? result.join(',') : null;
}

/**
 * Devuelve la velocidad interpolada linealmente para un piloto en una distancia
 * arbitraria. Al interpolar entre los dos puntos más cercanos, el crosshair
 * muestra valores continuos en lugar de saltar entre muestras del backend.
 *
 * @param {DataPointDTO[]} driverData - Puntos ordenados por distancia ascendente
 * @param {number} targetDistance - Distancia objetivo en metros
 * @returns {number|null} Velocidad en km/h redondeada, o null si no hay datos
 */
function interpolateSpeed(driverData, targetDistance) {
    if (!driverData?.length) return null;

    let lo = null;
    let hi = null;

    for (let i = 0; i < driverData.length; i++) {
        if (driverData[i].distance <= targetDistance) lo = driverData[i];
        else { hi = driverData[i]; break; }
    }

    if (!lo) return hi?.speed ?? null;
    if (!hi) return lo?.speed ?? null;

    const t = (targetDistance - lo.distance) / (hi.distance - lo.distance);
    return Math.round(lo.speed + t * (hi.speed - lo.speed));
}

// =============================================================================
// 6. SUBCOMPONENTES
// =============================================================================

/**
 * Panel de información del crosshair, estilo Tracing Insights.
 * Muestra la distancia exacta del cursor y la velocidad interpolada de cada piloto.
 * Se posiciona en la esquina superior derecha del área del gráfico.
 *
 * pointer-events: none para que el panel no capture eventos del ratón
 * e interfiera con el tracking del crosshair o el zoom.
 */
function CrosshairPanel({ distance, driverSpeeds, getDriverColor }) {
    if (distance === null) return null;

    return (
        <div
            style={{ position: 'absolute', top: 28, right: 40, zIndex: 20, pointerEvents: 'none' }}
            className="bg-black/90 border border-gray-700 shadow-xl font-mono text-xs min-w-[200px]"
        >
            <div className="border-b border-gray-700 px-3 py-1.5">
                <span className="text-gray-500 uppercase tracking-widest text-[10px]">Distance</span>
                <span className="block text-white font-black text-lg tabular-nums">
                    {Math.round(distance)} m
                </span>
            </div>

            <div className="px-3 py-2 flex flex-col gap-2">
                {Object.entries(driverSpeeds).map(([code, speed]) => (
                    <div key={code} className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-1.5">
                            <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: getDriverColor(code) }}
                            />
                            <span
                                className="font-black uppercase tracking-tight text-sm"
                                style={{ color: getDriverColor(code) }}
                            >
                                {code}
                            </span>
                        </div>
                        <span className="text-white font-black tabular-nums text-sm">
                            {speed !== null ? `${speed} km/h` : '—'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LapSelector({ rows, setRows, availableDrivers, availableSessions, onLoad, isLoading }) {
    const addRow = () => setRows(prev => [
        ...prev,
        { driver: availableDrivers[0], session: 'Race', lap: '' }
    ]);

    const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

    const updateRow = (i, field, value) =>
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

    return (
        <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                    <select
                        value={row.driver}
                        onChange={e => updateRow(i, 'driver', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono"
                    >
                        {availableDrivers.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>

                    <select
                        value={row.session}
                        onChange={e => updateRow(i, 'session', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono"
                    >
                        {availableSessions.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <input
                        type="number"
                        placeholder="Nº lap"
                        title="Leave empty for fastest lap"
                        value={row.lap}
                        onChange={e => updateRow(i, 'lap', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono w-20"
                    />

                    <button
                        onClick={() => removeRow(i)}
                        disabled={rows.length === 1}
                        className="text-gray-600 hover:text-red-500 disabled:opacity-20 transition-colors font-mono text-sm"
                    >
                        ✕
                    </button>
                </div>
            ))}

            <div className="flex items-center gap-2 mt-1">
                <button
                    onClick={addRow}
                    className="border border-gray-700 text-gray-500 px-2 py-1 text-[10px] font-bold uppercase tracking-widest hover:border-gray-500 hover:text-white transition-colors"
                >
                    + ADD
                </button>
                <button
                    onClick={onLoad}
                    disabled={isLoading}
                    className="border border-gray-700 text-gray-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:border-red-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? '···' : '↻ LOAD'}
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// 7. COMPONENTE PRINCIPAL
// =============================================================================

export default function SpeedAnalysis({ filters }) {
    const [rows, setRows] = useState([]);
    const [driverParam, setDriverParam] = useState('');
    const [fastestKeys, setFastestKeys] = useState(new Set()); // keys sin vuelta especificada


    const [crosshairDistance, setCrosshairDistance] = useState(null);
    const [crosshairSpeeds, setCrosshairSpeeds] = useState({});

    // Cuando cambian los filtros del sidebar, reconstruimos el input con los
    // valores por defecto (todos los pilotos con la sesión seleccionada)
    // y lanzamos el fetch automáticamente sin que el usuario pulse LOAD.
    const availableDrivers = filters?.driver ? filters.driver.split(',').map(s => s.trim()) : [];

    useEffect(() => {
        if (!filters?.driver || !filters?.session) return;
        const defaultRows = availableDrivers.map(code => ({
            driver: code, session: filters.session, lap: '',
        }));
        setRows(defaultRows);
        setDriverParam(buildParamFromRows(defaultRows));
        setFastestKeys(new Set()); // se recalcula en el load
    }, [filters?.year, filters?.round, filters?.driver, filters?.session]);

    const { data, isLoading, error } = useSpeedTelemetry(filters, driverParam);

    // driverKeys = ["ALO:Race:44", "ALO:Race:65"] — claves únicas para las Lines
    const driverKeys = useMemo(
        () => data ? Object.keys(data.drivers) : [],
        [data]
    );

    // El color se obtiene del driverCode real, no de la key
    const getDriverColor = useCallback((key) => {
        const code = data?.drivers[key]?.driverCode ?? key.split(':')[0];
        return filters?.driverColors?.[code] ?? '#9ca3af';
    }, [filters, data]);

    const allMergedData = useMemo(
        () => (data ? mergeDriverData(data.drivers) : []),
        [data]
    );

    const {
        domain,
        containerRef,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        resetZoom,
        zoomPercent,
        pixelToDistance,
    } = useChartZoom(data?.maxDistance ?? 0);

    // Filtramos los datos al rango visible antes de pasarlos a Recharts.
    // Sin este filtrado, Recharts actualiza las etiquetas del eje X pero las
    // líneas permanecen en sus posiciones originales al hacer zoom.
    // El buffer del 2% evita que las líneas se corten abruptamente en los bordes.
    const visibleData = useMemo(() => {
        if (!allMergedData.length) return [];
        const buffer = (domain[1] - domain[0]) * 0.02;
        return allMergedData.filter(
            d => d.distance >= domain[0] - buffer && d.distance <= domain[1] + buffer
        );
    }, [allMergedData, domain]);

    const handleLoad = useCallback(() => {
        const param = buildParamFromRows(rows);
        // Guardamos qué entradas son fastest (lap vacío) para la leyenda
        const fastest = new Set(
            rows.filter(r => !r.lap).map(r => `${r.driver}_${r.session}`)
        );
        setFastestKeys(fastest);
        setDriverParam(param);
    }, [rows]);

    // Gestiona panning y crosshair con un único handler para evitar duplicar
    // la lógica de conversión píxel → metros.
    const handleContainerMouseMove = useCallback((e) => {
        handleMouseMove(e);

        const distance = pixelToDistance(e.clientX);
        if (distance === null || !data) return;

        setCrosshairDistance(distance);

        const speeds = {};
        driverKeys.forEach(key => {
            speeds[key] = interpolateSpeed(data.drivers[key]?.data ?? [], distance);
        });
        setCrosshairSpeeds(speeds);
    }, [handleMouseMove, pixelToDistance, data, driverKeys]);

    const handleContainerMouseLeave = useCallback((e) => {
        handleMouseUp(e);
        setCrosshairDistance(null);
        setCrosshairSpeeds({});
    }, [handleMouseUp]);

    if (!filters) {
        return (
            <div className="flex items-center justify-center flex-col opacity-50" style={{ height: CHART_HEIGHT }}>
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">
                    Speed Analysis
                </h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Selecciona parámetros y pilotos en el panel lateral.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* CABECERA */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 px-5 py-3 shrink-0 flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                        Speed Telemetry
                    </h3>
                    {/* Sesión y vuelta por piloto — pueden ser distintas entre entradas */}
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                        {filters.round} · Season {filters.year}
                        {data && Object.values(data.drivers).map(d => {
                            const sessionShort = d.session === 'Race' ? 'R' : d.session === 'Qualifying' ? 'Q' : d.session.slice(0, 2);
                            return ` · ${d.driverCode} (${sessionShort}, L${d.lapNumber})`;
                        })}
                    </p>
                </div>

                <LapSelector
                    rows={rows}
                    setRows={setRows}
                    availableDrivers={availableDrivers}
                    availableSessions={filters?.availableSessions ?? []}
                    onLoad={handleLoad}
                    isLoading={isLoading}
                />
            </div>

            {/* ERROR */}
            {error && !isLoading && (
                <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/20 px-5 py-3">
                    <span className="text-red-500 font-black shrink-0">⚠</span>
                    <span className="text-red-400 text-xs font-mono flex-1 break-all">{error}</span>
                </div>
            )}

            {/* ÁREA DEL GRÁFICO
                position: relative necesario para que CrosshairPanel (absolute)
                se posicione relativo a este contenedor y no a la página. */}
            <div className="relative bg-[#0a0a0c]">

                {isLoading && (
                    <div
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-sm"
                        style={{ height: CHART_HEIGHT }}
                    >
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Generating telemetry...
                        </p>
                    </div>
                )}

                {!isLoading && data && (
                    <>
                        <CrosshairPanel
                            distance={crosshairDistance}
                            driverSpeeds={crosshairSpeeds}
                            getDriverColor={getDriverColor}
                        />

                        <div
                            ref={containerRef}
                            style={{ width: '100%', height: CHART_HEIGHT, cursor: 'crosshair', userSelect: 'none' }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleContainerMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleContainerMouseLeave}
                            onDoubleClick={resetZoom}
                        >
                            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                                <ComposedChart
                                    data={visibleData}
                                    margin={{ top: 25, right: 30, left: 20, bottom: 10 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

                                    <XAxis
                                        dataKey="distance"
                                        type="number"
                                        domain={domain}
                                        tickCount={10}
                                        stroke="#6b7280"
                                        tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                        tickFormatter={v => `${Math.round(v)}`}
                                        label={{
                                            value: 'Distance (m)',
                                            position: 'insideBottom',
                                            offset: -5,
                                            fill: '#6b7280',
                                            fontSize: 14,
                                            fontFamily: 'monospace',
                                        }}
                                    />

                                    <YAxis
                                        tickCount={12}
                                        stroke="#6b7280"
                                        tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                        label={{
                                            value: 'Speed (km/h)',
                                            angle: -90,
                                            position: 'insideLeft',
                                            offset: 15,
                                            fill: '#6b7280',
                                            fontSize: 14,
                                            fontFamily: 'monospace',
                                        }}
                                    />

                                    {data.corners
                                        .filter(c => c.distance >= domain[0] && c.distance <= domain[1])
                                        .map(corner => (
                                            <ReferenceLine
                                                key={`c-${corner.number}-${corner.letter}`}
                                                x={corner.distance}
                                                stroke="#374151"
                                                strokeWidth={1}
                                                label={{
                                                    value: corner.displayLabel,
                                                    position: 'top',
                                                    fill: '#6b7280',
                                                    fontSize: 12,
                                                    fontFamily: 'monospace',
                                                }}
                                            />
                                        ))}

                                    {crosshairDistance !== null && (
                                        <ReferenceLine
                                            x={crosshairDistance}
                                            stroke="#dc2626"
                                            strokeWidth={1.5}
                                            strokeOpacity={0.8}
                                        />
                                    )}

                                    <Legend
                                        verticalAlign="bottom"
                                        height={30}
                                        wrapperStyle={{ paddingTop: '15px', fontSize: 12, fontFamily: 'monospace' }}
                                        formatter={value => {
                                            const driver = data?.drivers[value];
                                            if (!driver) return value;
                                            // La key transformada sin número: ALO_Race (para comparar con fastestKeys)
                                            const baseKey = `${driver.driverCode}_${driver.session}`;
                                            const isFastest = fastestKeys.has(baseKey);
                                            const lapLabel = isFastest ? `L${driver.lapNumber} Fastest` : `L${driver.lapNumber}`;
                                            return (
                                                <span style={{ color: getDriverColor(value), fontWeight: 'bold' }}>
                                                    {`${driver.driverCode} (${driver.session}, ${lapLabel})`}
                                                </span>
                                            );
                                        }}
                                    />

                                    {driverKeys.map(code => (
                                        <Line
                                            key={code}
                                            type="monotone"
                                            dataKey={code}
                                            stroke={getDriverColor(code)}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={false}
                                            isAnimationActive={false}
                                            connectNulls={true}
                                            name={code}
                                        />
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}

                {!isLoading && !error && !data && (
                    <div
                        className="flex items-center justify-center flex-col opacity-50"
                        style={{ height: CHART_HEIGHT }}
                    >
                        <p className="text-gray-500 font-black italic uppercase tracking-widest">
                            Selecciona una sesión y pulsa Load
                        </p>
                    </div>
                )}
            </div>

            {/* BARRA DE CONTROLES */}
            {data && (
                <div className="border-t border-gray-800 px-5 py-2 flex items-center justify-between text-xs font-mono">
                    <div className="flex gap-5 text-gray-600">
                        <span><strong className="text-gray-500">Rueda</strong> → Zoom</span>
                        <span><strong className="text-gray-500">Arrastrar</strong> → Pan</span>
                        <span><strong className="text-gray-500">Doble click</strong> → Reset</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-gray-600">
                            {Math.round(domain[0])}m → {Math.round(domain[1])}m
                        </span>
                        <span className="text-red-600 font-black">{zoomPercent}%</span>
                        <button
                            onClick={resetZoom}
                            className="border border-gray-700 text-gray-500 px-2 py-0.5 hover:border-gray-500 hover:text-white transition-colors"
                        >
                            RESET
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}