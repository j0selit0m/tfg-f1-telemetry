// Tarjeta de piloto seleccionado en el sidebar.
// La franja lateral izquierda y el glow usan driverColor (color individual del piloto).

export default function DriverCard({ driver, abbr, driverColor, onRemove }) {
    return (
        <div className="relative flex items-stretch overflow-hidden border border-gray-800 shadow-lg group bg-black">
            <div className="w-2 shrink-0" style={{ backgroundColor: driverColor }} />
            <div
                className="flex-1 px-2.5 py-1.5 flex items-center justify-between"
                style={{ background: `linear-gradient(90deg, ${driverColor}15 0%, transparent 100%)` }}
            >
                <div className="flex items-baseline gap-2">
                    <span
                        className="text-lg font-black italic uppercase tracking-tighter"
                        style={{ color: driverColor, textShadow: `0 0 12px ${driverColor}60` }}
                    >
                        {abbr}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                        {driver?.fullName || 'Driver'}
                    </span>
                </div>
                <button
                    onClick={onRemove}
                    className="w-5 h-5 flex items-center justify-center border border-gray-700 bg-gray-900 rounded-sm hover:border-red-500 hover:bg-red-900/30 transition-all cursor-pointer"
                >
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-red-500">✕</span>
                </button>
            </div>
        </div>
    );
}