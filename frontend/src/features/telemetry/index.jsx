// Orquestador de la vista de telemetría. Gestiona la selección de vueltas,
// compone los gráficos por canal y coordina el sistema de zoom/pan/crosshair.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTelemetry } from './useTelemetry';
import { useChartZoom } from './useChartZoom';
import ChannelChart from './ChannelChart';
import BinaryChart from './BinaryChart';
import GearChart from './GearChart';
import LapSelector from './LapSelector';

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
    const [crosshairDistance, setCrosshairDistance] = useState(null);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        zoomPercent, pixelToDistance,
    } = useChartZoom(data?.maxDistance ?? 0);

    // Filtra los datos al rango visible con un pequeño buffer para evitar cortes
    const visibleData = useMemo(() => {
        if (!allMergedData.length) return [];
        const buf = (domain[1] - domain[0]) * 0.02;
        return allMergedData.filter(d => d.distance >= domain[0] - buf && d.distance <= domain[1] + buf);
    }, [allMergedData, domain]);

    const handleLoad = useCallback(() => {
        setDriverParam(buildParamFromRows(rows));
    }, [rows]);

    const handleChartMouseMove = useCallback((e) => {
        handleMouseMove(e);
        if (!data) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setCrosshairDistance(pixelToDistance(e.clientX, rect));
    }, [handleMouseMove, pixelToDistance, data]);

    const handleChartMouseLeave = useCallback((e) => {
        handleMouseUp(e);
        setCrosshairDistance(null);
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
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">Telemetry</h2>
                <p className="text-sm font-mono text-gray-600 mt-2">Select parameters in the side panel.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* ── Cabecera ───────────────────────────────────────────────── */}

            {/* ── Selector de vueltas ───────────────────────────────────── */}
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

            {/* ── Leyenda de pilotos ─────────────────────────────────────── */}

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

            {/* ── Error ──────────────────────────────────────────────────── */}

            {error && !isLoading && (
                <div className="flex items-center gap-3 border-b border-red-900/60 bg-red-950/20 px-5 py-3">
                    <span className="text-red-500 font-black shrink-0">⚠</span>
                    <span className="text-red-400 text-xs font-mono break-all">{error}</span>
                </div>
            )}

            {/* ── Loading ────────────────────────────────────────────────── */}

            {isLoading && (
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                        Generating telemetry...
                    </p>
                </div>
            )}

            {/* ── Gráficos ───────────────────────────────────────────────── */}

            {!isLoading && data && (
                <div className="relative">
                    <ChannelChart {...sharedProps} crosshairDistance={crosshairDistance}
                        title="Speed" channel="speed" yLabel="km/h" height={420} showXAxis />
                    <ChannelChart {...sharedProps} crosshairDistance={crosshairDistance}
                        title="Throttle" channel="throttle" yLabel="%" height={250} yDomain={[0, 100]} showXAxis />
                    <BinaryChart  {...sharedProps} crosshairDistance={crosshairDistance}
                        title="Brake" channel="brake" yLabel="Brake" height={180} showXAxis />
                    <ChannelChart {...sharedProps} crosshairDistance={crosshairDistance}
                        title="RPM" channel="rpm" yLabel="RPM" height={250} showXAxis />
                    <GearChart    {...sharedProps} crosshairDistance={crosshairDistance}
                        title="Gear" height={220} showXAxis />
                    <BinaryChart  {...sharedProps} crosshairDistance={crosshairDistance}
                        title="DRS" channel="drs" yLabel="DRS" height={180} showXAxis />
                </div>
            )}

            {!isLoading && !error && !data && (
                <div className="flex items-center justify-center opacity-50 h-48">
                    <p className="text-gray-500 font-black italic uppercase tracking-widest">
                        Select a session and press Load
                    </p>
                </div>
            )}

            {/* ── Barra de controles de zoom ─────────────────────────────── */}

            {data && (
                <div className="border-t border-gray-800 px-5 py-2 flex items-center justify-between text-xs font-mono">
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