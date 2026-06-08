// Orquestador de la vista de telemetría. Gestiona la selección de vueltas,
// compone los gráficos por canal y coordina el sistema de zoom/pan/crosshair.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTelemetry } from './useTelemetry';
import { useChartZoom } from './useChartZoom';
import ChannelChart from './ChannelChart';
import BinaryChart from './BinaryChart';
import GearChart from './GearChart';
import LapSelector from '../../components/LapSelector';

import { PLOT_LEFT_OFFSET, PLOT_RIGHT_OFFSET, CHART_HEIGHTS } from './chartConstants';

const CHART_CHANNELS = ['speed', 'throttle', 'brake', 'rpm', 'gear', 'drs'];

// Construye el parámetro de drivers para la URL a partir de las filas del selector
function buildParamFromRows(rows) {
    return rows
        .map(r => r.lap ? `${r.driver}:${r.session}:${r.lap}` : `${r.driver}:${r.session}`)
        .join(',');
}

// Fusiona los datos de todos los pilotos en un array indexado por distancia
function mergeDriverData(drivers) {
    const map = {};
    Object.entries(drivers).forEach(([key, driver]) => {
        driver.data.forEach(pt => {
            if (!map[pt.distance]) map[pt.distance] = { distance: pt.distance };
            map[pt.distance][`${key}_speed`] = pt.speed;
            map[pt.distance][`${key}_throttle`] = pt.throttle;
            map[pt.distance][`${key}_brake`] = pt.brake;
            map[pt.distance][`${key}_rpm`] = pt.rpm;
            map[pt.distance][`${key}_gear`] = pt.gear;
            map[pt.distance][`${key}_drs`] = pt.drsActive;
        });
    });
    return Object.values(map).sort((a, b) => a.distance - b.distance);
}

