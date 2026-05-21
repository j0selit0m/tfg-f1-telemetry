import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8000/api';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class BestLapInStintDTO {
    constructor(raw = {}) {
        this.time       = raw.time         ?? '--:--.---';
        // Posición de la vuelta dentro del stint (no número global)
        this.lapInStint = raw.lap_in_stint ?? 0;
    }
}

class StintDriverDataDTO {
    constructor(raw = {}) {
        this.compound      = raw.compound       ?? 'UNKNOWN';
        // Color y label oficiales de la temporada, ya resueltos por el backend
        this.compoundColor = raw.compound_color ?? '#FFFFFF';
        this.compoundLabel = raw.compound_label ?? '?';
        this.durationLaps  = raw.duration_laps  ?? 0;
        this.durationTime  = raw.duration_time  ?? '--:--.---';
        this.bestLap       = new BestLapInStintDTO(raw.best_lap ?? {});
        this.average       = raw.average        ?? '--:--.---';
        this.median        = raw.median         ?? '--:--.---';
        this.stdDev        = raw.std_dev        ?? '0.000';
        this.consistency   = typeof raw.consistency === 'number' ? raw.consistency : 0;
    }
}

class StintDTO {
    constructor(raw = {}) {
        this.stintNumber = raw.stint_number ?? 0;
        // Mapa piloto → datos. Si el piloto no usó este stint, su valor es null.
        this.drivers = Object.fromEntries(
            Object.entries(raw.drivers ?? {}).map(([code, data]) => [
                code,
                data ? new StintDriverDataDTO(data) : null,
            ])
        );
    }
}

class StintsResponseDTO {
    constructor(raw = {}) {
        // El backend devuelve { drivers, stints }, no un array.
        // "drivers" define el orden de columnas; "stints" el orden de filas.
        this.drivers = raw.drivers ?? [];
        this.stints  = (raw.stints ?? []).map(s => new StintDTO(s));
    }
}

// ─── Service ──────────────────────────────────────────────────────────────────

