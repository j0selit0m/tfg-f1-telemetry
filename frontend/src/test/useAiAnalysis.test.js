/**
 * Tests del hook useAiAnalysis.
 *
 * Verifica el ciclo de vida completo de una petición de análisis IA:
 * estado de carga, respuesta correcta, manejo de errores y reset.
 * El fetch global se mockea para evitar llamadas reales al backend.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAiAnalysis } from '../hooks/useAiAnalysis'

// ---------------------------------------------------------------------------
// Setup — mock global de fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

describe('useAiAnalysis — estado inicial', () => {

    it('inicia con analysis null, isLoading false y error null', () => {
        const { result } = renderHook(() => useAiAnalysis('/ai/summary-analysis'))

        expect(result.current.analysis).toBeNull()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Petición correcta
// ---------------------------------------------------------------------------

describe('useAiAnalysis — petición correcta', () => {

    it('el análisis queda en null antes de llamar a analyse', () => {
        const { result } = renderHook(() => useAiAnalysis('/ai/summary-analysis'))
        expect(result.current.analysis).toBeNull()
        expect(result.current.isLoading).toBe(false)
    })

    it('guarda el análisis en estado cuando la petición tiene éxito', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ analysis: 'Hamilton showed strong pace.' }),
        })

        const { result } = renderHook(() => useAiAnalysis('/ai/summary-analysis'))

        await act(async () => { await result.current.analyse({ year: 2023 }) })

        expect(result.current.analysis).toBe('Hamilton showed strong pace.')
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('desactiva isLoading tras recibir la respuesta', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ analysis: 'Analysis text.' }),
        })

        const { result } = renderHook(() => useAiAnalysis('/ai/summary-analysis'))

        await act(async () => { await result.current.analyse({ year: 2023 }) })

        expect(result.current.isLoading).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Manejo de errores
// ---------------------------------------------------------------------------

describe('useAiAnalysis — manejo de errores', () => {

    it('guarda el error cuando el backend devuelve un error HTTP', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ detail: 'AI analysis limit reached.' }),
        })

        const { result } = renderHook(() => useAiAnalysis('/ai/summary-analysis'))

        await act(async () => { await result.current.analyse({ year: 2023 }) })

        expect(result.current.error).toBe('AI analysis limit reached.')
        expect(result.current.analysis).toBeNull()
        expect(result.current.isLoading).toBe(false)
    })

    it('guarda el error cuando fetch lanza una excepción de red', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useAiAnalysis('/ai/summary-analysis'))

        await act(async () => { await result.current.analyse({ year: 2023 }) })

        expect(result.current.error).toBe('Network error')
        expect(result.current.isLoading).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('useAiAnalysis — reset', () => {

    it('limpia analysis, error e isLoading al llamar a reset', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ analysis: 'Some analysis.' }),
        })

        const { result } = renderHook(() => useAiAnalysis('/ai/summary-analysis'))

        await act(async () => { await result.current.analyse({ year: 2023 }) })
        expect(result.current.analysis).toBe('Some analysis.')

        act(() => { result.current.reset() })

        expect(result.current.analysis).toBeNull()
        expect(result.current.error).toBeNull()
        expect(result.current.isLoading).toBe(false)
    })
})