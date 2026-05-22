// Gráfico de marcha. Usa type="stepAfter" y un dominio fijo [1,8]
// para representar correctamente los cambios de marcha.

import { memo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis,
    CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import ChartWrapper from './ChartWrapper';
import ChannelTooltip from './ChannelTooltip';

const CHART_MARGIN = { top: 32, right: 8, left: 30, bottom: 20 };

const GearChart = memo(function GearChart({
    title, visibleData, driverKeys, domain, crosshairDistance,
    corners, getDriverColor, drivers, height, showXAxis, interaction,
}) {
    const visibleCorners = corners.filter(c => c.distance >= domain[0] && c.distance <= domain[1]);

    return (
        <div className="border-b border-gray-800/60">
            <div className="px-5 pt-2">
                <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">{title}</span>
            </div>
            <div className="relative">
                <ChannelTooltip
                    distance={crosshairDistance}
                    drivers={drivers}
                    channel="gear"
                    getDriverColor={getDriverColor}
                />
                <ChartWrapper height={height} {...interaction}>
                    <ResponsiveContainer width="100%" height={height}>
                        <ComposedChart data={visibleData} margin={{ ...CHART_MARGIN, bottom: showXAxis ? 15 : 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            {showXAxis ? (
                                <XAxis
                                    dataKey="distance" type="number" domain={domain} tickCount={10}
                                    stroke="#6b7280"
                                    tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                    tickFormatter={v => `${Math.round(v)}`}
                                    label={{ value: 'Distance (m)', position: 'insideBottom', offset: -3, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                                />
                            ) : (
                                <XAxis dataKey="distance" type="number" domain={domain} hide />
                            )}
                            <YAxis
                                domain={[1, 8]} ticks={[1, 2, 3, 4, 5, 6, 7, 8]}
                                stroke="#6b7280"
                                tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                label={{ value: 'Gear', angle: -90, position: 'insideLeft', offset: 15, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
                            />
                            {visibleCorners.map(c => (
                                <ReferenceLine
                                    key={`${c.number}${c.letter}`}
                                    x={c.distance} stroke="#374151" strokeWidth={1}
                                    label={{ value: c.label, position: 'top', fill: '#4b5563', fontSize: 12, fontFamily: 'monospace' }}
                                />
                            ))}
                            {crosshairDistance !== null && (
                                <ReferenceLine x={crosshairDistance} stroke="#dc2626" strokeWidth={1.5} strokeOpacity={0.8} />
                            )}
                            {driverKeys.map(key => (
                                <Line
                                    key={key}
                                    type="stepAfter"
                                    dataKey={`${key}_gear`}
                                    stroke={getDriverColor(key)}
                                    strokeWidth={1.5}
                                    dot={false}
                                    activeDot={false}
                                    isAnimationActive={false}
                                    connectNulls
                                />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartWrapper>
            </div>
        </div>
    );
});

export default GearChart;