// Gráfico de un canal de telemetría continuo (velocidad, acelerador, RPM).

import { memo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis,
    CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import ChartWrapper from './ChartWrapper';
import ChannelTooltip from './ChannelTooltip';

const CHART_MARGIN = { top: 32, right: 8, left: 30, bottom: 20 };

const ChannelChart = memo(function ChannelChart({
    title, visibleData, driverKeys, domain, crosshairDistance,
    corners, getDriverColor, drivers, channel, yLabel, yDomain,
    height, showXAxis, interaction,
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
                    channel={channel}
                    getDriverColor={getDriverColor}
                />
                <ChartWrapper height={height} {...interaction}>
                    <ResponsiveContainer width="100%" height={height}>
                        <ComposedChart data={visibleData} margin={CHART_MARGIN}>
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
                                domain={yDomain ?? ['auto', 'auto']}
                                stroke="#6b7280"
                                tick={{ fill: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}
                                label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 15, fill: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}
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
                                    type="monotone"
                                    dataKey={`${key}_${channel}`}
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

export default ChannelChart;