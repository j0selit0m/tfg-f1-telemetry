/**
 * Tests del componente SidebarFilter.
 *
 * Verifica el comportamiento del panel de filtros lateral:
 * renderizado del branding, estado del botón Run Analysis
 * y emisión del payload de filtros al componente raíz.
 *
 * El hook useF1SessionData se mockea para controlar el estado
 * de los selectores sin realizar llamadas reales al backend.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SidebarFilter from '../features/sidebar/index'

// --- Mocks ---

vi.mock('../features/sidebar/useF1SessionData', () => ({
    useF1SessionData: vi.fn(),
}))

vi.mock('../features/sidebar/DriverGrid', () => ({
    default: () => <div data-testid="driver-grid" />,
}))

vi.mock('../features/sidebar/DriverCard', () => ({
    default: () => <div data-testid="driver-card" />,
}))

vi.mock('../features/sidebar/FilterSelect', () => ({
    default: ({ label, children }) => (
        <div>
            <label>{label}</label>
            <select>{children}</select>
        </div>
    ),
}))

import { useF1SessionData } from '../features/sidebar/useF1SessionData'

// --- Estado base del hook mockeado ---

const mockHookBase = {
    events: [],
    sessions: [],
    drivers: [],
    selectedYear: '',
    setSelectedYear: vi.fn(),
    selectedEvent: '',
    setSelectedEvent: vi.fn(),
    selectedSession: '',
    setSelectedSession: vi.fn(),
    selectedDrivers: [],
    toggleDriver: vi.fn(),
    buildFilterPayload: vi.fn(() => ({
        year: '2023',
        round: 'Bahrain Grand Prix',
        session: 'Race',
        driver: 'HAM',
    })),
    isReady: false,
    loading: { events: false, sessions: false, drivers: false },
}

// --- Tests ---

describe('SidebarFilter', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        useF1SessionData.mockReturnValue(mockHookBase)
    })

    it('renderiza el branding PitWall', () => {
        render(<SidebarFilter onFilterReady={vi.fn()} />)
        expect(screen.getByText('Pit')).toBeInTheDocument()
        expect(screen.getByText('Wall')).toBeInTheDocument()
    })

    it('renderiza los tres selectores de filtro', () => {
        render(<SidebarFilter onFilterReady={vi.fn()} />)
        expect(screen.getByText('Season')).toBeInTheDocument()
        expect(screen.getByText('Grand Prix')).toBeInTheDocument()
        expect(screen.getByText('Session')).toBeInTheDocument()
    })

    it('el botón Run Analysis está deshabilitado cuando isReady es false', () => {
        useF1SessionData.mockReturnValue({ ...mockHookBase, isReady: false })
        render(<SidebarFilter onFilterReady={vi.fn()} />)
        expect(screen.getByText('Run Analysis')).toBeDisabled()
    })

    it('el botón Run Analysis está habilitado cuando isReady es true', () => {
        useF1SessionData.mockReturnValue({ ...mockHookBase, isReady: true })
        render(<SidebarFilter onFilterReady={vi.fn()} />)
        expect(screen.getByText('Run Analysis')).not.toBeDisabled()
    })

    it('llama a onFilterReady con el payload al pulsar Run Analysis', () => {
        const mockOnFilterReady = vi.fn()
        useF1SessionData.mockReturnValue({ ...mockHookBase, isReady: true })
        render(<SidebarFilter onFilterReady={mockOnFilterReady} />)
        fireEvent.click(screen.getByText('Run Analysis'))
        expect(mockOnFilterReady).toHaveBeenCalledOnce()
        expect(mockOnFilterReady).toHaveBeenCalledWith(expect.objectContaining({
            year: '2023',
            round: 'Bahrain Grand Prix',
        }))
    })

    it('no muestra la lista de pilotos seleccionados cuando no hay ninguno', () => {
        useF1SessionData.mockReturnValue({ ...mockHookBase, selectedDrivers: [] })
        render(<SidebarFilter onFilterReady={vi.fn()} />)
        expect(screen.queryByText('Selected Drivers')).not.toBeInTheDocument()
    })
})