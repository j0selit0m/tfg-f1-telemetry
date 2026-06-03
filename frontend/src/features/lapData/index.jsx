// Orquestador de la vista de vueltas. Consume useLapData y compone la tabla
// con una fila por vuelta y una columna por piloto seleccionado.
// Integra el módulo de análisis con IA mediante el botón y panel dedicados.

import { useState, useCallback, useEffect } from 'react';
import { useLapData } from './useLapData';
import { useAiAnalysis } from '../../hooks/useAiAnalysis';
import LapRow from './LapRow';
import AiInsightPanel from '../../components/AiInsightPanel';

export default function LapDataGrid({ filters }) {
    const { data, isLoading, error, refetch } = useLapData(filters);
    const ai = useAiAnalysis('/ai/laps-analysis');

    useEffect(() => {
        ai.reset();
    }, [filters?.year, filters?.round, filters?.session, filters?.driver]);

    // El orden de columnas lo dicta el backend, no el cliente
    const driverKeys = data?.drivers ?? [];

    // Extrae los datos objetivos que el usuario ve en pantalla por piloto.
    // No hace cálculos estadísticos — solo filtra y agrupa lo que ya está en el DTO.
    const handleAiAnalysis = useCallback(() => {
        if (!data || !filters) return;

        const driversPayload = data.drivers.map(code => {
            // Recorre todas las vueltas buscando datos de este piloto.
            const entries = data.laps
                .map(row => ({ lapNumber: row.lapNumber, entry: row.entries[code] ?? null }))
                .filter(({ entry }) => entry !== null);

            const bestLapRow = entries.find(({ entry }) => entry.isFastestLap);
            const pitLaps = entries
                .filter(({ entry }) => entry.pitIn)
                .map(({ lapNumber }) => lapNumber);
            const scLaps = entries
                .filter(({ entry }) => entry.trackStatus?.includes('4') && !entry.trackStatus?.includes('6'))
                .map(({ lapNumber }) => lapNumber);

            const vscLaps = entries
                .filter(({ entry }) => entry.trackStatus?.includes('6'))
                .map(({ lapNumber }) => lapNumber);

            const firstEntry = entries[0]?.entry ?? null;
            const lastEntry = entries[entries.length - 1]?.entry ?? null;

            return {
                driver: code,
                best_lap_time: bestLapRow?.entry.lapTime ?? null,
                best_lap_number: bestLapRow?.lapNumber ?? null,
                pit_laps: pitLaps,
                sc_laps: scLaps,
                vsc_laps: vscLaps,
                total_laps: entries.length,
                start_position: firstEntry?.position ?? null,
                end_position: lastEntry?.position ?? null,
            };
        });

        ai.analyse({
            year: filters.year,
            event_name: filters.round,
            session_name: filters.session,
            drivers: driversPayload,
        });
    }, [data, filters, ai.analyse]);

    if (!filters) {
        return (
            <div className="flex items-center justify-center flex-col opacity-50 h-64">
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">Lap Data Standby</h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Select parameters and drivers in the side panel to start the analysis.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* --- Banner de error --- */}

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

            {/* --- Panel de resultado IA --- */}

            <AiInsightPanel
                show={!!data && !isLoading}
                onAnalyse={handleAiAnalysis}
                analysis={ai.analysis}
                isLoading={ai.isLoading}
                error={ai.error}
            />

            {/* --- Leyenda --- */}

            <Legend filters={filters} />

            {/* --- Tabla principal --- */}

            <div className="flex-1 overflow-auto relative">

                {isLoading && (
                    <div className="absolute inset-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <div className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Processing Telemetry...
                        </div>
                    </div>
                )}

                {!isLoading && data && data.laps.length > 0 && (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 sticky top-0 z-10 shadow-lg">
                            <tr>
                                <th className="p-4 w-20 border-r border-b-2 border-gray-700 text-center text-sm uppercase font-black tracking-widest text-gray-400 bg-black">
                                    LAP
                                </th>
                                {driverKeys.map(driver => {
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
                            {data.laps.map((row, index) => (
                                <LapRow
                                    key={row.lapNumber}
                                    row={row}
                                    prevRow={index > 0 ? data.laps[index - 1] : null}
                                    driverKeys={driverKeys}
                                    filters={filters}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// --- Sub-componentes ---

// Leyenda colapsable con los iconos y códigos de color usados en la tabla.
function Legend({ filters }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 shrink-0">
            <button
                onClick={() => setOpen(prev => !prev)}
                className="w-full flex items-center justify-center px-5 py-3 hover:bg-white/5 transition-colors"
            >
                <h3 className="text-gray-300 font-bold uppercase tracking-widest text-s">
                    Data Display Legend
                </h3>
                <span
                    className="text-gray-500 font-black text-sm tracking-widest transition-transform duration-200"
                    style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                    ▲
                </span>
            </button>

            {open && (
                <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-gray-800">

                    {/* Compuestos de neumáticos */}
                    <div className="space-y-4 pt-4">
                        <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Tire Compounds</span>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { key: 'SOFT', letter: 'S', label: 'Soft' },
                                { key: 'MEDIUM', letter: 'M', label: 'Medium' },
                                { key: 'HARD', letter: 'H', label: 'Hard' },
                                { key: 'INTERMEDIATE', letter: 'I', label: 'Inter' },
                                { key: 'WET', letter: 'W', label: 'Wet' },
                            ].map(({ key, letter, label }) => {
                                const color = filters?.compounds?.[key] ?? '#FFFFFF';
                                return (
                                    <span key={label} className="flex items-center text-sm font-bold text-gray-300">
                                        <div
                                            className="w-6 h-6 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] mr-1.5"
                                            style={{ borderColor: color, color }}
                                        >
                                            <span className="font-black text-[9px]">{letter}</span>
                                        </div>
                                        {label}
                                    </span>
                                );
                            })}
                        </div>
                        <div className="flex gap-6 mt-2">
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="px-2 py-0.5 bg-gray-800 text-white font-bold rounded-sm mr-2 border border-gray-600">ST1</span> Stint Num
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
                                <span className="w-2 h-2 bg-yellow-500 shadow-[0_0_4px_#eab308] rounded-full mr-2" /> Yellow Flag
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-orange-500 shadow-[0_0_4px_#f97316] rounded-full mr-2" /> Safety Car
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-red-500 shadow-[0_0_4px_#ef4444] rounded-full mr-2" /> Red Flag
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-purple-500 shadow-[0_0_4px_#a855f7] rounded-full mr-2" /> Virtual SC
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-cyan-500 shadow-[0_0_4px_#06b6d4] rounded-full animate-pulse mr-2" /> VSC Ending
                            </span>
                        </div>
                    </div>

                    {/* Eventos y posiciones */}
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}