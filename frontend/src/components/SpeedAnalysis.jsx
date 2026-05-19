// =============================================================================
// SpeedAnalysis.jsx
//
// RESPONSABILIDAD: Visualización interactiva de telemetría de velocidad.
//
// ZOOM/PAN: Implementado con estado de dominio propio.
// El zoom cambia el rango visible del eje X (zoom de datos), no escala el SVG.
//   - Rueda del ratón → acercar/alejar centrado en la posición del cursor
//   - Arrastrar        → desplazar el rango visible
//   - Doble click      → resetear al rango completo
//
// NOTA TÉCNICA: El listener de rueda se registra manualmente con { passive: false }
// para poder llamar preventDefault() y evitar que la página haga scroll.
// Si se usa el onWheel de React, el evento es passive y preventDefault() no funciona.
//
// ENDPOINT:
//   GET /api/telemetry/{year}/{event_name}/{session_name}/speed?drivers=VER,LEC[&laps=44,66]
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ComposedChart,
    ResponsiveContainer,
} from 'recharts';

const API_BASE   = 'http://localhost:8000/api';
const ZOOM_FACTOR = 0.15; // 15% de cambio de rango por tick de rueda

const DRIVER_COLORS = {
    VER: '#3b82f6', PER: '#60a5fa',
    LEC: '#dc2626', SAI: '#f87171',
    HAM: '#34d399', RUS: '#6ee7b7',
    ALO: '#10b981', STR: '#059669',
    NOR: '#f97316', PIA: '#fb923c',
    GAS: '#818cf8', OCO: '#a5b4fc',
    HUL: '#e5e7eb', MAG: '#d1d5db',
    BOT: '#8b5cf6', ZHO: '#a78bfa',
    TSU: '#fbbf24', LAW: '#f59e0b',
    ALB: '#38bdf8', COL: '#7dd3fc',
};

// =============================================================================
// 1. DTOs
// =============================================================================

class DataPointDTO {
    constructor(raw = {}) {
        this.distance = typeof raw.distance === 'number' ? raw.distance : 0;
        this.speed    = typeof raw.speed    === 'number' ? raw.speed    : 0;
    }
}

class DriverTelemetryDTO {
    constructor(driverCode, raw = {}) {
        this.driverCode = driverCode;
        this.lapNumber  = typeof raw.lap_number === 'number' ? raw.lap_number : 0;
        this.data       = Array.isArray(raw.data) ? raw.data.map(d => new DataPointDTO(d)) : [];
    }
}

class CornerDTO {
    constructor(raw = {}) {
        this.number   = typeof raw.number   === 'number' ? raw.number   : 0;
        this.letter   = raw.letter ?? '';
        this.distance = typeof raw.distance === 'number' ? raw.distance : 0;
    }
    get displayLabel() {
        return this.letter ? `${this.number}${this.letter}` : `${this.number}`;
    }
}

class SpeedTelemetryDTO {
    constructor(raw = {}) {
        this.corners = Array.isArray(raw.corners) ? raw.corners.map(c => new CornerDTO(c)) : [];
        this.drivers = Object.fromEntries(
            Object.entries(raw.drivers ?? {}).map(([code, data]) => [
                code, new DriverTelemetryDTO(code, data),
            ])
        );
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
// 2. SERVICE
// =============================================================================

async function fetchSpeedTelemetry({ year, round, session, driver, laps }, signal) {
    let url = `${API_BASE}/telemetry/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/speed?drivers=${driver}`;
    if (laps && laps.trim()) url += `&laps=${laps}`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return new SpeedTelemetryDTO(await res.json());
}

// =============================================================================
// 3. HOOK — useSpeedTelemetry
// =============================================================================

function useSpeedTelemetry(filters, laps = '') {
    const [data,      setData]      = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error,     setError]     = useState(null);

    useEffect(() => {
        if (!filters?.year || !filters?.round || !filters?.session || !filters?.driver) {
            setData(null);
            return;
        }
        const controller = new AbortController();
        setIsLoading(true);
        setError(null);
        fetchSpeedTelemetry(
            { year: filters.year, round: filters.round, session: filters.session, driver: filters.driver, laps },
            controller.signal
        )
            .then(setData)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message ?? 'Error'); })
            .finally(() => setIsLoading(false));
        return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, filters?.session, filters?.driver, laps]);

    return { data, isLoading, error };
}

