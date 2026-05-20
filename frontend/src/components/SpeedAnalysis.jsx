import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
    ComposedChart, Line, Area,
    XAxis, YAxis, CartesianGrid,
    ReferenceLine, ResponsiveContainer,
} from 'recharts';

const API_BASE = 'http://localhost:8000/api';
const ZOOM_FACTOR = 0.15;
const CHART_MARGIN_LEFT = 27;
const CHART_MARGIN_RIGHT = 8;
const CHART_MARGIN = { top: 32, right: CHART_MARGIN_RIGHT, left: 30, bottom: 20 };
const SESSIONS = ['Race', 'Qualifying', 'FP1', 'FP2', 'FP3', 'Sprint'];

// ─── DTOs ────────────────────────────────────────────────────────────────────

class DataPointDTO {
    constructor(raw = {}) {
        this.distance = raw.distance ?? 0;
        this.speed = raw.speed ?? 0;
        this.throttle = raw.throttle ?? 0;
        this.brake = raw.brake ?? 0;
        this.rpm = raw.rpm ?? 0;
        this.gear = raw.gear ?? 0;
        // DRS: >= 10 indica estado abierto según especificación de FastF1
        this.drsActive = (raw.drs ?? 0) >= 10 ? 1 : 0;
    }
}

class DriverTelemetryDTO {
    constructor(raw = {}) {
        this.key = (raw.key ?? '').replaceAll(':', '_');
        this.driverCode = raw.driver ?? '';
        this.session = raw.session ?? '';
        this.lapNumber = raw.lap_number ?? 0;
        this.data = Array.isArray(raw.data)
            ? raw.data.map(d => new DataPointDTO(d))
            : [];
    }
}

class CornerDTO {
    constructor(raw = {}) {
        this.number = raw.number ?? 0;
        this.letter = raw.letter ?? '';
        this.distance = raw.distance ?? 0;
    }
    get label() {
        return this.letter ? `${this.number}${this.letter}` : `${this.number}`;
    }
}

class TelemetryDTO {
    constructor(raw = {}) {
        this.corners = (raw.corners ?? []).map(c => new CornerDTO(c));
        this.drivers = Object.fromEntries(
            (raw.drivers ?? []).map(d => {
                const dto = new DriverTelemetryDTO(d);
                return [dto.key, dto];
            })
        );
    }
    get maxDistance() {
        const ends = Object.values(this.drivers).map(d =>
            d.data.length ? d.data.at(-1).distance : 0
        );
        return Math.ceil(Math.max(0, ...ends));
    }
}

// ─── SERVICE ─────────────────────────────────────────────────────────────────

