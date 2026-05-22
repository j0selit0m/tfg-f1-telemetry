// Tarjeta de resumen de un piloto. Muestra mejor vuelta, estadísticas,
// estrategia de neumáticos y barra de consistencia.

// Rueda Pirelli con el color oficial de la temporada
function CompoundBadge({ compound }) {
    return (
        <div
            className="w-6 h-6 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-inner"
            style={{ borderColor: compound.color, color: compound.color }}
            title={compound.compound}
        >
            <span className="font-black text-[10px] leading-none translate-y-px">
                {compound.label}
            </span>
        </div>
    );
}

// Barra de consistencia: rojo → verde según el valor (0-100)
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

function MetricRow({ label, value }) {
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">{label}</span>
            <span className="font-mono text-sm text-gray-200 font-semibold tabular-nums">{value}</span>
        </div>
    );
}

export default function DriverCard({ driver, isFastest, driverColor }) {
    return (
        <article className={`
            relative flex flex-col gap-4 p-5
            bg-[#0a0a0c] border rounded-sm
            transition-colors duration-200 hover:border-gray-700
            ${isFastest ? 'border-red-600/50' : 'border-gray-800'}
        `}>
            {/* Línea superior con driverColor */}
            <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: isFastest ? undefined : driverColor }}
            >
                {isFastest && <div className="h-full bg-red-600" />}
            </div>

            {/* Cabecera: código piloto + badge fastest + estrategia */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <span
                        className="font-black italic uppercase tracking-tighter text-3xl leading-none"
                        style={{ color: driverColor, textShadow: `0 0 20px ${driverColor}40` }}
                    >
                        {driver.driverCode}
                    </span>
                    {isFastest && (
                        <span className="border border-red-600/50 text-red-600 font-black uppercase text-[9px] tracking-widest px-1.5 py-0.5">
                            ⚡ FASTEST
                        </span>
                    )}
                </div>

                {/* Estrategia: secuencia de compuestos por stint */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {driver.strategy.map((c, i) => (
                        <span key={`${c.compound}-${i}`} className="flex items-center gap-1">
                            {i > 0 && <span className="text-gray-700 text-[10px]">›</span>}
                            <CompoundBadge compound={c} />
                        </span>
                    ))}
                </div>
            </div>

            {/* Mejor vuelta */}
            <div className="border-l-2 border-red-600 pl-3 py-0.5 bg-black/40">
                <p className="text-gray-500 font-bold uppercase text-[9px] tracking-widest mb-0.5">
                    Best Lap{driver.bestLap.lapNumber ? ` · Lap ${driver.bestLap.lapNumber}` : ''}
                </p>
                <p className="font-mono font-black text-2xl tracking-tight text-white tabular-nums">
                    {driver.bestLap.time}
                </p>
            </div>

            {/* Estadísticas */}
            <div>
                <MetricRow label="Average" value={driver.average} />
                <MetricRow label="Median" value={driver.median} />
                <MetricRow label="Std Dev" value={driver.stdDev} />
                <MetricRow label="Valid Laps" value={String(driver.validLaps)} />
            </div>

            {/* Consistencia */}
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