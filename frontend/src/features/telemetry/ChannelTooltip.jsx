// Tooltip flotante que muestra el valor interpolado de cada canal en la
// distancia donde se encuentra el cursor (crosshair).

// Interpola el valor de un campo entre los dos puntos más cercanos a la distancia dada
function interpolate(data, distance, field) {
    if (!data?.length) return null;
    let lo = null, hi = null;
    for (const pt of data) {
        if (pt.distance <= distance) lo = pt;
        else { hi = pt; break; }
    }
    if (!lo) return hi?.[field] ?? null;
    if (!hi) return lo?.[field] ?? null;
    const t = (distance - lo.distance) / (hi.distance - lo.distance);
    return lo[field] + t * (hi[field] - lo[field]);
}

const CHANNEL_CONFIG = {
    speed: { field: 'speed', fmt: v => `${Math.round(v)} km/h` },
    throttle: { field: 'throttle', fmt: v => `${Math.round(v)}%` },
    brake: { field: 'brake', fmt: v => v >= 0.5 ? 'ON' : 'OFF' },
    rpm: { field: 'rpm', fmt: v => `${Math.round(v)}` },
    gear: { field: 'gear', fmt: v => `${Math.round(v)}` },
    drs: { field: 'drsActive', fmt: v => v >= 0.5 ? 'OPEN' : '—' },
};

export default function ChannelTooltip({ distance, drivers, channel, getDriverColor }) {
    if (distance === null) return null;
    const config = CHANNEL_CONFIG[channel];
    if (!config) return null;

    return (
        <div
            style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, pointerEvents: 'none' }}
            className="bg-black/90 border border-gray-700 shadow-lg font-mono text-xs px-2.5 py-2 flex flex-col gap-1.5"
        >
            <div className="border-b border-gray-700 pb-1.5 mb-0.5">
                <span className="text-gray-500 text-[10px] uppercase tracking-widest">Distance</span>
                <span className="block text-white font-black text-base tabular-nums leading-none mt-0.5">
                    {Math.round(distance)} m
                </span>
            </div>
            {Object.values(drivers).map(driver => {
                const v = interpolate(driver.data, distance, config.field);
                const color = getDriverColor(driver.key);
                return (
                    <div key={driver.key} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-black" style={{ color }}>{driver.driverCode}</span>
                        <span className="text-white tabular-nums">{v !== null ? config.fmt(v) : '—'}</span>
                    </div>
                );
            })}
        </div>
    );
}