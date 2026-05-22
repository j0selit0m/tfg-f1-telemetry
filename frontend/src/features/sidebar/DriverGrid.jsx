// Grid de botones toggle para seleccionar pilotos.
// Usa teamColor para el borde y la franja superior;
// driverColor queda reservado para las gráficas.

function Spinner() {
    return (
        <span className="inline-block w-3 h-3 border border-gray-500 border-t-red-500 rounded-full animate-spin ml-2" />
    );
}

export default function DriverGrid({ drivers, selectedDrivers, onToggle, loading }) {
    return (
        <div className="mb-2">
            <label className="flex items-center text-sm font-bold italic text-gray-300 uppercase tracking-wide mb-2">
                Driver Grid
                {loading && <Spinner />}
            </label>
            <div className={`grid grid-cols-4 gap-1.5 ${!drivers.length ? 'opacity-40 pointer-events-none' : ''}`}>
                {!drivers.length ? (
                    <p className="col-span-4 text-gray-500 text-xs text-center mt-2 italic border border-gray-700 p-2">
                        Awaiting session data...
                    </p>
                ) : (
                    drivers.map(driver => {
                        const isSelected = selectedDrivers.includes(driver.abbreviation);
                        const color = driver.teamColor || '#FFFFFF';
                        return (
                            <button
                                key={driver.abbreviation}
                                onClick={() => onToggle(driver.abbreviation)}
                                className={`relative py-1.5 px-1 border transition-all overflow-hidden ${isSelected ? 'bg-gray-900' : 'bg-black hover:bg-gray-800'}`}
                                style={{ borderColor: isSelected ? color : '#374151' }}
                            >
                                <div
                                    className="absolute top-0 left-0 w-full h-1"
                                    style={{ backgroundColor: isSelected ? color : 'transparent' }}
                                />
                                <span className={`font-mono text-sm tracking-tighter ${isSelected ? 'text-white font-black' : 'text-gray-500 font-bold'}`}>
                                    {driver.abbreviation}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}