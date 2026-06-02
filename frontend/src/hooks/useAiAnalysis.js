// Hook genérico para solicitar análisis con IA al backend.
// Gestiona el ciclo de vida de la petición: loading, respuesta y error.
// Reutilizable por cualquier vista que integre el botón de análisis.

import { useState, useCallback } from 'react';
import { API_BASE } from '../config/api';

/**
 * @param {string} endpoint — Ruta relativa del endpoint (ej: '/ai/summary-analysis')
 * @returns {{ analyse, analysis, isLoading, error, reset }}
 */
export function useAiAnalysis(endpoint) {
    const [analysis, setAnalysis] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const analyse = useCallback(async (payload) => {
        setIsLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setAnalysis(data.analysis);
        } catch (err) {
            setError(err.message ?? 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    }, [endpoint]);

    // Permite cerrar/limpiar el panel manualmente.
    const reset = useCallback(() => {
        setAnalysis(null);
        setError(null);
    }, []);

    return { analyse, analysis, isLoading, error, reset };
}