// =============================================================================
// 4. HOOK — useChartZoom
//
// Patrón de ref para el handler de rueda:
// Guardamos los valores actuales de dominio en una ref y los leemos dentro
// del listener. Así el listener nunca queda "stale" y no necesitamos
// re-registrarlo cada vez que cambia el dominio.
// =============================================================================

function useChartZoom(maxDistance) {
    const [domainStart, setDomainStart] = useState(0);
    const [domainEnd,   setDomainEnd]   = useState(0);

    // Ref que guarda siempre los valores más recientes del dominio.
    // El listener de rueda la lee en lugar de capturar el estado directamente.
    const domainRef = useRef({ start: 0, end: 0, max: 0 });

    // Ref del contenedor DOM para calcular posición del cursor
    const containerRef = useRef(null);

    // Ref de estado de panning
    const panRef = useRef({ active: false, startX: 0, startDomainStart: 0, startDomainEnd: 0 });

    // Cuando llegan datos nuevos, inicializamos el dominio al rango completo
    useEffect(() => {
        if (maxDistance && maxDistance > 0) {
            setDomainStart(0);
            setDomainEnd(maxDistance);
            domainRef.current = { start: 0, end: maxDistance, max: maxDistance };
        }
    }, [maxDistance]);

    // Sincronizamos la ref con el estado en cada render
    useEffect(() => {
        domainRef.current.start = domainStart;
        domainRef.current.end   = domainEnd;
    }, [domainStart, domainEnd]);

    // Helper interno para aplicar un nuevo dominio con clamp
    const applyDomain = useCallback((newStart, newEnd) => {
        const max   = domainRef.current.max;
        const range = newEnd - newStart;
        let s = newStart;
        let e = newEnd;
        if (s < 0)   { s = 0;   e = range; }
        if (e > max) { e = max; s = max - range; }
        s = Math.max(0, s);
        e = Math.min(max, e);
        setDomainStart(s);
        setDomainEnd(e);
        domainRef.current.start = s;
        domainRef.current.end   = e;
    }, []);

    // Registra el listener de rueda con { passive: false } para poder
    // llamar preventDefault() y evitar que la página haga scroll al mismo tiempo
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        function onWheel(e) {
            e.preventDefault(); // Bloquea el scroll de página — solo funciona con passive: false

            const rect       = el.getBoundingClientRect();
            const chartLeft  = 70;  // ancho del eje Y de Recharts (px)
            const chartRight = 30;  // margen derecho (px)
            const chartWidth = rect.width - chartLeft - chartRight;

            // Posición del cursor en el área de datos (0 = izquierda, 1 = derecha)
            const mouseRatio = Math.max(0, Math.min(1,
                (e.clientX - rect.left - chartLeft) / chartWidth
            ));

            const { start, end } = domainRef.current;
            const currentRange   = end - start;

            // Scroll hacia arriba = zoom in (rango más pequeño)
            // Scroll hacia abajo  = zoom out (rango más grande)
            const delta    = e.deltaY > 0 ? 1 : -1;
            const newRange = Math.max(100, Math.min(
                domainRef.current.max,
                currentRange * (1 + delta * ZOOM_FACTOR)
            ));

            // El punto bajo el cursor se mantiene fijo visualmente
            const mouseDistance = start + mouseRatio * currentRange;
            const newStart      = mouseDistance - mouseRatio * newRange;
            const newEnd        = newStart + newRange;

            applyDomain(newStart, newEnd);
        }

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [applyDomain]); // Solo se re-registra si applyDomain cambia (nunca en la práctica)

    // PAN: inicio del arrastre
    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        panRef.current = {
            active: true,
            startX: e.clientX,
            startDomainStart: domainRef.current.start,
            startDomainEnd:   domainRef.current.end,
        };
    }, []);

    // PAN: movimiento
    const handleMouseMove = useCallback((e) => {
        if (!panRef.current.active || !containerRef.current) return;

        const rect       = containerRef.current.getBoundingClientRect();
        const chartLeft  = 70;
        const chartWidth = rect.width - chartLeft - 30;

        const pixelsDelta = e.clientX - panRef.current.startX;
        const range       = panRef.current.startDomainEnd - panRef.current.startDomainStart;
        const metersDelta = -(pixelsDelta / chartWidth) * range;

        applyDomain(
            panRef.current.startDomainStart + metersDelta,
            panRef.current.startDomainEnd   + metersDelta
        );
    }, [applyDomain]);

    // PAN: fin del arrastre
    const handleMouseUp = useCallback(() => {
        panRef.current.active = false;
    }, []);

    // Reset al rango completo
    const resetZoom = useCallback(() => {
        const max = domainRef.current.max;
        setDomainStart(0);
        setDomainEnd(max);
        domainRef.current.start = 0;
        domainRef.current.end   = max;
    }, []);

    // Porcentaje de zoom (100% = vista completa)
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
    };
}

