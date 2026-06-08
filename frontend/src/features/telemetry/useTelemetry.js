// Hook que gestiona el ciclo de vida de la petición de telemetría.
// Cancela automáticamente la petición anterior al cambiar filtros o driverParam.

import { useState, useEffect } from 'react';
import { fetchTelemetry } from './service';

export function useTelemetry(filters, driverParam) {
    const [data, setData] = useState(null);
    const [isLoading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!filters?.year || !filters?.round || !driverParam) {
            setData(null);
            return;
        }
        const ctrl = new AbortController();
        setData(null);
        setLoading(true);
        setError(null);
        fetchTelemetry(
            { year: filters.year, round: filters.round, driverParam },
            ctrl.signal
        )
            .then(setData)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message ?? 'Error'); })
            .finally(() => {
                if (!ctrl.signal.aborted) {
                    setLoading(false);
                }
            });
        return () => ctrl.abort();
    }, [filters?.year, filters?.round, driverParam]);

    return { data, isLoading, error };
}