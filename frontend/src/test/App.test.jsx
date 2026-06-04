/**
 * Tests del componente raíz App.
 *
 * Verifica la navegación entre pestañas, el lazy mounting,
 * el Header con contexto de sesión y la integración con el sidebar.
 *
 * Todos los componentes hijos se mockean para aislar la lógica
 * de orquestación de App.jsx sin depender de implementaciones internas.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import App from '../App'

// --- Mocks de todos los componentes hijos ---

vi.mock('../features/sidebar/index', () => ({
    default: ({ onFilterReady }) => (
        <div data-testid="sidebar">
            <button onClick={() => onFilterReady({
                year: '2023',
                round: 'Bahrain Grand Prix',
                session: 'Race',
                driver: 'HAM',
                driverColors: {},
                driverNames: {},
                compounds: {},
            })}>
                Run Analysis
            </button>
        </div>
    ),
}))

vi.mock('../features/lapData/index', () => ({
    default: () => <div data-testid="lap-data-view">Lap Data</div>,
}))

vi.mock('../features/summary/index', () => ({
    default: () => <div data-testid="summary-view">Session Summary</div>,
}))

vi.mock('../features/stints/index', () => ({
    default: () => <div data-testid="stints-view">Stint Analysis</div>,
}))

vi.mock('../features/telemetry/index', () => ({
    default: () => <div data-testid="telemetry-view">Telemetry</div>,
}))

vi.mock('../features/trackMap/index', () => ({
    default: () => <div data-testid="track-map-view">Track Map</div>,
}))

// --- Tests ---

describe('App', () => {

    it('renderiza el sidebar y la navegación de pestañas', () => {
        render(<App />)
        expect(screen.getByTestId('sidebar')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Lap Data/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Session Summary/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Stint Analysis/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Telemetry/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Track Map/i })).toBeInTheDocument()
    })

    it('cambia a Session Summary al pulsar su pestaña', () => {
        render(<App />)
        fireEvent.click(screen.getByRole('button', { name: /Session Summary/i }))
        expect(screen.getByTestId('summary-view')).toBeVisible()
    })

    it('muestra Lap Data como pestaña activa por defecto', () => {
        render(<App />)
        expect(screen.getByTestId('lap-data-view')).toBeInTheDocument()
    })

    it('cambia a Session Summary al pulsar su pestaña', () => {
        render(<App />)
        fireEvent.click(screen.getByRole('button', { name: /Session Summary/i }))
        expect(screen.getByTestId('summary-view')).toBeVisible()
    })

    it('el Header muestra el mensaje por defecto sin filtros activos', () => {
        render(<App />)
        expect(screen.getByText('Formula 1 Data Analysis')).toBeInTheDocument()
    })

    it('el Header muestra el GP y sesión cuando hay filtros activos', () => {
        render(<App />)
        fireEvent.click(screen.getByText('Run Analysis'))
        expect(screen.getByText('Bahrain Grand Prix')).toBeInTheDocument()
        expect(screen.getByText('Race')).toBeInTheDocument()
    })

    it('todas las pestañas se montan al arrancar', () => {
        render(<App />)
        expect(screen.getByTestId('lap-data-view')).toBeInTheDocument()
        expect(screen.getByTestId('summary-view')).toBeInTheDocument()
        expect(screen.getByTestId('stints-view')).toBeInTheDocument()
    })
})