// =============================================================================
// SessionSummary.jsx
// Endpoint: GET /api/analysis/{year}/{event_name}/{session_name}/summary?drivers=...
//
// Recibe la misma prop 'filters' que TelemetryTable, con la forma exacta que
// emite SidebarFilter:
//   { year: "2024", round: "Bahrain Grand Prix", session: "Race", driver: "VER,LEC" }
//
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8000/api';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DTOs — Modelan la respuesta del backend con valores por defecto seguros
// ─────────────────────────────────────────────────────────────────────────────

class CompoundDTO {
    constructor(raw = {}) {
        this.compound = raw.compound ?? 'UNKNOWN';
        this.color = raw.color ?? '#FFFFFF';
        this.label = raw.label ?? '?';
    }
}

class BestLapDTO {
    constructor(raw = {}) {
        this.time = raw.time ?? '--:--.---';
        this.lapNumber = raw.lap_number ?? 0;
    }
}

class DriverSummaryDTO {
    constructor(driverCode, raw = {}) {
        this.driverCode = driverCode;
        this.bestLap = new BestLapDTO(raw.best_lap);
        this.average = raw.average ?? '--:--.---';
        this.median = raw.median ?? '--:--.---';
        this.stdDev = raw.std_dev ?? '0:00.000';
        this.consistency = typeof raw.consistency === 'number' ? raw.consistency : 0;
        this.validLaps = raw.valid_laps ?? 0;
        this.strategy = Array.isArray(raw.strategy)
            ? raw.strategy.map(s => new CompoundDTO(s))
            : [];
    }

    get consistencyLabel() {
        if (this.consistency >= 90) return 'Excelente';
        if (this.consistency >= 75) return 'Buena';
        if (this.consistency >= 60) return 'Regular';
        return 'Baja';
    }
}

class SessionSummaryDTO {
    constructor(raw = {}) {
        this.drivers = Object.entries(raw).map(
            ([code, data]) => new DriverSummaryDTO(code, data)
        );
    }

    // El piloto más rápido del grupo (comparación lexicográfica válida para "m:ss.mmm")
    get fastestDriver() {
        if (!this.drivers.length) return null;
        return this.drivers.reduce((best, cur) =>
            cur.bestLap.time < best.bestLap.time ? cur : best
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SERVICE — Fetch con cancelación y mapeo a DTO
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSummary({ year, round, session, driver }, signal) {
    // 'driver' ya llega como "VER,LEC" desde SidebarFilter — lo usamos directo
    const url = `${API_BASE}/analysis/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/summary?drivers=${driver}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Error ${res.status}: ${body}`);
    }

    return new SessionSummaryDTO(await res.json());
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. HOOK — Estado, carga, error y cancelación automática
// ─────────────────────────────────────────────────────────────────────────────

function useSessionSummary(filters) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        // Guard: esperar a que el Sidebar envíe filtros completos
        if (!filters?.year || !filters?.round || !filters?.session || !filters?.driver) {
            setData(null);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);
        setError(null);

        fetchSummary(filters, controller.signal)
            .then(setData)
            .catch(err => {
                if (err.name !== 'AbortError') setError(err.message ?? 'Error desconocido');
            })
            .finally(() => setIsLoading(false));

        // Cancela la petición si los filtros cambian antes de que termine
        return () => controller.abort();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, filters?.session, filters?.driver, tick]);

    return { data, isLoading, error, refetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SUBCOMPONENTES UI — Paleta y tipografía consistentes con TelemetryTable
// ─────────────────────────────────────────────────────────────────────────────

/** Rueda Pirelli con el color y letra del compuesto — igual que en TelemetryTable */
function CompoundBadge({ compound }) {
    // Mapa de colores idéntico al de TelemetryTable para coherencia visual
    const colorMap = {
        SOFT: 'border-red-600 text-red-500',
        MEDIUM: 'border-yellow-400 text-yellow-400',
        HARD: 'border-gray-200 text-gray-200',
        INTERMEDIATE: 'border-green-500 text-green-500',
        WET: 'border-blue-600 text-blue-500',
        UNKNOWN: 'border-purple-500 text-purple-500',
    };
    const colorClass = colorMap[compound.compound?.toUpperCase()] ?? colorMap.UNKNOWN;

    return (
        <div
            className={`w-6 h-6 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-inner ${colorClass}`}
            title={compound.compound}
        >
            <span className="font-black text-[10px] leading-none">{compound.label}</span>
        </div>
    );
}

/** Barra de consistencia: rojo → verde según el valor */
function ConsistencyBar({ value }) {
    const hue = Math.round((value / 100) * 120);
    return (
        <div className="w-full h-[3px] bg-gray-800 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${value}%`, backgroundColor: `hsl(${hue}, 80%, 48%)` }}
            />
        </div>
    );
}

/** Fila de estadística con el estilo monospace de TelemetryTable */
function MetricRow({ label, value }) {
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">{label}</span>
            <span className="font-mono text-sm text-gray-200 font-semibold tabular-nums">{value}</span>
        </div>
    );
}

