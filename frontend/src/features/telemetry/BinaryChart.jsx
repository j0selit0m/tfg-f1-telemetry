// Gráfico de un canal binario (freno, DRS). Usa type="stepAfter" para
// representar correctamente los cambios discretos de estado.
// Crosshair y tooltip imperativos fuera de Recharts.

import { memo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis,
    CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import ChartWrapper from './ChartWrapper';
import CrosshairOverlay from './CrosshairOverlay';
import ChannelTooltip from './ChannelTooltip';

const CHART_MARGIN = { top: 32, right: 8, left: 30, bottom: 20 };

const BinaryChart = memo(function BinaryChart({
    title, visibleData, driverKeys, domain, overlayRef, tooltipRef,
    corners, getDriverColor, drivers, channel, yLabel,
    height, showXAxis, interaction,
}) {
    const visibleCorners = corners.filter(c => c.distance >= domain[0] && c.distance <= domain[1]);

    return (
        <div className="border-b border-gray-800/60">
            <div className="px-5 pt-2">
                <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">{title}</span>
            </div>
            <div className="relative">
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
                                domain={[0, 1]} ticks={[0, 1]}
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
                            {driverKeys.map(key => (
                                <Line
                                    key={key}
                                    type="stepAfter"
                                    dataKey={`${key}_${channel}`}
                                    stroke={getDriverColor(key)}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={false}
                                    isAnimationActive={false}
                                    connectNulls
                                />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartWrapper>

                <ChannelTooltip
                    ref={tooltipRef}
                    driverKeys={driverKeys}
                    getDriverColor={getDriverColor}
                    channel={channel}
                    drivers={drivers}
                />

                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: CHART_MARGIN.top,
                        left: CHART_MARGIN.left,
                        right: CHART_MARGIN.right,
                        bottom: showXAxis ? 15 : 4,
                    }}
                >
                    <CrosshairOverlay ref={overlayRef} />
                </div>
            </div>
        </div>
    );
});

export default BinaryChart;