async function fetchTelemetry({ year, round, driverParam }, signal) {
    const url =
        `${API_BASE}/telemetry/${year}/${encodeURIComponent(round)}/full` +
        `?drivers=${encodeURIComponent(driverParam)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return new TelemetryDTO(await res.json());
}

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useTelemetry(filters, driverParam) {
    const [data, setData] = useState(null);
    const [isLoading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!filters?.year || !filters?.round || !driverParam) {
            setData(null);
            return;
        }
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);
        fetchTelemetry(
            { year: filters.year, round: filters.round, driverParam },
            ctrl.signal
        )
            .then(setData)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message ?? 'Error'); })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, driverParam]);

    return { data, isLoading, error };
}

function useChartZoom(maxDistance) {
    const [domainStart, setDomainStart] = useState(0);
    const [domainEnd, setDomainEnd] = useState(0);
    const domainRef = useRef({ start: 0, end: 0, max: 0 });
    const panRef = useRef({ active: false, startX: 0, startStart: 0, startEnd: 0 });

    useEffect(() => {
        if (maxDistance > 0) {
            setDomainStart(0);
            setDomainEnd(maxDistance);
            domainRef.current = { start: 0, end: maxDistance, max: maxDistance };
        }
    }, [maxDistance]);

    useEffect(() => {
        domainRef.current.start = domainStart;
        domainRef.current.end = domainEnd;
    }, [domainStart, domainEnd]);

    const applyDomain = useCallback((s, e) => {
        const { max } = domainRef.current;
        const range = e - s;
        if (s < 0) { s = 0; e = range; }
        if (e > max) { e = max; s = max - range; }
        s = Math.max(0, s);
        e = Math.min(max, e);
        setDomainStart(s);
        setDomainEnd(e);
        domainRef.current.start = s;
        domainRef.current.end = e;
    }, []);

    const pixelToDistance = useCallback((clientX, rect) => {
        const plotArea = rect.left + CHART_MARGIN_LEFT;
        const plotWidth = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const ratio = Math.max(0, Math.min(1, (clientX - plotArea) / plotWidth));
        const { start, end } = domainRef.current;
        return start + ratio * (end - start);
    }, []);

    // Devuelve un handler de rueda listo para registrar con { passive: false }
    const buildWheelHandler = useCallback((getRect) => (e) => {
        e.preventDefault();
        const rect = getRect();
        const w = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - CHART_MARGIN_LEFT) / w));
        const { start, end, max } = domainRef.current;
        const range = end - start;
        const delta = e.deltaY > 0 ? 1 : -1;
        const newRange = Math.max(100, Math.min(max, range * (1 + delta * ZOOM_FACTOR)));
        const anchor = start + ratio * range;
        applyDomain(anchor - ratio * newRange, anchor + (1 - ratio) * newRange);
    }, [applyDomain]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        panRef.current = {
            active: true,
            startX: e.clientX,
            startStart: domainRef.current.start,
            startEnd: domainRef.current.end,
        };
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!panRef.current.active) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const w = rect.width - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
        const range = panRef.current.startEnd - panRef.current.startStart;
        const delta = -(e.clientX - panRef.current.startX) / w * range;
        applyDomain(
            panRef.current.startStart + delta,
            panRef.current.startEnd + delta,
        );
    }, [applyDomain]);

    const handleMouseUp = useCallback(() => { panRef.current.active = false; }, []);

    const resetZoom = useCallback(() => {
        applyDomain(0, domainRef.current.max);
    }, [applyDomain]);

    const zoomPercent = maxDistance && (domainEnd - domainStart) > 0
        ? Math.round(maxDistance / (domainEnd - domainStart) * 100)
        : 100;

    return {
        domain: [domainStart, domainEnd],
        buildWheelHandler,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        resetZoom,
        zoomPercent,
        pixelToDistance,
    };
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function mergeDriverData(drivers) {
    const map = {};
    Object.entries(drivers).forEach(([key, driver]) => {
        driver.data.forEach(pt => {
            if (!map[pt.distance]) map[pt.distance] = { distance: pt.distance };
            map[pt.distance][`${key}_speed`] = pt.speed;
            map[pt.distance][`${key}_throttle`] = pt.throttle;
            map[pt.distance][`${key}_brake`] = pt.brake;
            map[pt.distance][`${key}_rpm`] = pt.rpm;
            map[pt.distance][`${key}_gear`] = pt.gear;
            map[pt.distance][`${key}_drs`] = pt.drsActive;
        });
    });
    return Object.values(map).sort((a, b) => a.distance - b.distance);
}

function buildParamFromRows(rows) {
    return rows
        .map(r => r.lap ? `${r.driver}:${r.session}:${r.lap}` : `${r.driver}:${r.session}`)
        .join(',');
}

function interpolate(data, distance, field) {
    if (!data?.length) return null;
    let lo = null, hi = null;
    for (const pt of data) {
        if (pt.distance <= distance) lo = pt;
        else { hi = pt; break; }
    }
    if (!lo) return hi?.[field] ?? null;
    if (!hi) return lo?.[field] ?? null;
    const t = (distance - lo.distance) / (hi.distance - lo.distance);
    return lo[field] + t * (hi[field] - lo[field]);
}

// ─── SUBCOMPONENTES ──────────────────────────────────────────────────────────

const CHANNEL_CONFIG = {
    speed: { field: 'speed', fmt: v => `${Math.round(v)} km/h` },
    throttle: { field: 'throttle', fmt: v => `${Math.round(v)}%` },
    brake: { field: 'brake', fmt: v => v >= 0.5 ? 'ON' : 'OFF' },
    rpm: { field: 'rpm', fmt: v => Math.round(v).toLocaleString() },
    gear: { field: 'gear', fmt: v => `${Math.round(v)}` },
    drs: { field: 'drsActive', fmt: v => v >= 0.5 ? 'OPEN' : '—' },
};

function ChannelTooltip({ distance, drivers, channel, getDriverColor }) {
    if (distance === null) return null;
    const config = CHANNEL_CONFIG[channel];
    if (!config) return null;
    return (
        <div
            style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, pointerEvents: 'none' }}
            className="bg-black/90 border border-gray-700 shadow-lg font-mono text-xs px-2.5 py-2 flex flex-col gap-1.5"
        >
            <div className="border-b border-gray-700 pb-1.5 mb-0.5">
                <span className="text-gray-500 text-[10px] uppercase tracking-widest">Distance</span>
                <span className="block text-white font-black text-base tabular-nums leading-none mt-0.5">
                    {Math.round(distance)} m
                </span>
            </div>
            {Object.values(drivers).map(driver => {
                const v = interpolate(driver.data, distance, config.field);
                const color = getDriverColor(driver.key);
                return (
                    <div key={driver.key} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-black" style={{ color }}>{driver.driverCode}</span>
                        <span className="text-white tabular-nums">{v !== null ? config.fmt(v) : '—'}</span>
                    </div>
                );
            })}
        </div>
    );
}

function LapSelector({ rows, setRows, availableDrivers, availableSessions, onLoad, isLoading }) {
    const addRow = () => setRows(p => [...p, { driver: availableDrivers[0] ?? '', session: 'Race', lap: '' }]);
    const removeRow = i => setRows(p => p.filter((_, idx) => idx !== i));
    const updateRow = (i, f, v) =>
        setRows(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

    return (
        <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                    <select
                        value={row.driver}
                        onChange={e => updateRow(i, 'driver', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono"
                    >
                        {availableDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                        value={row.session}
                        onChange={e => updateRow(i, 'session', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono"
                    >
                        {availableSessions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                        type="number"
                        placeholder="Fastest"
                        value={row.lap}
                        onChange={e => updateRow(i, 'lap', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono w-20"
                    />
                    <button
                        onClick={() => removeRow(i)}
                        disabled={rows.length === 1}
                        className="text-gray-600 hover:text-red-500 disabled:opacity-20 transition-colors text-sm"
                    >
                        ✕
                    </button>
                </div>
            ))}
            <div className="flex gap-2 mt-1">
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

// Registra el listener de rueda con { passive: false } y propaga
// los eventos de ratón compartidos al sistema de zoom/pan.
function ChartWrapper({ height, buildWheelHandler, handleMouseDown, handleMouseMove, handleMouseUp, onDoubleClick, onMouseLeave, children }) {
    const nodeRef = useRef(null);

    useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;
        const handler = buildWheelHandler(() => node.getBoundingClientRect());
        node.addEventListener('wheel', handler, { passive: false });
        return () => node.removeEventListener('wheel', handler);
    }, [buildWheelHandler]);

    return (
        <div
            ref={nodeRef}
            style={{ width: '100%', height, cursor: 'crosshair', userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={onDoubleClick}
            onMouseLeave={onMouseLeave}
        >
            {children}
        </div>
    );
}

function ChannelChart({ title, visibleData, driverKeys, domain, crosshairDistance, corners, getDriverColor, drivers, channel, yLabel, yDomain, height, showXAxis, interaction }) {
    const visibleCorners = corners.filter(c => c.distance >= domain[0] && c.distance <= domain[1]);
    return (
        <div className="border-b border-gray-800/60">
            <div className="px-5 pt-2">
                <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">{title}</span>
            </div>
            <div className="relative">   {/* ← envuelve en relative */}
                <ChannelTooltip
                    distance={crosshairDistance}
                    drivers={drivers}
                    channel={channel}
                    getDriverColor={getDriverColor}
                />
                <ChartWrapper height={height} {...interaction}>
                    <ResponsiveContainer width="100%" height={height}>
                        <ComposedChart data={visibleData} margin={CHART_MARGIN}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            {showXAxis
                                ? (
                                    <XAxis
                                        dataKey="distance" type="number" domain={domain} tickCount={10}
                                        stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                        tickFormatter={v => `${Math.round(v)}`}
                                        label={{ value: 'Distance (m)', position: 'insideBottom', offset: -3, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                                    />
                                ) : (
                                    <XAxis dataKey="distance" type="number" domain={domain} hide />
                                )
                            }
                            <YAxis
                                domain={yDomain ?? ['auto', 'auto']}
                                stroke="#6b7280"
                                tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 15, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                            />
                            {visibleCorners.map(c => (
                                <ReferenceLine
                                    key={`${c.number}${c.letter}`}
                                    x={c.distance} stroke="#374151" strokeWidth={1}
                                    label={{ value: c.label, position: 'top', fill: '#4b5563', fontSize: 12, fontFamily: 'monospace' }}
                                />
                            ))}
                            {crosshairDistance !== null && (
                                <ReferenceLine x={crosshairDistance} stroke="#dc2626" strokeWidth={1.5} strokeOpacity={0.8} />
                            )}
                            {driverKeys.map(key => (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={`${key}_${channel}`}
                                    stroke={getDriverColor(key)}
                                    strokeWidth={1.5}
                                    dot={false}
                                    activeDot={false}
                                    isAnimationActive={false}
                                    connectNulls
                                />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartWrapper>
            </div>
        </div>
    );
}

function BinaryChart({ title, visibleData, driverKeys, domain, crosshairDistance, corners, getDriverColor, drivers, channel, yLabel, showXAxis, height, interaction }) {
    const visibleCorners = corners.filter(c => c.distance >= domain[0] && c.distance <= domain[1]);
    return (
        <div className="border-b border-gray-800/60">
            <div className="px-5 pt-2">
                <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">{title}</span>
            </div>
            <div className="relative">   {/* ← envuelve en relative */}
                <ChannelTooltip
                    distance={crosshairDistance}
                    drivers={drivers}
                    channel={channel}
                    getDriverColor={getDriverColor}
                />
                <ChartWrapper height={height} {...interaction}>
                    <ResponsiveContainer width="100%" height={height}>
                        <ComposedChart data={visibleData} margin={{ ...CHART_MARGIN, bottom: showXAxis ? 15 : 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            {showXAxis
                                ? (
                                    <XAxis
                                        dataKey="distance"
                                        type="number"
                                        domain={domain}
                                        tickCount={10}
                                        stroke="#6b7280"
                                        tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                        tickFormatter={v => `${Math.round(v)}`}
                                        label={{ value: 'Distance (m)', position: 'insideBottom', offset: -3, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                                    />
                                )
                                : (
                                    <XAxis dataKey="distance" type="number" domain={domain} hide />
                                )
                            }
                            <YAxis
                                domain={[0, 1]} ticks={[0, 1]}
                                stroke="#6b7280"
                                tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 15, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                            />
                            {visibleCorners.map(c => (
                                <ReferenceLine
                                    key={`${c.number}${c.letter}`}
                                    x={c.distance}
                                    stroke="#374151"
                                    strokeWidth={1}
                                    label={{ value: c.label, position: 'top', fill: '#4b5563', fontSize: 12, fontFamily: 'monospace' }}
                                />
                            ))}
                            {crosshairDistance !== null && (
                                <ReferenceLine x={crosshairDistance} stroke="#dc2626" strokeWidth={1.5} strokeOpacity={0.8} />
                            )}
                            {driverKeys.map(key => (
                                <Line
                                    key={key}
                                    type="stepAfter"
                                    dataKey={`${key}_${channel}`}
                                    stroke={getDriverColor(key)}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={false}
                                    isAnimationActive={false}
                                    connectNulls
                                />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartWrapper>
            </div>
        </div>
    );
}

function GearChart({ title, visibleData, driverKeys, domain, crosshairDistance, corners, getDriverColor, drivers, showXAxis, height, interaction }) {
    const visibleCorners = corners.filter(c => c.distance >= domain[0] && c.distance <= domain[1]);
    return (
        <div className="border-b border-gray-800/60">
            <div className="px-5 pt-2">
                <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">{title}</span>
            </div>
            <div className="relative">   {/* ← envuelve en relative */}
                <ChannelTooltip
                    distance={crosshairDistance}
                    drivers={drivers}
                    channel="gear"
                    getDriverColor={getDriverColor}
                />
                <ChartWrapper height={height} {...interaction}>
                    <ResponsiveContainer width="100%" height={height}>
                        <ComposedChart data={visibleData} margin={{ ...CHART_MARGIN, bottom: showXAxis ? 15 : 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            {showXAxis
                                ? (
                                    <XAxis
                                        dataKey="distance"
                                        type="number"
                                        domain={domain}
                                        tickCount={10}
                                        stroke="#6b7280"
                                        tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                        tickFormatter={v => `${Math.round(v)}`}
                                        label={{ value: 'Distance (m)', position: 'insideBottom', offset: -3, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                                    />
                                )
                                : (
                                    <XAxis dataKey="distance" type="number" domain={domain} hide />
                                )
                            }
                            <YAxis
                                domain={[1, 8]} ticks={[1, 2, 3, 4, 5, 6, 7, 8]}
                                stroke="#6b7280"
                                tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                label={{ value: 'Gear', angle: -90, position: 'insideLeft', offset: 15, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                            />
                            {visibleCorners.map(c => (
                                <ReferenceLine
                                    key={`${c.number}${c.letter}`}
                                    x={c.distance}
                                    stroke="#374151"
                                    strokeWidth={1}
                                    label={{ value: c.label, position: 'top', fill: '#4b5563', fontSize: 12, fontFamily: 'monospace' }}
                                />
                            ))}
                            {crosshairDistance !== null && (
                                <ReferenceLine x={crosshairDistance} stroke="#dc2626" strokeWidth={1.5} strokeOpacity={0.8} />
                            )}
                            {driverKeys.map(key => (
                                <Line
                                    key={key}
                                    type="stepAfter"
                                    dataKey={`${key}_gear`}
                                    stroke={getDriverColor(key)}
                                    strokeWidth={1.5}
                                    dot={false}
                                    activeDot={false}
                                    isAnimationActive={false}
                                    connectNulls
                                />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartWrapper>
            </div>
        </div>
    );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function TelemetryView({ filters }) {
    const [rows, setRows] = useState([]);
    const [driverParam, setDriverParam] = useState('');
    const [crosshairDistance, setCrosshairDistance] = useState(null);

    const availableDrivers = useMemo(
        () => filters?.driver ? filters.driver.split(',').map(s => s.trim()) : [],
        [filters?.driver]
    );

    useEffect(() => {
        if (!availableDrivers.length || !filters?.session) return;
        const defaultRows = availableDrivers.map(d => ({ driver: d, session: filters.session, lap: '' }));
        setRows(defaultRows);
        setDriverParam(buildParamFromRows(defaultRows));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, filters?.driver, filters?.session]);

    const { data, isLoading, error } = useTelemetry(filters, driverParam);

    const driverKeys = useMemo(() => (data ? Object.keys(data.drivers) : []), [data]);

    const getDriverColor = useCallback((key) => {
        const code = data?.drivers[key]?.driverCode ?? key.split('_')[0];
        return filters?.driverColors?.[code] ?? '#9ca3af';
    }, [filters, data]);

    const allMergedData = useMemo(() => (data ? mergeDriverData(data.drivers) : []), [data]);

    const {
        domain,
        buildWheelHandler,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        resetZoom,
        zoomPercent,
        pixelToDistance,
    } = useChartZoom(data?.maxDistance ?? 0);

    const visibleData = useMemo(() => {
        if (!allMergedData.length) return [];
        const buf = (domain[1] - domain[0]) * 0.02;
        return allMergedData.filter(d => d.distance >= domain[0] - buf && d.distance <= domain[1] + buf);
    }, [allMergedData, domain]);

    const handleLoad = useCallback(() => {
        setDriverParam(buildParamFromRows(rows));
    }, [rows]);

    const handleChartMouseMove = useCallback((e) => {
        handleMouseMove(e);
        if (!data) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setCrosshairDistance(pixelToDistance(e.clientX, rect));
    }, [handleMouseMove, pixelToDistance, data]);

    const handleChartMouseLeave = useCallback((e) => {
        handleMouseUp(e);
        setCrosshairDistance(null);
    }, [handleMouseUp]);

    const interaction = useMemo(() => ({
        buildWheelHandler,
        handleMouseDown,
        handleMouseMove: handleChartMouseMove,
        handleMouseUp,
        onDoubleClick: resetZoom,
        onMouseLeave: handleChartMouseLeave,
    }), [buildWheelHandler, handleMouseDown, handleChartMouseMove, handleMouseUp, resetZoom, handleChartMouseLeave]);

    const sharedProps = {
        visibleData,
        driverKeys,
        domain,
        crosshairDistance,
        corners: data?.corners ?? [],
        getDriverColor,
        drivers: data?.drivers ?? {},
        interaction,
    };

    if (!filters) {
        return (
            <div className="flex items-center justify-center flex-col opacity-50 h-64">
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">Telemetry</h2>
                <p className="text-sm font-mono text-gray-600 mt-2">Selecciona parámetros en el panel lateral.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* CABECERA */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 px-5 py-3 flex items-center justify-between gap-4 shrink-0">
                <div>
                    <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                        Telemetry
                    </h3>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                        {filters.round} · Season {filters.year}
                    </p>
                </div>
                <LapSelector
                    rows={rows}
                    setRows={setRows}
                    availableDrivers={availableDrivers}
                    availableSessions={filters?.availableSessions ?? SESSIONS}
                    onLoad={handleLoad}
                    isLoading={isLoading}
                />
            </div>

            {/* LEYENDA */}
            {data && (
                <div className="flex flex-wrap gap-6 px-5 py-2 border-b border-gray-800 bg-black/40">
                    {Object.values(data.drivers).map(d => {
                        const isFastest = rows.find(r => r.driver === d.driverCode && r.session === d.session)?.lap === '';
                        return (
                            <div key={d.key} className="flex items-center gap-2 font-mono text-xs">
                                <div className="w-8 h-px" style={{ backgroundColor: getDriverColor(d.key) }} />
                                <span style={{ color: getDriverColor(d.key) }} className="font-black">{d.driverCode}</span>
                                <span className="text-gray-600">
                                    {d.session} · L{d.lapNumber} {isFastest ? '· Fastest' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ERROR */}
            {error && !isLoading && (
                <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/20 px-5 py-3">
                    <span className="text-red-500 font-black shrink-0">⚠</span>
                    <span className="text-red-400 text-xs font-mono break-all">{error}</span>
                </div>
            )}

            {/* LOADING */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                        Generating telemetry...
                    </p>
                </div>
            )}

            {/* GRÁFICOS */}
            {!isLoading && data && (
                <div className="relative">
                    <ChannelChart {...sharedProps}
                        title="Speed" channel="speed" yLabel="km/h" height={420} showXAxis />
                    <ChannelChart {...sharedProps}
                        title="Throttle" channel="throttle" yLabel="%" height={250} yDomain={[0, 100]} showXAxis />
                    <BinaryChart {...sharedProps}
                        title="Brake" channel="brake" yLabel="Brake" height={180} showXAxis />
                    <ChannelChart {...sharedProps}
                        title="RPM" channel="rpm" yLabel="RPM" height={250} showXAxis />
                    <GearChart {...sharedProps}
                        title="Gear" height={220} showXAxis />
                    <BinaryChart {...sharedProps}
                        title="DRS" channel="drs" yLabel="DRS" height={180} showXAxis />
                </div>
            )}

            {!isLoading && !error && !data && (
                <div className="flex items-center justify-center opacity-50 h-48">
                    <p className="text-gray-500 font-black italic uppercase tracking-widest">
                        Selecciona una sesión y pulsa Load
                    </p>
                </div>
            )}

            {/* BARRA DE CONTROLES */}
            {data && (
                <div className="border-t border-gray-800 px-5 py-2 flex items-center justify-between text-xs font-mono">
                    <div className="flex gap-5 text-gray-600">
                        <span><strong className="text-gray-500">Rueda</strong> → Zoom</span>
                        <span><strong className="text-gray-500">Arrastrar</strong> → Pan</span>
                        <span><strong className="text-gray-500">Doble click</strong> → Reset</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-gray-600">{Math.round(domain[0])}m → {Math.round(domain[1])}m</span>
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