export default function TelemetryView({ filters }) {
    const [rows, setRows] = useState([]);
    const [driverParam, setDriverParam] = useState('');
    // Refs a los overlays de crosshair de cada uno de los 6 charts.
    // Permiten actualizar la posición de la línea roja sin re-renderizar nada.
    const crosshairRefs = useRef([]);
    const tooltipRefs = useRef([]);
    const availableDrivers = useMemo(
        () => filters?.driver ? filters.driver.split(',').map(s => s.trim()) : [],
        [filters?.driver]
    );

    // Inicializa las filas del selector cuando cambian los filtros globales
    useEffect(() => {
        if (!availableDrivers.length || !filters?.session) return;
        const defaultRows = availableDrivers.map(d => ({ driver: d, session: filters.session, lap: '' }));
        setRows(defaultRows);
        setDriverParam(buildParamFromRows(defaultRows));
    }, [filters?.year, filters?.round, filters?.driver, filters?.session]);

    const { data, isLoading, error } = useTelemetry(filters, driverParam);

    const driverKeys = useMemo(() => (data ? Object.keys(data.drivers) : []), [data]);

    const getDriverColor = useCallback((key) => {
        const code = data?.drivers[key]?.driverCode ?? key.split('_')[0];
        return filters?.driverColors?.[code] ?? '#9ca3af';
    }, [filters, data]);

    const allMergedData = useMemo(() => (data ? mergeDriverData(data.drivers) : []), [data]);

    const {
        domain, buildWheelHandler, handleMouseDown,
        handleMouseMove, handleMouseUp, resetZoom,
        zoomPercent, 
    } = useChartZoom(data?.maxDistance ?? 0);

    // Filtra los datos al rango visible con un pequeño buffer para evitar cortes
    const visibleData = useMemo(() => {
        if (!allMergedData.length) return [];
        const buf = (domain[1] - domain[0]) * 0.02;
        return allMergedData.filter(d =>
            d.distance >= domain[0] - buf && d.distance <= domain[1] + buf
        );
    }, [allMergedData, domain]);

    const handleLoad = useCallback(() => {
        setDriverParam(buildParamFromRows(rows));
    }, [rows]);

    const handleChartMouseMove = useCallback((e) => {
        handleMouseMove(e);
        if (!data) return;

        const rect = e.currentTarget.getBoundingClientRect();

        const plotWidth = rect.width - PLOT_LEFT_OFFSET - PLOT_RIGHT_OFFSET;

        // El área de plot real está dentro de los márgenes.
        if (plotWidth <= 0) return;

        // Posición del ratón dentro del plot area, no del contenedor.
        const mouseInPlotX = e.clientX - rect.left - PLOT_LEFT_OFFSET;
        const clampedX = Math.max(0, Math.min(plotWidth, mouseInPlotX));

        // Distancia y porcentaje calculados desde las coordenadas del plot area.
        const [d0, d1] = domain;
        const distance = d0 + (clampedX / plotWidth) * (d1 - d0);
        const pct = (clampedX / plotWidth) * 100;

        // 1) Mover las 6 líneas rojas
        crosshairRefs.current.forEach(ref => ref?.setPercent(pct));

        // 2) Mapear canal -> campo del DTO
        const FIELD = {
            speed: 'speed', throttle: 'throttle', brake: 'brake',
            rpm: 'rpm', gear: 'gear', drs: 'drsActive',
        };

        // 3) Actualizar tooltips con el punto más cercano
        tooltipRefs.current.forEach((ref, i) => {
            if (!ref) return;
            const field = FIELD[CHART_CHANNELS[i]];
            const values = {};
            for (const key of driverKeys) {
                const arr = data.drivers[key]?.data;
                const pt = arr?.find(p => p.distance >= distance) ?? arr?.at(-1);
                values[key] = pt?.[field] ?? null;
            }
            ref.setData(distance, values);
        });
    }, [handleMouseMove, data, domain, driverKeys]);

    const handleChartMouseLeave = useCallback((e) => {
        handleMouseUp(e);
        crosshairRefs.current.forEach(ref => ref?.setPercent(null));
        tooltipRefs.current.forEach(ref => ref?.setData(null, {}));
    }, [handleMouseUp]);

    const interaction = useMemo(() => ({
        buildWheelHandler,
        handleMouseDown,
        handleMouseMove: handleChartMouseMove,
        handleMouseUp,
        onDoubleClick: resetZoom,
        onMouseLeave: handleChartMouseLeave,
    }), [buildWheelHandler, handleMouseDown, handleChartMouseMove, handleMouseUp, resetZoom, handleChartMouseLeave]);

    // Props compartidas entre todos los gráficos de canal
    const sharedProps = {
        visibleData, driverKeys, domain,
        corners: data?.corners ?? [],
        getDriverColor,
        drivers: data?.drivers ?? {},
        interaction,
    };

    if (!filters) {
        return (
            <div className="flex items-center justify-center flex-col opacity-50 h-64">
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">Telemetry Standby</h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Select parameters and drivers in the side panel to start the analysis.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* --- Cabecera --- */}

            {/* --- Selector de vueltas --- */}
            <div className="bg-[#111318] border-b border-gray-800 px-5 py-3 flex items-center gap-4 shrink-0 flex-wrap">
                <LapSelector
                    rows={rows}
                    setRows={setRows}
                    availableDrivers={availableDrivers}
                    availableSessions={filters?.availableSessions}
                    onLoad={handleLoad}
                    isLoading={isLoading}
                />
            </div>

            {/* --- Leyenda de pilotos --- */}

            {data && (
                <div className="flex flex-wrap gap-6 px-5 py-2 border-b border-gray-800 bg-black/40">
                    {Object.values(data.drivers).map(d => {
                        const isFastest = rows.find(r => r.driver === d.driverCode && r.session === d.session)?.lap === '';
                        return (
                            <div key={d.key} className="flex items-center gap-2 font-mono text-xs">
                                <div className="w-8 h-px" style={{ backgroundColor: getDriverColor(d.key) }} />
                                <span style={{ color: getDriverColor(d.key) }} className="font-black">{d.driverCode}</span>
                                <span className="text-gray-600">
                                    {d.session} · L{d.lapNumber} {isFastest ? '· Fastest' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- Error --- */}

            {error && !isLoading && (
                <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/20 px-5 py-3">
                    <span className="text-red-500 font-black shrink-0">⚠</span>
                    <span className="text-red-400 text-xs font-mono break-all">{error}</span>
                </div>
            )}

            {/* --- Loading --- */}

            {isLoading && (
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                        Generating telemetry...
                    </p>
                </div>
            )}

            {/* --- Gráficos --- */}


            <div className="relative">
                {!isLoading && !error && data && (
                    <div className="relative">
                        <ChannelChart {...sharedProps}
                            overlayRef={el => { crosshairRefs.current[0] = el; }}
                            tooltipRef={el => { tooltipRefs.current[0] = el; }}
                            title="Speed" channel="speed" yLabel="km/h" height={CHART_HEIGHTS.speed} showXAxis />
                        <ChannelChart {...sharedProps}
                            overlayRef={el => { crosshairRefs.current[1] = el; }}
                            tooltipRef={el => { tooltipRefs.current[1] = el; }}
                            title="Throttle" channel="throttle" yLabel="%" height={CHART_HEIGHTS.throttle} showXAxis yDomain={[0, 100]} />
                        <BinaryChart {...sharedProps}
                            overlayRef={el => { crosshairRefs.current[2] = el; }}
                            tooltipRef={el => { tooltipRefs.current[2] = el; }}
                            title="Brake" channel="brake" yLabel="Brake" height={CHART_HEIGHTS.brake} showXAxis />
                        <ChannelChart {...sharedProps}
                            overlayRef={el => { crosshairRefs.current[3] = el; }}
                            tooltipRef={el => { tooltipRefs.current[3] = el; }}
                            title="RPM" channel="rpm" yLabel="RPM" height={CHART_HEIGHTS.rpm} showXAxis />
                        <GearChart {...sharedProps}
                            overlayRef={el => { crosshairRefs.current[4] = el; }}
                            tooltipRef={el => { tooltipRefs.current[4] = el; }}
                            title="Gear" height={CHART_HEIGHTS.gear} showXAxis />
                        <BinaryChart {...sharedProps}
                            overlayRef={el => { crosshairRefs.current[5] = el; }}
                            tooltipRef={el => { tooltipRefs.current[5] = el; }}
                            title="DRS" channel="drs" yLabel="DRS" height={CHART_HEIGHTS.drs} showXAxis />
                    </div>
                )}
            </div>

            {!isLoading && !error && !data && (
                <div className="flex items-center justify-center opacity-50 h-48">
                    <p className="text-gray-500 font-black italic uppercase tracking-widest">
                        Select a session and press Load
                    </p>
                </div>
            )}

            {/* --- Barra de controles de zoom --- */}

            {data && (
                <div className="border-t border-gray-800 px-5 py-2 flex items-center justify-between text-sm font-mono">
                    <div className="flex gap-5 text-gray-600">
                        <span><strong className="text-gray-500">Wheel</strong> → Zoom</span>
                        <span><strong className="text-gray-500">Drag</strong> → Pan</span>
                        <span><strong className="text-gray-500">Double click</strong> → Reset</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-gray-600">{Math.round(domain[0])}m → {Math.round(domain[1])}m</span>
                        <span className="text-red-600 font-black">{zoomPercent}%</span>
                        <button
                            onClick={resetZoom}
                            className="border border-gray-700 text-gray-500 px-2 py-0.5 hover:border-gray-500 hover:text-white transition-colors"
                        >
                            RESET
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}