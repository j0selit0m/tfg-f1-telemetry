// Tooltip imperativo de un canal. Muestra la distancia y el valor de cada
// piloto a esa distancia. Se actualiza vía ref para no provocar re-renders.

import { forwardRef, useImperativeHandle, useRef } from 'react';

const FORMATTERS = {
    speed: v => v == null ? '—' : `${Math.round(v)} km/h`,
    throttle: v => v == null ? '—' : `${Math.round(v)} %`,
    brake: v => v == null ? '—' : (v ? 'ON' : 'OFF'),
    rpm: v => v == null ? '—' : `${Math.round(v)}`,
    gear: v => v == null ? '—' : `${v}`,
    drs: v => v == null ? '—' : (v ? 'ON' : 'OFF'),
};

const ChannelTooltip = forwardRef(function ChannelTooltip(
    { driverKeys, getDriverColor, channel, drivers },
    ref
) {
    const boxRef = useRef(null);
    const distanceRef = useRef(null);
    const valueRefs = useRef({});

    useImperativeHandle(ref, () => ({
        setData(distance, values) {
            const box = boxRef.current;
            if (!box) return;
            if (distance === null || distance === undefined) {
                box.style.opacity = '0';
                return;
            }
            box.style.opacity = '1';
            if (distanceRef.current) {
                distanceRef.current.textContent = `${Math.round(distance)} m`;
            }
            const fmt = FORMATTERS[channel] ?? (v => String(v));
            for (const key of driverKeys) {
                const el = valueRefs.current[key];
                if (el) el.textContent = fmt(values?.[key]);
            }
        }
    }));

    return (
        <div
            ref={boxRef}
            className="absolute top-2 right-2 bg-black/85 backdrop-blur-sm border border-gray-700 px-3 py-2 pointer-events-none z-20 font-mono text-xs"
            style={{ opacity: 0 }}
        >
            <div ref={distanceRef} className="text-gray-400 mb-1 text-[10px] uppercase tracking-widest">
                — m
            </div>
            {driverKeys.map(key => {
                const code = drivers?.[key]?.driverCode ?? key.split('_')[0];
                const session = drivers?.[key]?.session ?? '';
                const lapNumber = drivers?.[key]?.lapNumber ?? '';
                const color = getDriverColor(key);
                return (
                    <div key={key} className="flex items-center gap-2">
                        <span className="font-black" style={{ color }}>{code}</span>
                        <span className="text-gray-300 text-[11px]">{session} L{lapNumber}</span>
                        <span
                            ref={el => { valueRefs.current[key] = el; }}
                            className="text-white font-bold ml-auto"
                        >—</span>
                    </div>
                );
            })}
        </div>
    );
});

export default ChannelTooltip;