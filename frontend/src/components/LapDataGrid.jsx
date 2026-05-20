import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000/api';

// ─── Helpers visuales ─────────────────────────────────────────────────────────

// Devuelve la letra y las clases CSS de color para cada compuesto de neumático
const getCompoundInfo = (compound) => {
    const compMap = {
        SOFT: { letter: 'S', colorClass: 'border-red-600 text-red-500' },
        MEDIUM: { letter: 'M', colorClass: 'border-yellow-400 text-yellow-400' },
        HARD: { letter: 'H', colorClass: 'border-gray-200 text-gray-200' },
        INTERMEDIATE: { letter: 'I', colorClass: 'border-green-500 text-green-500' },
        WET: { letter: 'W', colorClass: 'border-blue-600 text-blue-500' },
        UNKNOWN: { letter: 'X', colorClass: 'border-purple-500 text-purple-500' },
    };
    return compMap[compound?.toUpperCase()] ?? compMap.UNKNOWN;
};

// Renderiza LEDs de colores para cada código de estado de pista.
// Códigos según contrato: "1"=verde · "2"=VSC · "4"=SC · "5"=roja
const renderTrackStatusDots = (trackStatus) => {
    if (!trackStatus) return null;

    const statusStyles = {
        '1': 'bg-green-500 shadow-[0_0_4px_#22c55e]',
        '2': 'border border-orange-400 bg-transparent',
        '4': 'bg-orange-500 shadow-[0_0_4px_#f97316]',
        '5': 'bg-red-600 shadow-[0_0_4px_#dc2626]',
    };

    const statusLabels = {
        '1': 'Track Clear',
        '2': 'Virtual Safety Car',
        '4': 'Safety Car',
        '5': 'Red Flag',
    };

    return (
        <div className="flex gap-1 items-center">
            {String(trackStatus).split('').map((s, i) => (
                <div
                    key={i}
                    title={statusLabels[s] ?? 'Unknown'}
                    className={`w-1.5 h-1.5 rounded-full ${statusStyles[s] ?? 'bg-gray-500'}`}
                />
            ))}
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LapDataGrid({ filters }) {

    const [lapData, setLapData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [legendOpen, setLegendOpen] = useState(true);

    // Fetch con cancelación automática al cambiar filtros.
    // El backend devuelve los datos pre-agrupados por vuelta: { drivers, laps }
    useEffect(() => {
        if (!filters?.driver) {
            setLapData(null);
            return;
        }

        const controller = new AbortController();
        const { year, round, session, driver } = filters;

        setIsLoading(true);
        setError(null);

        fetch(
            `${API_BASE}/analysis/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/laps?drivers=${driver}`,
            { signal: controller.signal }
        )
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(setLapData)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
            .finally(() => setIsLoading(false));

        return () => controller.abort();
    }, [filters]);

    // El orden de columnas lo dicta el array "drivers" del backend, no el cliente
    const activeDriverKeys = lapData?.drivers ?? [];

    // ── Estado inicial sin filtros ────────────────────────────────────────────
    if (!filters) {
        return (
            <div className="flex h-full items-center justify-center flex-col opacity-50">
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">Telemetry Standby</h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Select parameters and drivers in the side panel to start the analysis.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* ── Leyenda (HUD) ──────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 shrink-0">

                {/* Cabecera clicable — muestra contexto de sesión y toggle */}
                <button
                    onClick={() => setLegendOpen(prev => !prev)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                >
                    <div>
                        <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                            {filters
                                ? `${filters.round} · ${filters.session} · ${filters.year}`
                                : 'Data Display Legend'
                            }
                        </h3>
                    </div>
                    <span className="text-gray-500 font-black text-sm tracking-widest transition-transform duration-200"
                        style={{ display: 'inline-block', transform: legendOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                        ▲
                    </span>
                </button>

                {/* Contenido colapsable */}
                {legendOpen && (
                    <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-gray-800">

                        {/* Compuestos de neumáticos */}
                        <div className="space-y-4 pt-4">
                            <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Tire Compounds</span>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { letter: 'S', border: 'border-red-600', text: 'text-red-500', label: 'Soft' },
                                    { letter: 'M', border: 'border-yellow-400', text: 'text-yellow-400', label: 'Medium' },
                                    { letter: 'H', border: 'border-gray-200', text: 'text-gray-200', label: 'Hard' },
                                    { letter: 'I', border: 'border-green-500', text: 'text-green-500', label: 'Inter' },
                                    { letter: 'W', border: 'border-blue-600', text: 'text-blue-500', label: 'Wet' },
                                ].map(({ letter, border, text, label }) => (
                                    <span key={label} className="flex items-center text-sm font-bold text-gray-300">
                                        <div className={`w-5 h-5 flex items-center justify-center rounded-full border-[3px] ${border} bg-[#1a1a1a] mr-1.5`}>
                                            <span className={`font-black text-[9px] ${text}`}>{letter}</span>
                                        </div>
                                        {label}
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-6 mt-2">
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="px-2 py-0.5 bg-gray-800 text-white font-bold rounded-sm mr-2 border border-gray-600">S1</span> Stint Num
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="px-2 py-0.5 bg-gray-800 text-red-400 font-bold rounded-sm mr-2 border border-gray-600">L12</span> Tire Age
                                </span>
                            </div>
                        </div>

                        {/* Track status */}
                        <div className="pt-4">
                            <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Track Status</span>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="w-2 h-2 bg-green-500 shadow-[0_0_4px_#22c55e] rounded-full mr-2" /> Clear
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="w-2 h-2 bg-orange-500 shadow-[0_0_4px_#f97316] rounded-full mr-2" /> Safety Car
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="w-2 h-2 bg-red-600 shadow-[0_0_4px_#dc2626] rounded-full mr-2" /> Red Flag
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="w-2 h-2 border-2 border-orange-400 rounded-full bg-transparent mr-2" /> Virtual SC
                                </span>
                            </div>
                        </div>

                        {/* Eventos */}
                        <div className="pt-4">
                            <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Events & Positions</span>
                            <div className="flex flex-col gap-2">
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="text-purple-400 mr-3 font-black">⚡</span> Fastest Personal Lap
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="inline-block px-1.5 py-0.5 bg-blue-900/40 border border-blue-700 text-blue-400 text-[10px] font-black mr-3">IN</span> Pit In
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="inline-block px-1.5 py-0.5 bg-blue-900/40 border border-blue-700 text-blue-400 text-[10px] font-black mr-3">OUT</span> Pit Out
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="text-gray-500 line-through mr-3">1:35.000</span> Invalid Lap
                                </span>
                                <span className="flex items-center text-sm font-mono text-gray-300">
                                    <span className="px-1.5 py-0.5 bg-gray-800 text-gray-300 font-bold rounded-sm mr-2 border border-gray-600 text-[10px]">P1</span>
                                    <span className="text-green-500 font-black mr-1 text-xs">▲1</span>
                                    <span className="text-red-500 font-black mr-2 text-xs">▼2</span>
                                    Position Delta
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Área de tabla ────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto bg-[#0a0a0c] relative">

                {/* Overlay de carga */}
                {isLoading && (
                    <div className="absolute inset-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <div className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Processing Telemetry...
                        </div>
                    </div>
                )}

                {/* Banner de error */}
                {error && !isLoading && (
                    <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/20 px-5 py-3">
                        <span className="text-red-500 font-black text-lg">⚠</span>
                        <span className="text-red-400 text-xs font-mono flex-1 break-all">{error}</span>
                    </div>
                )}

                {/* Estado vacío */}
                {!isLoading && !error && (!lapData || lapData.laps.length === 0) && (
                    <div className="flex h-full items-center justify-center flex-col opacity-50">
                        <span className="text-6xl mb-4">🏎️</span>
                        <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">Telemetry Standby</h2>
                        <p className="text-sm font-mono text-gray-600 mt-2">
                            Select parameters and drivers in the side panel to start the analysis.
                        </p>
                    </div>
                )}

                {/* Tabla principal */}
                {!isLoading && lapData && lapData.laps.length > 0 && (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 sticky top-0 z-10 shadow-lg">
                            <tr>
                                <th className="p-4 w-20 border-r border-b-2 border-gray-700 text-center text-sm uppercase font-black tracking-widest text-gray-400 bg-black">
                                    LAP
                                </th>
                                {activeDriverKeys.map(driver => {
                                    const color = filters?.driverColors?.[driver] ?? '#FFFFFF';
                                    return (
                                        <th key={driver} className="border-r border-b-2 border-gray-700 text-center bg-gray-900 min-w-[280px] overflow-hidden">
                                            <div className="h-1 w-full" style={{ backgroundColor: color }} />
                                            <div className="p-4">
                                                <span
                                                    className="text-2xl font-black italic uppercase tracking-tighter"
                                                    style={{ color, textShadow: `0 0 20px ${color}40` }}
                                                >
                                                    {driver}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody className="font-mono">
                            {lapData.laps.map((row, index) => (
                                <tr key={row.lap_number} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">

                                    <td className="p-3 border-r border-gray-800 text-center bg-black/50">
                                        <span className="text-lg font-black text-gray-400">{row.lap_number}</span>
                                    </td>

                                    {activeDriverKeys.map(driverAbbr => {
                                        const data = row.entries[driverAbbr];

                                        if (!data) return (
                                            <td key={driverAbbr} className="p-3 border-r border-gray-800 bg-gray-900/10 text-center text-gray-700 text-lg">
                                                —
                                            </td>
                                        );

                                        // Posiciones ganadas/perdidas respecto a la vuelta anterior
                                        let posDelta = 0;
                                        if (index > 0) {
                                            const prev = lapData.laps[index - 1].entries[driverAbbr];
                                            if (prev?.position && data.position) {
                                                posDelta = prev.position - data.position;
                                            }
                                        }

                                        const compInfo = getCompoundInfo(data.compound);
                                        // Solo marcamos la vuelta más rápida si la vuelta no fue eliminada por los comisarios
                                        const isFastestLap = data.is_fastest_lap && !data.deleted;


                                        return (
                                            <td
                                                key={driverAbbr}
                                                className={`p-3 border-r border-gray-800 relative ${data.deleted ? 'opacity-30' : ''}`}
                                            >
                                                <div className="pl-2 pr-2 py-1 flex flex-col gap-2">

                                                    <div className="flex justify-end w-full mb-1">
                                                        {renderTrackStatusDots(data.track_status)}
                                                    </div>

                                                    {/* Fila superior: posición, eventos y tiempo de vuelta */}
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`text-xs px-2 py-1 rounded-sm font-bold border ${data.position === 1 ? 'bg-yellow-900/40 border-yellow-500 text-yellow-400' :
                                                                data.position === 2 ? 'bg-gray-500/20 border-gray-400 text-gray-300' :
                                                                    data.position === 3 ? 'bg-orange-900/30 border-orange-600 text-orange-400' :
                                                                        'bg-gray-800 border-gray-700 text-gray-400'
                                                                }`}>
                                                                P{data.position}
                                                            </span>
                                                            {posDelta > 0 && <span className="text-[11px] font-black text-green-500">▲{posDelta}</span>}
                                                            {posDelta < 0 && <span className="text-[11px] font-black text-red-500">▼{Math.abs(posDelta)}</span>}
                                                            {posDelta === 0 && index > 0 && <span className="text-[11px] font-bold text-gray-600">-</span>}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {isFastestLap && <span className="text-purple-400 text-xl" title="Fastest Personal Lap">⚡</span>}
                                                            {data.pit_in && (
                                                                <span className="px-1.5 py-0.5 bg-blue-900/40 border border-blue-700 text-blue-400 text-[10px] font-black shadow-[0_0_6px_rgba(59,130,246,0.6)]">
                                                                    IN
                                                                </span>
                                                            )}
                                                            {data.pit_out && (
                                                                <span className="px-1.5 py-0.5 bg-blue-900/40 border border-blue-700 text-blue-400 text-[10px] font-black">
                                                                    OUT
                                                                </span>
                                                            )}                                                            <span className={[
                                                                'text-xl font-black tracking-tighter',
                                                                isFastestLap ? 'text-purple-400' : 'text-white',
                                                                data.deleted ? 'line-through text-gray-500' : '',
                                                                !data.is_accurate ? 'opacity-50' : '',
                                                            ].join(' ')}>
                                                                {data.lap_time || 'NO TIME'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Fila inferior: sectores y neumático */}
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div className="flex gap-3 text-xs text-gray-500 font-semibold">
                                                            <span>S1: <span className="text-gray-200">{data.sector1 || '—'}</span></span>
                                                            <span>S2: <span className="text-gray-200">{data.sector2 || '—'}</span></span>
                                                            <span>S3: <span className="text-gray-200">{data.sector3 || '—'}</span></span>
                                                        </div>

                                                        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded p-1">
                                                            <span className="text-xs px-1.5 font-bold text-gray-400">
                                                                S{data.stint}
                                                            </span>
                                                            <span className="text-xs px-1.5 font-bold border-l border-r border-gray-700 text-gray-200">                                                                L{data.tyre_life}
                                                            </span>
                                                            <div
                                                                className={`w-6 h-6 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-inner ${compInfo.colorClass}`}
                                                                title={`Compound: ${data.compound} · Age: ${data.tyre_life} laps`}
                                                            >
                                                                <span className="font-black text-[10px] leading-none">{compInfo.letter}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}