/** Tarjeta completa por piloto */
function DriverCard({ driver, isFastest }) {
    return (
        <article className={`
            relative flex flex-col gap-4 p-5
            bg-[#0a0a0c] border rounded-sm
            transition-colors duration-200 hover:border-gray-700
            ${isFastest ? 'border-red-600/50' : 'border-gray-800'}
        `}>
            {/* Línea superior: roja si es el más rápido */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${isFastest ? 'bg-red-600' : 'bg-gray-800'}`} />

            {/* CABECERA: código piloto + badge + estrategia */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="font-black italic uppercase tracking-tighter text-3xl leading-none text-white">
                        {driver.driverCode}
                    </span>
                    {isFastest && (
                        <span className="border border-red-600/50 text-red-600 font-black uppercase text-[9px] tracking-widest px-1.5 py-0.5">
                            ⚡ FASTEST
                        </span>
                    )}
                </div>

                {/* Secuencia de neumáticos con flechas */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {driver.strategy.map((c, i) => (
                        <span key={`${c.compound}-${i}`} className="flex items-center gap-1">
                            {i > 0 && <span className="text-gray-700 text-[10px]">›</span>}
                            <CompoundBadge compound={c} />
                        </span>
                    ))}
                </div>
            </div>

            {/* MEJOR VUELTA — borde izquierdo rojo como el sector destacado de TelemetryTable */}
            <div className="border-l-2 border-red-600 pl-3 py-0.5 bg-black/40">
                <p className="text-gray-500 font-bold uppercase text-[9px] tracking-widest mb-0.5">
                    Best Lap · Lap {driver.bestLap.lapNumber}
                </p>
                <p className="font-mono font-black text-2xl tracking-tight text-white tabular-nums">
                    {driver.bestLap.time}
                </p>
            </div>

            {/* ESTADÍSTICAS */}
            <div>
                <MetricRow label="Average" value={driver.average} />
                <MetricRow label="Median" value={driver.median} />
                <MetricRow label="Std Dev" value={driver.stdDev} />
                <MetricRow label="Valid Laps" value={String(driver.validLaps)} />
            </div>

            {/* CONSISTENCIA */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">
                        Consistency
                    </span>
                    <span className="font-mono text-xs text-gray-400 tabular-nums">
                        {driver.consistency.toFixed(1)}%{' '}
                        <span className="text-gray-200 font-semibold">— {driver.consistencyLabel}</span>
                    </span>
                </div>
                <ConsistencyBar value={driver.consistency} />
            </div>
        </article>
    );
}

/** Skeleton animado que imita la silueta de DriverCard */
function SkeletonCard() {
    return (
        <div className="flex flex-col gap-4 p-5 bg-[#0a0a0c] border border-gray-800 rounded-sm animate-pulse">
            <div className="flex justify-between items-center">
                <div className="h-8 w-20 bg-gray-800 rounded" />
                <div className="flex gap-1.5">
                    <div className="w-6 h-6 bg-gray-800 rounded-full" />
                    <div className="w-6 h-6 bg-gray-800 rounded-full" />
                </div>
            </div>
            <div className="h-14 bg-gray-900 rounded" />
            <div className="flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-3 bg-gray-800 rounded" style={{ width: `${60 + i * 10}%` }} />
                ))}
            </div>
            <div className="h-[3px] bg-gray-800 rounded-full" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function SessionSummary({ filters }) {
    const { data, isLoading, error, refetch } = useSessionSummary(filters);

    const fastestCode = data?.fastestDriver?.driverCode ?? null;
    // 'driver' es el string "VER,LEC" — lo separamos solo para el skeleton
    const driverKeys = filters?.driver ? filters.driver.split(',') : [];

    // ── Sin filtros activos (estado inicial — igual que TelemetryTable) ──────
    if (!filters) {
        return (
            <div className="flex h-full items-center justify-center flex-col opacity-50">
                <span className="text-6xl mb-4">📊</span>
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">
                    Summary Standby
                </h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Selecciona parámetros y pilotos en el panel lateral para iniciar el análisis.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* CABECERA — mismo estilo HUD que el legend de TelemetryTable */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 px-5 py-4 shrink-0 flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                        Session Summary
                    </h3>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                        {filters.round} · {filters.session} · Season {filters.year}
                    </p>
                </div>

                <button
                    onClick={refetch}
                    disabled={isLoading}
                    className="border border-gray-700 text-gray-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                    aria-label="Recargar datos"
                >
                    {isLoading ? '···' : '↻ RELOAD'}
                </button>
            </div>

            {/* BANNER DE ERROR */}
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

            {/* CUERPO: SPINNER de carga igual al de TelemetryTable */}
            <div className="flex-1 overflow-y-auto relative">
                {isLoading && (
                    <div className="absolute inset-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <div className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Processing Telemetry...
                        </div>
                    </div>
                )}

                {/* GRID DE TARJETAS */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {isLoading
                        ? driverKeys.map(code => <SkeletonCard key={code} />)
                        : data?.drivers.map(driver => (
                            <DriverCard
                                key={driver.driverCode}
                                driver={driver}
                                isFastest={driver.driverCode === fastestCode}
                            />
                        ))
                    }
                </div>
            </div>
        </div>
    );
}