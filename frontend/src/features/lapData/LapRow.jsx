// Fila de la tabla correspondiente a una vuelta.
// Renderiza los datos de cada piloto para ese número de vuelta.

const COMPOUND_LETTERS = { SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W' };

// LEDs de color para cada código de estado de pista.
// Códigos según la API oficial de FastF1:
//   '1' = Track clear       → verde
//   '2' = Yellow flag       → amarillo
//   '4' = Safety Car        → naranja sólido
//   '5' = Red Flag          → rojo
//   '6' = VSC deployed      → morado
//   '7' = VSC ending        → cyan parpadeante
function TrackStatusDots({ trackStatus }) {
    if (!trackStatus) return null;

    const statusStyles = {
        '1': 'bg-green-500 shadow-[0_0_4px_#22c55e]',
        '2': 'bg-yellow-500 shadow-[0_0_4px_#eab308]',
        '4': 'bg-orange-500 shadow-[0_0_4px_#f97316]',
        '5': 'bg-red-500 shadow-[0_0_4px_#ef4444]',
        '6': 'bg-purple-500 shadow-[0_0_4px_#a855f7]',
        '7': 'bg-cyan-500 shadow-[0_0_4px_#06b6d4] animate-pulse',
    };
    const statusLabels = {
        '1': 'Track Clear',
        '2': 'Yellow Flag',
        '4': 'Safety Car',
        '5': 'Red Flag',
        '6': 'Virtual Safety Car',
        '7': 'Virtual Safety Car Ending',
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
}

function CompoundWheel({ compound, color }) {
    const letter = COMPOUND_LETTERS[compound?.toUpperCase()] ?? 'X';
    return (
        <div
            className="w-6 h-6 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-inner"
            style={{ borderColor: color, color }}
            title={compound}
        >
            <span className="font-black text-[10px] leading-none translate-y-px">{letter}</span>
        </div>
    );
}

function DriverCell({ entry, prevEntry, filters }) {
    if (!entry) {
        return (
            <td className="p-3 border-r border-gray-800 bg-gray-900/10 text-center text-gray-700 text-lg">
                —
            </td>
        );
    }

    // Posiciones ganadas/perdidas respecto a la vuelta anterior
    const posDelta = prevEntry?.position && entry.position
        ? prevEntry.position - entry.position
        : 0;

    const compoundKey = entry.compound?.toUpperCase() ?? 'UNKNOWN';
    const compoundColor = filters?.compounds?.[compoundKey] ?? '#FFFFFF';
    const isFastestLap = entry.isFastestLap && !entry.deleted;

    return (
        <td className={`p-3 border-r border-gray-800 relative ${entry.deleted ? 'opacity-30' : ''}`}>
            <div className="pl-2 pr-2 py-1 flex flex-col gap-2">

                <div className="flex justify-end w-full mb-1">
                    <TrackStatusDots trackStatus={entry.trackStatus} />
                </div>

                {/* Posición, eventos y tiempo de vuelta */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-1 rounded-sm font-bold border ${entry.position === 1 ? 'bg-yellow-900/40 border-yellow-500 text-yellow-400' :
                            entry.position === 2 ? 'bg-gray-500/20 border-gray-400 text-gray-300' :
                                entry.position === 3 ? 'bg-orange-900/30 border-orange-600 text-orange-400' :
                                    'bg-gray-800 border-gray-700 text-gray-400'
                            }`}>
                            P{entry.position}
                        </span>
                        {posDelta > 0 && <span className="text-[11px] font-black text-green-500">▲{posDelta}</span>}
                        {posDelta < 0 && <span className="text-[11px] font-black text-red-500">▼{Math.abs(posDelta)}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                        {isFastestLap && <span className="text-purple-400 text-xl" title="Fastest Personal Lap">⚡</span>}
                        {entry.pitIn && (
                            <span className="px-1.5 py-0.5 bg-blue-900/40 border border-blue-700 text-blue-400 text-[10px] font-black shadow-[0_0_6px_rgba(59,130,246,0.6)]">
                                IN
                            </span>
                        )}
                        {entry.pitOut && (
                            <span className="px-1.5 py-0.5 bg-blue-900/40 border border-blue-700 text-blue-400 text-[10px] font-black">
                                OUT
                            </span>
                        )}
                        <span className={[
                            'text-xl font-black tracking-tighter',
                            isFastestLap ? 'text-purple-400' : 'text-white',
                            entry.deleted ? 'line-through text-gray-500' : '',
                            !entry.isAccurate ? 'opacity-50' : '',
                        ].join(' ')}>
                            {entry.lapTime || 'NO TIME'}
                        </span>
                    </div>
                </div>

                {/* Sectores y neumático */}
                <div className="flex justify-between items-end mt-2">
                    <div className="flex gap-3 text-xs text-gray-500 font-semibold">
                        <span>S1: <span className="text-gray-200">{entry.sector1 || '—'}</span></span>
                        <span>S2: <span className="text-gray-200">{entry.sector2 || '—'}</span></span>
                        <span>S3: <span className="text-gray-200">{entry.sector3 || '—'}</span></span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded p-1">
                        <span className="text-xs px-1.5 font-bold text-gray-400">ST{entry.stint}</span>
                        <span className="text-xs px-1.5 font-bold border-l border-r border-gray-700 text-gray-200">L{entry.tyreLife}</span>
                        <CompoundWheel compound={entry.compound} color={compoundColor} />
                    </div>
                </div>

            </div>
        </td>
    );
}

export default function LapRow({ row, prevRow, driverKeys, filters }) {
    return (
        <tr className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
            <td className="p-3 border-r border-gray-800 text-center bg-black/50">
                <span className="text-lg font-black text-gray-400">{row.lapNumber}</span>
            </td>
            {driverKeys.map(driver => (
                <DriverCell
                    key={driver}
                    entry={row.entries[driver] ?? null}
                    prevEntry={prevRow?.entries[driver] ?? null}
                    filters={filters}
                />
            ))}
        </tr>
    );
}