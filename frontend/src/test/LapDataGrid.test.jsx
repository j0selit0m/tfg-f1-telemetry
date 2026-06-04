/**
 * Tests del componente LapDataGrid.
 *
 * Verifica el comportamiento del orquestador de la vista de vueltas
 * en sus diferentes estados: espera, carga, error y datos disponibles.
 * También cubre el comportamiento de la leyenda colapsable.
 *
 * Los hooks de datos y de IA se mockean para aislar el componente
 * de las llamadas reales al backend.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import LapDataGrid from '../features/lapData/index'

// --- Mocks ---

vi.mock('../features/lapData/useLapData', () => ({
    useLapData: vi.fn(),
}))

vi.mock('../hooks/useAiAnalysis', () => ({
    useAiAnalysis: vi.fn(),
}))

vi.mock('../features/lapData/LapRow', () => ({
    default: ({ row }) => (
        <tr data-testid="lap-row">
            <td>{row.lapNumber}</td>
        </tr>
    ),
}))

vi.mock('../components/AiInsightPanel', () => ({
    default: ({ show }) => show ? <div data-testid="ai-panel">AI Panel</div> : null,
}))

import { useLapData } from '../features/lapData/useLapData'
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
    compounds: {},
}

const mockLapData = {
    drivers: ['HAM'],
    laps: [
        { lapNumber: 1, entries: { HAM: { lapTime: '1:33.456', compound: 'SOFT' } } },
        { lapNumber: 2, entries: { HAM: { lapTime: '1:34.000', compound: 'SOFT' } } },
    ],
}

// --- Tests ---

describe('LapDataGrid', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        useAiAnalysis.mockReturnValue(mockAi)
    })

    it('muestra el estado de espera cuando no hay filtros', () => {
        useLapData.mockReturnValue({
            data: null, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<LapDataGrid filters={null} />)

        expect(screen.getByText('Lap Data Standby')).toBeInTheDocument()
    })

    it('renderiza una fila por vuelta cuando hay datos', () => {
        useLapData.mockReturnValue({
            data: mockLapData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<LapDataGrid filters={mockFilters} />)

        expect(screen.getAllByTestId('lap-row')).toHaveLength(2)
    })

    it('muestra el banner de error cuando hay un error', () => {
        useLapData.mockReturnValue({
            data: null, isLoading: false, error: 'Session not found', refetch: vi.fn(),
        })

        render(<LapDataGrid filters={mockFilters} />)

        expect(screen.getByText('Session not found')).toBeInTheDocument()
        expect(screen.getByText('RETRY')).toBeInTheDocument()
    })

    it('muestra el panel de IA cuando hay datos cargados', () => {
        useLapData.mockReturnValue({
            data: mockLapData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<LapDataGrid filters={mockFilters} />)

        expect(screen.getByTestId('ai-panel')).toBeInTheDocument()
    })

    it('no muestra el panel de IA cuando está cargando', () => {
        useLapData.mockReturnValue({
            data: null, isLoading: true, error: null, refetch: vi.fn(),
        })

        render(<LapDataGrid filters={mockFilters} />)

        expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument()
    })

    it('la leyenda aparece expandida por defecto', () => {
        useLapData.mockReturnValue({
            data: mockLapData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<LapDataGrid filters={mockFilters} />)

        expect(screen.getByText('Tire Compounds')).toBeInTheDocument()
        expect(screen.getByText('Track Status')).toBeInTheDocument()
    })

    it('la leyenda se colapsa al pulsar el botón Data Display Legend', () => {
        useLapData.mockReturnValue({
            data: mockLapData, isLoading: false, error: null, refetch: vi.fn(),
        })

        render(<LapDataGrid filters={mockFilters} />)

        fireEvent.click(screen.getByText('Data Display Legend'))

        expect(screen.queryByText('Tire Compounds')).not.toBeInTheDocument()
    })
})