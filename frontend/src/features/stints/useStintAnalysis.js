// Hook que gestiona el ciclo de vida de la petición de stints.
// Expone refetch para reintentos manuales desde el banner de error.

import { useState, useEffect, useCallback } from 'react';
import { fetchStints } from './service';

export function useStintAnalysis(filters) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!filters?.year || !filters?.round || !filters?.session || !filters?.driver) {
            setData(null);
            return;
        }
        const ctrl = new AbortController();
        setIsLoading(true);
        setError(null);
        fetchStints(filters, ctrl.signal)
            .then(setData)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message ?? 'Unknown error'); })
            .finally(() => setIsLoading(false));
        return () => ctrl.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters?.year, filters?.round, filters?.session, filters?.driver, tick]);

    return { data, isLoading, error, refetch };
}