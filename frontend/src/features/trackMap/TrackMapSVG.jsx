import { useRef, useState, useMemo } from "react";
import { getXYBounds, getNormParams, normalizePoints, normalizeXY } from "./utils";
import SectorTooltip from "./SectorTooltip";

// Dimensiones del lienzo SVG en unidades virtuales
const VIEWBOX_W = 1100;
const VIEWBOX_H = 600;
// Margen interno entre el borde del SVG y el trazado
const PADDING = 50;
// Grosor de las líneas del trazado coloreado
const STROKE_W = 4;
// Longitud de los tick marks en los límites de sector
const TICK_LEN = 10;

// Convierte milisegundos a formato M:SS.mmm
function formatLapTime(ms) {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = (totalSecs % 60).toFixed(3).padStart(6, '0');
    return `${mins}:${secs}`;
}

// Barra horizontal proporcional al número de microsectores ganados por cada piloto
function DominanceBar({ drivers, sectorsWon, colorMap }) {
    return (
        <div className="flex w-full h-1.5 rounded-full overflow-hidden mt-2">
            {drivers.map(d => (
                <div
                    key={d}
                    style={{
                        width: `${(sectorsWon[d] / 25) * 100}%`,
                        backgroundColor: colorMap[d] ?? '#9ca3af',
                    }}
                />
            ))}
        </div>
    );
}

// Badge de piloto: nombre grande + vuelta, microsectores ganados y tiempo de vuelta
function DriverBadge({ driver, color, lap, sectors, lapTime }) {
    return (
        <div className="flex flex-col">
            <span className="text-5xl font-black italic" style={{ color }}>
                {driver}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-mono text-gray-400">Lap {lap}</span>
                <span className="text-gray-600">·</span>
                <span className="text-xs font-mono text-gray-300 font-bold">{sectors}/25</span>
                <span className="text-gray-600">·</span>
                <span className="text-xs font-mono text-gray-400">{lapTime}</span>
            </div>
        </div>
    );
}

