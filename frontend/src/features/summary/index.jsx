// Orquestador de la vista de resumen de sesión. Consume useSessionSummary
// y renderiza una tarjeta por piloto seleccionado.

import { useSessionSummary } from './useSessionSummary';
import DriverCard from './DriverCard';

export default function SummaryStatistics({ filters }) {
    const { data, isLoading, error, refetch } = useSessionSummary(filters);

    const fastestCode = data?.fastestDriver?.driverCode ?? null;
    const driverKeys = filters?.driver ? filters.driver.split(',') : [];

    if (!filters) {
        return (
            <div className="flex h-full items-center justify-center flex-col opacity-50">
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">
                    Summary Standby
                </h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Select parameters and drivers in the side panel to start the analysis.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* ── Cabecera ───────────────────────────────────────────────── */}

            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 px-5 py-4 shrink-0">
                <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl leading-none">
                    Session Summary
                </h3>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                    {filters.round} · {filters.session} · Season {filters.year}
                </p>
            </div>

            {/* ── Banner de error ────────────────────────────────────────── */}

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

            {/* ── Grid de tarjetas ───────────────────────────────────────── */}

            <div className="flex-1 overflow-y-auto relative">
                {data?.drivers.map(driver => (
                    <DriverCard
                        key={driver.driverCode}
                        driver={driver}
                        isFastest={driver.driverCode === fastestCode}
                        driverColor={filters?.driverColors?.[driver.driverCode] ?? '#FFFFFF'}
                    />
                ))}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isLoading
                        ? driverKeys.map(code => <SkeletonCard key={code} />)
                        : data?.drivers.map(driver => (
                            <DriverCard
                                key={driver.driverCode}
                                driver={driver}
                                isFastest={driver.driverCode === fastestCode}
                                driverColor={filters?.driverColors?.[driver.driverCode] ?? '#FFFFFF'}
                            />
                        ))
                    }
                </div>
            </div>
        </div>
    );
}