// Celda de la tabla para un piloto en un stint concreto.
// Si el piloto no participó en ese stint renderiza un guión.

// Rueda Pirelli con color oficial de la temporada
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

export default function StintCell({ driverData }) {
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

                {/* Compuesto y duración del stint */}
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

                {/* Average y median en paralelo */}
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

                {/* Consistencia */}
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