export default function TrackMapSVG({ data, colorMap }) {
    const containerRef = useRef(null);
    const [hoveredSector, setHoveredSector] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Normalización de coordenadas X/Y al espacio SVG con flip del eje Y
    const bounds = useMemo(() => getXYBounds(data.points), [data.points]);
    const normParams = useMemo(() => getNormParams(bounds, VIEWBOX_W, VIEWBOX_H, PADDING), [bounds]);
    const normalized = useMemo(() => normalizePoints(data.points, normParams), [data.points, normParams]);

    // Agrupación de puntos por índice de microsector para los tick marks y hover zones
    const sectorGroups = useMemo(() => {
        const groups = Array.from({ length: data.sectors.length }, () => []);
        const sw = 1.0 / data.sectors.length;
        normalized.forEach(pt => {
            const idx = Math.min(Math.floor(pt.distance / sw), data.sectors.length - 1);
            groups[idx].push(pt);
        });
        return groups;
    }, [normalized, data.sectors.length]);

    // Microsectores ganados y tiempo total por piloto calculados desde los sectores del DTO
    const { sectorsWon, lapTimesMs } = useMemo(() => {
        const won = {}, times = {};
        data.drivers.forEach(d => { won[d.driver] = 0; times[d.driver] = 0; });
        data.sectors.forEach(s => {
            won[s.fastest] = (won[s.fastest] || 0) + 1;
            Object.entries(s.times).forEach(([d, ms]) => { times[d] = (times[d] || 0) + ms; });
        });
        return { sectorsWon: won, lapTimesMs: times };
    }, [data]);

    // Mapa driver → lapNumber para el tooltip, extraído del DTO
    const driverLaps = useMemo(() =>
        Object.fromEntries(data.drivers.map(d => [d.driver, d.lapNumber])),
        [data.drivers]
    );

    // Vector perpendicular al trazado en el punto S/F para el marcador de salida
    const sf = normalized[0];
    const sfNext = normalized[1];
    const sfDx = sfNext ? sfNext.nx - sf.nx : 1;
    const sfDy = sfNext ? sfNext.ny - sf.ny : 0;
    const sfLen = Math.sqrt(sfDx * sfDx + sfDy * sfDy) || 1;
    const sfNx = (-sfDy / sfLen) * 14;
    const sfNy = (sfDx / sfLen) * 14;

    // Posición del ratón relativa al contenedor para el tooltip
    const handleMouseMove = (e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    return (
        <div className="flex flex-col gap-3 p-4">

            {/* ── Header ── */}
            <div className="flex flex-col px-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {data.drivers.map((d, i) => (
                            <div key={d.driver} className="flex items-center gap-4">
                                {i > 0 && <span className="text-gray-700 text-2xl">|</span>}
                                <DriverBadge
                                    driver={d.driver}
                                    color={colorMap[d.driver] ?? '#9ca3af'}
                                    lap={d.lapNumber}
                                    sectors={sectorsWon[d.driver] ?? 0}
                                    lapTime={formatLapTime(lapTimesMs[d.driver] ?? 0)}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xl font-black italic text-gray-400 tracking-widest">
                            {data.session.toUpperCase()}
                        </span>
                        <span className="text-[11px] font-mono text-gray-600">25 microsectors</span>
                    </div>
                </div>
                {/* Barra de dominio: proporción de microsectores ganados por cada piloto */}
                <DominanceBar
                    drivers={data.drivers.map(d => d.driver)}
                    sectorsWon={sectorsWon}
                    colorMap={colorMap}
                />
            </div>

            {/* ── SVG Map ── */}
            <div
                ref={containerRef}
                className="relative w-full max-w-6xl mx-auto bg-[#0a0a0c]"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredSector(null)}
            >
                <svg
                    viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                    className="w-full h-auto"
                    style={{ display: 'block' }}
                >
                    {/* Capa base: trazado gris más ancho simula el asfalto */}
                    <polyline
                        points={normalized.map(p => `${p.nx},${p.ny}`).join(' ')}
                        fill="none"
                        stroke="#2a2a2e"
                        strokeWidth={STROKE_W + 4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Segmentos coloreados: cada línea usa el color del punto de origen */}
                    {normalized.map((pt, i) => {
                        if (i === 0) return null;
                        const prev = normalized[i - 1];
                        const color = colorMap[prev.fastest] ?? '#9ca3af';
                        return (
                            <line
                                key={`seg${i}`}
                                x1={prev.nx} y1={prev.ny}
                                x2={pt.nx} y2={pt.ny}
                                stroke={color}
                                strokeWidth={STROKE_W}
                                strokeLinecap="round"
                            />
                        );
                    })}

                    {/* Tick marks perpendiculares en cada límite de microsector */}
                    {sectorGroups.map((group, s) => {
                        if (s === 0 || group.length === 0) return null;
                        const pt = group[0];
                        const prev = sectorGroups[s - 1].at(-1);
                        if (!prev) return null;
                        const dx = pt.nx - prev.nx;
                        const dy = pt.ny - prev.ny;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const nx = (-dy / len) * TICK_LEN;
                        const ny = (dx / len) * TICK_LEN;
                        return (
                            <line
                                key={`tick${s}`}
                                x1={pt.nx - nx} y1={pt.ny - ny}
                                x2={pt.nx + nx} y2={pt.ny + ny}
                                stroke="#6b7280"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                            />
                        );
                    })}

                    {/* Marcador S/F: línea discontinua perpendicular al trazado */}
                    {sf && (
                        <g>
                            <line
                                x1={sf.nx - sfNx} y1={sf.ny - sfNy}
                                x2={sf.nx + sfNx} y2={sf.ny + sfNy}
                                stroke="#e5e7eb"
                                strokeWidth={1.5}
                                strokeDasharray="3 3"
                            />
                            <text
                                x={sf.nx + sfNx + 3} y={sf.ny + sfNy + 4}
                                fill="#9ca3af" fontSize={20} fontFamily="monospace"
                            >S/F</text>
                        </g>
                    )}

                    {/* Badges de número de curva desplazados fuera del trazado */}
                    {(() => {


                        return data.corners.map(corner => {
                            const { nx, ny } = normalizeXY(corner.x, corner.y, normParams);
                            const label = `${corner.number}${corner.letter}`;
                            const r = label.length > 2 ? 15 : 13;
                            const rad = (corner.angle * Math.PI) / 180;
                            const bx = nx + Math.cos(rad) * 30;
                            const by = ny + Math.sin(rad) * 30;

                            return (
                                <g key={`c${corner.number}${corner.letter}`}>
                                    <circle
                                        cx={bx} cy={by} r={r}
                                        fill="#0f172a" stroke="#475569" strokeWidth={1}
                                    />
                                    <text
                                        x={bx} y={by + 3.5}
                                        textAnchor="middle"
                                        fill="#e2e8f0"
                                        fontSize={label.length > 2 ? 9 : 10}
                                        fontFamily="monospace" fontWeight="bold"
                                    >{label}</text>
                                </g>
                            );
                        });
                    })()}

                    {/* Zonas invisibles de hover por microsector para activar el tooltip */}
                    {sectorGroups.map((group, s) => {
                        if (group.length < 2) return null;
                        return (
                            <polyline
                                key={`hover${s}`}
                                points={group.map(p => `${p.nx},${p.ny}`).join(' ')}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={22}
                                onMouseEnter={() => setHoveredSector(s)}
                            />
                        );
                    })}
                </svg>

                {/* Tooltip con tiempos del sector al hacer hover */}
                {hoveredSector !== null && data.sectors[hoveredSector] && (
                    <SectorTooltip
                        sector={data.sectors[hoveredSector]}
                        x={mousePos.x}
                        y={mousePos.y}
                        colorMap={colorMap}
                        driverLaps={driverLaps}
                    />
                )}
            </div>
        </div>
    );
}