async function fetchStints({ year, round, session, driver }, signal) {
    const url = `${API_BASE}/analysis/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/stints?drivers=${driver}`;

    const res = await fetch(url, {
        method:  'GET',
        headers: { Accept: 'application/json' },
        signal,
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Error ${res.status}: ${body}`);
    }

    return new StintsResponseDTO(await res.json());
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useStintAnalysis(filters) {
    const [data,      setData]      = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error,     setError]     = useState(null);
    const [tick,      setTick]      = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!filters?.year || !filters?.round || !filters?.session || !filters?.driver) {
            setData(null);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);
        setError(null);

        fetchStints(filters, controller.signal)
            .then(setData)
            .catch(err => {
                if (err.name !== 'AbortError') setError(err.message ?? 'Unknown error');
            })
            .finally(() => setIsLoading(false));

        return () => controller.abort();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, filters?.session, filters?.driver, tick]);

    return { data, isLoading, error, refetch };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

// Rueda Pirelli con el color oficial de la temporada (viene del backend)
function CompoundWheel({ label, color, compound }) {
    return (
        <div
            className="w-10 h-10 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-inner shrink-0"
            style={{ borderColor: color, color }}
            title={compound}
        >
            <span className="font-black text-sm leading-none translate-y-px">{label}</span>
        </div>
    );
}

function StintCell({ driverData }) {

    if (!driverData) {
        return (
            <td className="border-r border-gray-800 bg-gray-900/10 text-center text-gray-700 text-2xl align-middle p-4">
                —
            </td>
        );
    }

    return (
        <td className="border-r border-gray-800 p-5 align-top bg-[#0a0a0c]">
            <div className="flex flex-col gap-4">

                {/* Compuesto + duración del stint */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <CompoundWheel
                            label={driverData.compoundLabel}
                            color={driverData.compoundColor}
                            compound={driverData.compound}
                        />
                        <span className="font-black italic uppercase text-xl tracking-tight text-white">
                            {driverData.compound}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="block font-black text-white text-lg leading-tight">
                            {driverData.durationLaps} laps
                        </span>
                        <span className="block font-mono text-sm text-gray-400 mt-1">
                            {driverData.durationTime}
                        </span>
                    </div>
                </div>

                <div className="h-px bg-gray-800" />

                {/* Mejor vuelta del stint */}
                <div className="border-l-2 border-red-600 pl-3 py-1">
                    <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                        Best Lap (L{driverData.bestLap.lapInStint})
                    </span>
                    <span className="block font-mono font-black text-2xl text-white tabular-nums">
                        {driverData.bestLap.time}
                    </span>
                </div>

                {/* Average y median en paralelo para comparación visual */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Avg</span>
                        <span className="block font-mono text-lg text-gray-200 tabular-nums">{driverData.average}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Median</span>
                        <span className="block font-mono text-lg text-gray-200 tabular-nums">{driverData.median}</span>
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-3">
                    <span className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Consistency</span>
                    <span className="block font-mono font-black text-xl text-white tabular-nums">
                        {driverData.consistency.toFixed(1)}%
                    </span>
                </div>

            </div>
        </td>
    );
}

function SkeletonRow({ driverCount }) {
    return (
        <tr className="border-b border-gray-800/50 animate-pulse">
            <td className="p-4 border-r border-gray-800 text-center bg-black/50 w-20">
                <div className="h-8 w-12 bg-gray-800 rounded mx-auto" />
            </td>
            {[...Array(driverCount)].map((_, i) => (
                <td key={i} className="border-r border-gray-800 p-5">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-800 rounded-full shrink-0" />
                            <div className="h-6 bg-gray-800 rounded w-20" />
                        </div>
                        <div className="h-px bg-gray-800" />
                        <div className="h-10 bg-gray-800 rounded w-36" />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="h-8 bg-gray-800 rounded" />
                            <div className="h-8 bg-gray-800 rounded" />
                        </div>
                        <div className="h-8 bg-gray-800 rounded w-20" />
                    </div>
                </td>
            ))}
        </tr>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StintAnalysis({ filters }) {
    const { data, isLoading, error, refetch } = useStintAnalysis(filters);

    // Orden de columnas dictado por el backend; fallback al filtro mientras carga
    const driverKeys = data?.drivers ?? (filters?.driver ? filters.driver.split(',') : []);

    if (!filters) {
        return (
            <div className="flex h-full items-center justify-center flex-col opacity-50">
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">
                    Stint Analysis Standby
                </h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Select parameters and drivers in the side panel to start the analysis.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* Cabecera */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 px-5 py-4 shrink-0">
                <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                    Stint Analysis
                </h3>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                    {filters.round} · {filters.session} · Season {filters.year}
                </p>
            </div>

            {/* Banner de error */}
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

            {/* Tabla */}
            <div className="flex-1 overflow-auto relative">

                {isLoading && (
                    <div className="absolute inset-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <div className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Processing Telemetry...
                        </div>
                    </div>
                )}

                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900 sticky top-0 z-10 shadow-lg">
                        <tr>
                            <th className="p-4 w-20 border-r border-b-2 border-gray-700 text-center text-sm uppercase font-black tracking-widest text-gray-400 bg-black">
                                STINT
                            </th>
                            {driverKeys.map(code => {
                                const color = filters?.driverColors?.[code] ?? '#FFFFFF';
                                return (
                                    <th
                                        key={code}
                                        className="border-r border-b-2 border-gray-700 text-center bg-gray-900 min-w-[240px] overflow-hidden"
                                    >
                                        <div className="h-1 w-full" style={{ backgroundColor: color }} />
                                        <div className="p-4">
                                            <span
                                                className="text-2xl font-black italic uppercase tracking-tighter"
                                                style={{ color, textShadow: `0 0 20px ${color}40` }}
                                            >
                                                {code}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody className="font-mono">

                        {isLoading && (
                            <>
                                <SkeletonRow driverCount={driverKeys.length} />
                                <SkeletonRow driverCount={driverKeys.length} />
                                <SkeletonRow driverCount={driverKeys.length} />
                            </>
                        )}

                        {!isLoading && data?.stints.map(stint => (
                            <tr key={stint.stintNumber} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                                <td className="p-4 border-r border-gray-800 text-center bg-black/50 align-top">
                                    <span className="text-xl font-black text-gray-400">STINT{stint.stintNumber}</span>
                                </td>
                                {driverKeys.map(code => (
                                    <StintCell
                                        key={code}
                                        driverData={stint.drivers[code] ?? null}
                                    />
                                ))}
                            </tr>
                        ))}

                        {!isLoading && !error && (!data || data.stints.length === 0) && (
                            <tr>
                                <td colSpan={driverKeys.length + 1} className="text-center py-16">
                                    <p className="text-gray-500 font-black italic uppercase tracking-widest opacity-50">
                                        No stint data available
                                    </p>
                                </td>
                            </tr>
                        )}

                    </tbody>
                </table>
            </div>
        </div>
    );
}