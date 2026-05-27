// Hook que gestiona el ciclo de vida de la petición del mapa de circuito.
// Cancela automáticamente la petición anterior al cambiar filtros o driverParam.

import { useState, useEffect } from 'react';
import { fetchTrackMap } from './service';

export function useTrackMap(filters, driverParam, nSectors) {
    const [data, setData] = useState(null);
    const [isLoading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!filters?.year || !filters?.round || !driverParam) {
            setData(null);
            return;
        }

        const ctrl = new AbortController();
        setLoading(true);
        setError(null);

        fetchTrackMap(
            { year: filters.year, round: filters.round, driverParam, nSectors },
            ctrl.signal,
        )
            .then(setData)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message ?? 'Error'); })
            .finally(() => setLoading(false));

        return () => ctrl.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, driverParam, nSectors]);

    return { data, isLoading, error };
}