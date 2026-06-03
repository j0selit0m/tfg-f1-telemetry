// Orquestador de la vista de análisis de stints. Consume useStintAnalysis
// y renderiza una tabla con una fila por stint y una columna por piloto.
// Integra el módulo de análisis con IA mediante el botón y panel dedicados.

import { useCallback, useEffect } from 'react';
import { useStintAnalysis } from './useStintAnalysis';
import { useAiAnalysis } from '../../hooks/useAiAnalysis';
import StintCell from './StintCell';
import AiInsightPanel from '../../components/AiInsightPanel';

export default function StintAnalysis({ filters }) {
    const { data, isLoading, error, refetch } = useStintAnalysis(filters);
    const ai = useAiAnalysis('/ai/stints-analysis');

    useEffect(() => {
        ai.reset();
    }, [filters?.year, filters?.round, filters?.session, filters?.driver]);

    // Orden de columnas dictado por el backend; fallback al filtro mientras carga
    const driverKeys = data?.drivers ?? (filters?.driver ? filters.driver.split(',') : []);

    // Empaqueta los datos de stints visibles en pantalla para enviarlos al backend.
    const handleAiAnalysis = useCallback(() => {
        if (!data || !filters) return;

        ai.analyse({
            year: filters.year,
            event_name: filters.round,
            session_name: filters.session,
            drivers: data.drivers,
            driver_names: Object.fromEntries(
                data.drivers.map(code => [
                    code,
                    filters?.driverNames?.[code] ?? code
                ])
            ),
            stints: data.stints.map(stint => ({
                stint_number: stint.stintNumber,
                drivers: Object.fromEntries(
                    Object.entries(stint.drivers).map(([code, d]) => [
                        code,
                        d ? {
                            compound_label: d.compoundLabel,
                            duration_laps: d.durationLaps,
                            best_lap: d.bestLap?.time ?? null,
                            average: d.average ?? null,
                            consistency: d.consistency ?? null,
                        } : null,
                    ])
                ),
            })),
        });
    }, [data, filters, ai.analyse]);

    if (!filters) {
        return (
            <div className="flex items-center justify-center flex-col opacity-50 h-64">
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

            {/* --- Tabla --- */}

            <div className="flex-1 overflow-auto relative pt-4">

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
                                    <th key={code} className="border-r border-b-2 border-gray-700 text-center bg-gray-900 min-w-[240px] overflow-hidden">
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