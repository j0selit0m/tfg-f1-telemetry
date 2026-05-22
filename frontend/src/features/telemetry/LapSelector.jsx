// Selector de vuelta por piloto. Permite añadir y eliminar filas de comparación
// y disparar la carga de telemetría via el botón LOAD.

const SESSIONS = ['Race', 'Qualifying', 'FP1', 'FP2', 'FP3', 'Sprint'];

export default function LapSelector({ rows, setRows, availableDrivers, availableSessions, onLoad, isLoading }) {
    const addRow = () => setRows(p => [...p, { driver: availableDrivers[0] ?? '', session: 'Race', lap: '' }]);
    const removeRow = i => setRows(p => p.filter((_, idx) => idx !== i));
    const updateRow = (i, f, v) => setRows(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

    return (
        <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                    <select
                        value={row.driver}
                        onChange={e => updateRow(i, 'driver', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono"
                    >
                        {availableDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                        value={row.session}
                        onChange={e => updateRow(i, 'session', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono"
                    >
                        {(availableSessions ?? SESSIONS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                        type="number"
                        placeholder="Fastest"
                        value={row.lap}
                        onChange={e => updateRow(i, 'lap', e.target.value)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:border-red-600 focus:outline-none font-mono w-20"
                    />
                    <button
                        onClick={() => removeRow(i)}
                        disabled={rows.length === 1}
                        className="text-gray-600 hover:text-red-500 disabled:opacity-20 transition-colors text-sm"
                    >
                        ✕
                    </button>
                </div>
            ))}
            <div className="flex gap-2 mt-1">
                <button
                    onClick={addRow}
                    className="border border-gray-700 text-gray-500 px-2 py-1 text-[10px] font-bold uppercase tracking-widest hover:border-gray-500 hover:text-white transition-colors"
                >
                    + ADD
                </button>
                <button
                    onClick={onLoad}
                    disabled={isLoading}
                    className="border border-gray-700 text-gray-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:border-red-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? '···' : '↻ LOAD'}
                </button>
            </div>
        </div>
    );
}