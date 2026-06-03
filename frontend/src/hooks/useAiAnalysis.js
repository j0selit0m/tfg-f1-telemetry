// Hook genérico para solicitar análisis con IA al backend.
// Gestiona el ciclo de vida de la petición: loading, respuesta y error.
// Cancela automáticamente la petición en vuelo si se llama a reset()
// o si se lanza una nueva petición antes de que termine la anterior.

import { useState, useCallback, useRef } from 'react';
import { API_BASE } from '../config/api';

/**
 * @param {string} endpoint - Ruta relativa del endpoint (ej: '/ai/summary-analysis')
 * @returns {{ analyse, analysis, isLoading, error, reset }}
 */
export function useAiAnalysis(endpoint) {
    const [analysis, setAnalysis] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Referencia al AbortController activo - permite cancelar la petición en vuelo.
    const abortRef = useRef(null);

    const analyse = useCallback(async (payload) => {
        // Cancela cualquier petición anterior que siga en curso.
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setIsLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortRef.current.signal,
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setAnalysis(data.analysis);
        } catch (err) {
            // Las cancelaciones no son errores - se ignoran silenciosamente.
            if (err.name === 'AbortError') return;
            setError(err.message ?? 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    }, [endpoint]);

    // Cancela la petición en vuelo y limpia el estado.
    const reset = useCallback(() => {
        abortRef.current?.abort();
        setAnalysis(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return { analyse, analysis, isLoading, error, reset };
}