// =============================================================================
// 5. UTILIDADES
// =============================================================================

function mergeDriverData(drivers) {
    const map = {};
    Object.entries(drivers).forEach(([code, driver]) => {
        driver.data.forEach(point => {
            if (!map[point.distance]) map[point.distance] = { distance: point.distance };
            map[point.distance][code] = point.speed;
        });
    });
    return Object.values(map).sort((a, b) => a.distance - b.distance);
}

// =============================================================================
// 6. SUBCOMPONENTES
// =============================================================================

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#1a1a2a] border border-red-600/50 rounded p-3 shadow-xl text-xs font-mono min-w-[140px]">
            <p className="text-gray-400 font-bold uppercase tracking-widest mb-2">
                {Math.round(label)} m
            </p>
            {payload.map(entry => (
                <div key={entry.name} className="flex justify-between gap-6">
                    <span style={{ color: entry.color }} className="font-black">{entry.name}</span>
                    <span className="text-white font-black">
                        {entry.value != null ? `${Math.round(entry.value)} km/h` : '—'}
                    </span>
                </div>
            ))}
        </div>
    );
}

// =============================================================================
// 7. COMPONENTE PRINCIPAL
// =============================================================================

export default function SpeedAnalysis({ filters }) {
    const [lapInput,    setLapInput]    = useState('');
    const [lapsToFetch, setLapsToFetch] = useState('');

    const { data, isLoading, error } = useSpeedTelemetry(filters, lapsToFetch);
    const driverKeys = filters?.driver ? filters.driver.split(',') : [];
    const mergedData = data ? mergeDriverData(data.drivers) : [];

    const {
        domain,
        containerRef,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        resetZoom,
        zoomPercent,
    } = useChartZoom(data?.maxDistance ?? 0);

    const handleApplyLaps = useCallback(() => setLapsToFetch(lapInput.trim()), [lapInput]);

    // ── Standby ──────────────────────────────────────────────────────────────
    if (!filters) {
        return (
            <div className="flex h-64 items-center justify-center flex-col opacity-50">
                <span className="text-6xl mb-4">📈</span>
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">
                    Speed Analysis Standby
                </h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Selecciona parámetros y pilotos en el panel lateral.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* ── CABECERA ────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 px-5 py-3 shrink-0 flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                        Speed Telemetry
                    </h3>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                        {filters.round} · {filters.session} · Season {filters.year}
                        {data && Object.values(data.drivers).map(d => ` · ${d.driverCode} L${d.lapNumber}`)}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Laps (ej: 44,66)"
                        value={lapInput}
                        onChange={e => setLapInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleApplyLaps()}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-3 py-1.5 focus:border-red-600 focus:outline-none font-mono w-36"
                    />
                    <button
                        onClick={handleApplyLaps}
                        disabled={isLoading}
                        className="border border-gray-700 text-gray-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:border-red-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? '···' : '↻ LOAD'}
                    </button>
                </div>
            </div>

            {/* ── ERROR ───────────────────────────────────────────────────── */}
            {error && !isLoading && (
                <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/20 px-5 py-3">
                    <span className="text-red-500 font-black shrink-0">⚠</span>
                    <span className="text-red-400 text-xs font-mono flex-1 break-all">{error}</span>
                </div>
            )}

            {/* ── ZONA DE GRÁFICA ─────────────────────────────────────────── */}
            <div className="relative bg-[#0a0a0c]">

                {isLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-sm" style={{ height: 420 }}>
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Generating telemetry...
                        </p>
                    </div>
                )}

                {!isLoading && data && (
                    <div
                        ref={containerRef}
                        style={{ width: '100%', height: 420, cursor: 'crosshair', userSelect: 'none' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onDoubleClick={resetZoom}
                    >
                        <ResponsiveContainer width="100%" height={420}>
                            <ComposedChart
                                data={mergedData}
                                margin={{ top: 25, right: 30, left: 20, bottom: 45 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

                                {/* domain se actualiza con el estado de zoom —
                                    esto produce el zoom de datos, no de imagen */}
                                <XAxis
                                    dataKey="distance"
                                    type="number"
                                    domain={domain}
                                    stroke="#6b7280"
                                    tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                                    tickFormatter={v => `${Math.round(v)}`}
                                    label={{
                                        value: 'Distance (m)',
                                        position: 'insideBottom',
                                        offset: -15,
                                        fill: '#6b7280',
                                        fontSize: 12,
                                        fontFamily: 'monospace',
                                    }}
                                />

                                <YAxis
                                    stroke="#6b7280"
                                    tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                                    label={{
                                        value: 'Speed (km/h)',
                                        angle: -90,
                                        position: 'insideLeft',
                                        offset: 15,
                                        fill: '#6b7280',
                                        fontSize: 12,
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
                                                fontSize: 10,
                                                fontFamily: 'monospace',
                                            }}
                                        />
                                    ))}

                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: '#dc2626', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />

                                <Legend
                                    verticalAlign="bottom"
                                    wrapperStyle={{ paddingTop: '10px', fontSize: 12, fontFamily: 'monospace' }}
                                    formatter={value => (
                                        <span style={{ color: DRIVER_COLORS[value] || '#9ca3af', fontWeight: 'bold' }}>
                                            {value}
                                        </span>
                                    )}
                                />

                                {driverKeys.map(code => (
                                    <Line
                                        key={code}
                                        type="monotone"
                                        dataKey={code}
                                        stroke={DRIVER_COLORS[code] || '#9ca3af'}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                        connectNulls={true}
                                        name={code}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {!isLoading && !error && !data && (
                    <div className="flex items-center justify-center flex-col opacity-50" style={{ height: 420 }}>
                        <span className="text-5xl mb-3">📊</span>
                        <p className="text-gray-500 font-black italic uppercase tracking-widest">
                            Select a session and press Load
                        </p>
                    </div>
                )}
            </div>

            {/* ── BARRA INFERIOR ──────────────────────────────────────────── */}
            {data && (
                <div className="border-t border-gray-800 px-5 py-2 flex items-center justify-between text-[10px] font-mono">
                    <div className="flex gap-5 text-gray-600">
                        <span>🖱️ <strong className="text-gray-500">Rueda</strong> → Zoom</span>
                        <span>🖱️ <strong className="text-gray-500">Arrastrar</strong> → Pan</span>
                        <span>🖱️ <strong className="text-gray-500">Doble click</strong> → Reset</span>
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