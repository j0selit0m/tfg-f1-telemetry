/**
 * Tests del componente SummaryStatistics.
 *
 * Verifica el comportamiento del orquestador de la vista de resumen
 * en sus diferentes estados: espera, carga, error y datos disponibles.
 *
 * Los hooks de datos y de IA se mockean para aislar el componente
 * de las llamadas reales al backend.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SummaryStatistics from '../features/summary/index'

// --- Mocks ---

vi.mock('../features/summary/useSessionSummary', () => ({
    useSessionSummary: vi.fn(),
}))
vi.mock('../hooks/useAiAnalysis', () => ({
    useAiAnalysis: vi.fn(),
}))
vi.mock('../features/summary/DriverCard', () => ({
    default: ({ driver }) => <div data-testid="driver-card">{driver.driverCode}</div>,
}))
vi.mock('../components/AiInsightPanel', () => ({
    default: ({ show }) => show ? <div data-testid="ai-panel">AI Panel</div> : null,
}))

import { useSessionSummary } from '../features/summary/useSessionSummary'
import { useAiAnalysis } from '../hooks/useAiAnalysis'

// --- Datos de prueba ---

const mockAi = {
    analysis: null,
    isLoading: false,
    error: null,
    reset: vi.fn(),
    analyse: vi.fn(),
}

const mockDriverData = {
    driverCode: 'HAM',
    bestLap: { time: '1:33.456', lapNumber: 5 },
    average: '1:35.000',
    median: '1:34.500',
    stdDev: '0.500',
    consistency: 98.5,
    validLaps: 20,
    strategy: [{ label: 'S', color: '#da291c', compound: 'SOFT' }],
}

const mockData = {
    drivers: [mockDriverData],
    fastestDriver: { driverCode: 'HAM' },
}

// --- Tests ---

describe('SummaryStatistics', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        useAiAnalysis.mockReturnValue(mockAi)
    })

    it('muestra el estado de espera cuando no hay filtros', () => {
        useSessionSummary.mockReturnValue({
            data: null, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<SummaryStatistics filters={null} />)

        expect(screen.getByText('Summary Standby')).toBeInTheDocument()
    })

    it('renderiza una tarjeta por piloto cuando hay datos', () => {
        useSessionSummary.mockReturnValue({
            data: mockData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<SummaryStatistics filters={{ year: 2023, round: 'Bahrain Grand Prix', session: 'Race', driver: 'HAM', driverColors: {}, driverNames: {} }} />)

        expect(screen.getAllByTestId('driver-card')).toHaveLength(1)
    })

    it('muestra el banner de error cuando hay un error', () => {
        useSessionSummary.mockReturnValue({
            data: null, isLoading: false, error: 'Session not found', refetch: vi.fn(),
        })

        render(<SummaryStatistics filters={{ year: 2023, round: 'Bahrain Grand Prix', session: 'Race', driver: 'HAM', driverColors: {}, driverNames: {} }} />)

        expect(screen.getByText('Session not found')).toBeInTheDocument()
        expect(screen.getByText('RETRY')).toBeInTheDocument()
    })

    it('muestra el panel de IA cuando hay datos cargados', () => {
        useSessionSummary.mockReturnValue({
            data: mockData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<SummaryStatistics filters={{ year: 2023, round: 'Bahrain Grand Prix', session: 'Race', driver: 'HAM', driverColors: {}, driverNames: {} }} />)

        expect(screen.getByTestId('ai-panel')).toBeInTheDocument()
    })

    it('no muestra el panel de IA cuando está cargando', () => {
        useSessionSummary.mockReturnValue({
            data: null, isLoading: true, error: null, refetch: vi.fn(),
        })

        render(<SummaryStatistics filters={{ year: 2023, round: 'Bahrain Grand Prix', session: 'Race', driver: 'HAM', driverColors: {}, driverNames: {} }} />)

        expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument()
    })

    it('el botón RETRY llama a refetch cuando hay error', () => {
        const mockRefetch = vi.fn()
        useSessionSummary.mockReturnValue({
            data: null, isLoading: false, error: 'Error', refetch: mockRefetch,
        })

        render(<SummaryStatistics filters={{ year: 2023, round: 'Bahrain Grand Prix', session: 'Race', driver: 'HAM', driverColors: {}, driverNames: {} }} />)

        fireEvent.click(screen.getByText('RETRY'))
        expect(mockRefetch).toHaveBeenCalledOnce()
    })
})