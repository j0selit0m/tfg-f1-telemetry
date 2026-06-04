/**
 * Tests del componente StintAnalysis.
 *
 * Verifica el comportamiento del orquestador de la vista de stints
 * en sus diferentes estados: espera, carga, error y datos disponibles.
 *
 * Los hooks de datos y de IA se mockean para aislar el componente
 * de las llamadas reales al backend.
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import StintAnalysis from '../features/stints/index'

// --- Mocks ---

vi.mock('../features/stints/useStintAnalysis', () => ({
    useStintAnalysis: vi.fn(),
}))

vi.mock('../hooks/useAiAnalysis', () => ({
    useAiAnalysis: vi.fn(),
}))

vi.mock('../features/stints/StintCell', () => ({
    default: ({ driverData }) => (
        <td data-testid="stint-cell">{driverData?.compoundLabel ?? 'null'}</td>
    ),
}))

vi.mock('../components/AiInsightPanel', () => ({
    default: ({ show }) => show ? <div data-testid="ai-panel">AI Panel</div> : null,
}))

import { useStintAnalysis } from '../features/stints/useStintAnalysis'
import { useAiAnalysis } from '../hooks/useAiAnalysis'

// --- Datos de prueba ---

const mockAi = {
    analysis: null,
    isLoading: false,
    error: null,
    reset: vi.fn(),
    analyse: vi.fn(),
}

const mockFilters = {
    year: 2023,
    round: 'Bahrain Grand Prix',
    session: 'Race',
    driver: 'HAM',
    driverColors: { HAM: '#00D2BE' },
    driverNames: { HAM: 'Lewis Hamilton' },
}

const mockStintData = {
    drivers: ['HAM'],
    stints: [
        {
            stintNumber: 1,
            drivers: {
                HAM: {
                    compound: 'SOFT',
                    compoundLabel: 'S',
                    compoundColor: '#da291c',
                    durationLaps: 20,
                    bestLap: { time: '1:33.456', lapInStint: 3 },
                    average: '1:35.000',
                    consistency: 98.5,
                },
            },
        },
    ],
}

// --- Tests ---

describe('StintAnalysis', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        useAiAnalysis.mockReturnValue(mockAi)
    })

    it('muestra el estado de espera cuando no hay filtros', () => {
        useStintAnalysis.mockReturnValue({
            data: null, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<StintAnalysis filters={null} />)

        expect(screen.getByText('Stint Analysis Standby')).toBeInTheDocument()
    })

    it('renderiza la tabla con stints cuando hay datos', () => {
        useStintAnalysis.mockReturnValue({
            data: mockStintData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<StintAnalysis filters={mockFilters} />)

        expect(screen.getByText('STINT1')).toBeInTheDocument()
        expect(screen.getAllByTestId('stint-cell')).toHaveLength(1)
    })

    it('muestra el banner de error cuando hay un error', () => {
        useStintAnalysis.mockReturnValue({
            data: null, isLoading: false, error: 'Session not found', refetch: vi.fn(),
        })

        render(<StintAnalysis filters={mockFilters} />)

        expect(screen.getByText('Session not found')).toBeInTheDocument()
        expect(screen.getByText('RETRY')).toBeInTheDocument()
    })

    it('muestra el panel de IA cuando hay datos cargados', () => {
        useStintAnalysis.mockReturnValue({
            data: mockStintData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<StintAnalysis filters={mockFilters} />)

        expect(screen.getByTestId('ai-panel')).toBeInTheDocument()
    })

    it('no muestra el panel de IA cuando está cargando', () => {
        useStintAnalysis.mockReturnValue({
            data: null, isLoading: true, error: null, refetch: vi.fn(),
        })

        render(<StintAnalysis filters={mockFilters} />)

        expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument()
    })

    it('muestra mensaje cuando no hay stints disponibles', () => {
        useStintAnalysis.mockReturnValue({
            data: { drivers: ['HAM'], stints: [] },
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        })

        render(<StintAnalysis filters={mockFilters} />)

        expect(screen.getByText('No stint data available')).toBeInTheDocument()
    })
})