// Tooltip flotante con tiempos y deltas por microsector.

export default function SectorTooltip({ sector, colorMap, driverLaps, x, y }) {
    const fastestTime = sector.times[sector.fastest];

    const fmt = ms => (ms / 1000).toFixed(3) + 's';
    const fmtDelta = ms => '+' + fmt(ms);

    return (
        <div
            className="absolute z-10 pointer-events-none"
            style={{ left: x + 14, top: y - 10 }}
        >
            <div className="bg-[#0d1117] border border-gray-700 shadow-2xl min-w-44">

                <div className="px-3 py-1.5 border-b border-gray-800 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono">
                        Sector {sector.sectorNumber}
                    </span>
                </div>

                <div className="px-3 py-2 flex flex-col gap-1.5">
                    {Object.entries(sector.times)
                        .sort((a, b) => a[1] - b[1])
                        .map(([driver, ms]) => {
                            const delta = ms - fastestTime;
                            const color = colorMap[driver] ?? '#9ca3af';
                            const isFastest = driver === sector.fastest;
                            const lap = driverLaps?.[driver];
                            return (
                                <div key={driver} className="flex items-center justify-between gap-6">
                                    <span className="text-xs font-black font-mono" style={{ color }}>
                                        {driver}
                                        {lap != null && (
                                            <span className="text-gray-600 font-normal ml-1">
                                                (Lap {lap})
                                            </span>
                                        )}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-gray-200 tabular-nums">
                                            {fmt(ms)}
                                        </span>
                                        <span className={`text-[10px] font-mono tabular-nums w-14 text-right ${isFastest ? 'text-gray-600' : 'text-red-400'}`}>
                                            {isFastest ? '—' : fmtDelta(delta)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}