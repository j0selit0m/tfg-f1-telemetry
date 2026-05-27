// Orquestador de la vista de mapa de circuito.
// Sigue el mismo patrón que TelemetryView: rows → driverParam → fetch → render.

import { useState, useEffect, useCallback, useMemo } from 'react';
import LapSelector from '../telemetry/LapSelector';
import { useTrackMap } from './useTrackMap';
import TrackMapSVG from './TrackMapSVG';

const N_SECTORS = 25;

const FALLBACK_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

function buildParamFromRows(rows) {
    return rows
        .map(r => r.lap ? `${r.driver}:${r.session}:${r.lap}` : `${r.driver}:${r.session}`)
        .join(',');
}

export default function TrackMapView({ filters }) {
    const [rows, setRows] = useState([]);
    const [driverParam, setDriverParam] = useState('');
    const [sessionError, setSessionError] = useState('');

    const availableDrivers = useMemo(
        () => filters?.driver ? filters.driver.split(',').map(s => s.trim()) : [],
        [filters?.driver],
    );

    useEffect(() => {
        if (!availableDrivers.length || !filters?.session) return;
        const defaultRows = availableDrivers.map(d => ({
            driver: d,
            session: filters.session,
            lap: '',
        }));
        setRows(defaultRows);
        setDriverParam(buildParamFromRows(defaultRows));
        setSessionError('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, filters?.driver, filters?.session]);

    const { data, isLoading, error } = useTrackMap(filters, driverParam, N_SECTORS);

    const handleLoad = useCallback(() => {
        const sessions = [...new Set(rows.map(r => r.session))];
        if (sessions.length > 1) {
            setSessionError(`Todos los pilotos deben estar en la misma sesión (${sessions.join(', ')}).`);
            return;
        }
        setSessionError('');
        setDriverParam(buildParamFromRows(rows));
    }, [rows]);

    const colorMap = useMemo(() => {
        if (!data) return {};
        return Object.fromEntries(
            data.drivers.map((d, i) => [
                d.driver,
                filters?.driverColors?.[d.driver] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
            ])
        );
    }, [data, filters]);

    if (!filters) {
        return (
            <div className="flex items-center justify-center flex-col opacity-50 h-64">
                <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">
                    Track Map Standby
                </h2>
                <p className="text-sm font-mono text-gray-600 mt-2">
                    Select parameters in the side panel.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200 min-h-full">

            {/* Selector de vueltas */}
            <div className="bg-[#111318] border-b border-gray-800 px-5 py-3 flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-4 flex-wrap">
                    <LapSelector
                        rows={rows}
                        setRows={setRows}
                        availableDrivers={availableDrivers}
                        availableSessions={filters?.availableSessions}
                        onLoad={handleLoad}
                        isLoading={isLoading}
                    />
                </div>
                {sessionError && (
                    <p className="text-xs font-mono text-red-500">{sessionError}</p>
                )}
            </div>

            {/* Área principal */}
            <div className="flex-1 overflow-y-auto">

                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">
                            Generating Track Map...
                        </p>
                    </div>
                )}

                {!isLoading && error && (
                    <div className="m-5 p-4 border border-red-800 bg-red-950/30 text-red-400 font-mono text-sm">
                        {error}
                    </div>
                )}

                {!isLoading && !error && !data && (
                    <div className="flex items-center justify-center h-64 opacity-30">
                        <span className="text-sm font-mono text-gray-500 uppercase tracking-widest">
                            Press ↻ LOAD to render the track map
                        </span>
                    </div>
                )}

                {!isLoading && !error && data && (
                    <TrackMapSVG data={data} colorMap={colorMap} />
                )}
            </div>
        </div>
    );
}