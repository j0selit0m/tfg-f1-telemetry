/**
 * Tests del componente LapSelector.
 *
 * Verifica el comportamiento del selector de vueltas compartido
 * por las vistas de Telemetría y Track Map: añadir y eliminar filas,
 * actualizar parámetros de piloto/sesión/vuelta y disparar la carga.
 *
 * Es un componente controlado puro — no requiere mocks externos.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import LapSelector from '../components/LapSelector'

// --- Datos de prueba ---

const defaultProps = {
    rows: [{ driver: 'HAM', session: 'Race', lap: '' }],
    setRows: vi.fn(),
    availableDrivers: ['HAM', 'VER', 'NOR'],
    availableSessions: ['Race', 'Qualifying', 'FP1'],
    onLoad: vi.fn(),
    isLoading: false,
}

// --- Tests ---

describe('LapSelector', () => {

    it('renderiza una fila por cada entrada en rows', () => {
        const props = {
            ...defaultProps,
            rows: [
                { driver: 'HAM', session: 'Race', lap: '' },
                { driver: 'VER', session: 'Race', lap: '5' },
            ],
        }
        render(<LapSelector {...props} />)
        const selects = screen.getAllByRole('combobox')
        // 2 filas × 2 selects (driver + session) = 4 selects
        expect(selects).toHaveLength(4)
    })

    it('muestra el placeholder "Fastest" en el input de vuelta vacío', () => {
        render(<LapSelector {...defaultProps} />)
        expect(screen.getByPlaceholderText('Fastest')).toBeInTheDocument()
    })

    it('el botón LOAD llama a onLoad al ser pulsado', () => {
        const mockOnLoad = vi.fn()
        render(<LapSelector {...defaultProps} onLoad={mockOnLoad} />)
        fireEvent.click(screen.getByText('↻ LOAD'))
        expect(mockOnLoad).toHaveBeenCalledOnce()
    })

    it('el botón LOAD está deshabilitado durante la carga', () => {
        render(<LapSelector {...defaultProps} isLoading={true} />)
        expect(screen.getByText('···').closest('button')).toBeDisabled()
    })

    it('el botón eliminar fila está deshabilitado cuando solo hay una fila', () => {
        render(<LapSelector {...defaultProps} />)
        expect(screen.getByText('✕').closest('button')).toBeDisabled()
    })

    it('el botón eliminar fila está habilitado cuando hay más de una fila', () => {
        const props = {
            ...defaultProps,
            rows: [
                { driver: 'HAM', session: 'Race', lap: '' },
                { driver: 'VER', session: 'Race', lap: '' },
            ],
        }
        render(<LapSelector {...props} />)
        const removeButtons = screen.getAllByText('✕')
        removeButtons.forEach(btn => {
            expect(btn.closest('button')).not.toBeDisabled()
        })
    })

    it('el botón + ADD llama a setRows con una nueva fila', () => {
        const mockSetRows = vi.fn()
        render(<LapSelector {...defaultProps} setRows={mockSetRows} />)
        fireEvent.click(screen.getByText('+ ADD'))
        expect(mockSetRows).toHaveBeenCalledOnce()
    })

    it('cambiar el driver llama a setRows con el nuevo valor', () => {
        const mockSetRows = vi.fn()
        render(<LapSelector {...defaultProps} setRows={mockSetRows} />)
        const driverSelect = screen.getAllByRole('combobox')[0]
        fireEvent.change(driverSelect, { target: { value: 'VER' } })
        expect(mockSetRows).toHaveBeenCalledOnce()
    })

    it('cambiar la sesión llama a setRows con el nuevo valor', () => {
        const mockSetRows = vi.fn()
        render(<LapSelector {...defaultProps} setRows={mockSetRows} />)
        const sessionSelect = screen.getAllByRole('combobox')[1]
        fireEvent.change(sessionSelect, { target: { value: 'Qualifying' } })
        expect(mockSetRows).toHaveBeenCalledOnce()
    })

    it('cambiar el número de vuelta llama a setRows con el nuevo valor', () => {
        const mockSetRows = vi.fn()
        render(<LapSelector {...defaultProps} setRows={mockSetRows} />)
        const lapInput = screen.getByPlaceholderText('Fastest')
        fireEvent.change(lapInput, { target: { value: '44' } })
        expect(mockSetRows).toHaveBeenCalledOnce()
    })
})