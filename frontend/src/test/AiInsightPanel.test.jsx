/**
 * Tests del componente AiInsightPanel.
 *
 * Verifica el comportamiento del panel de análisis con IA compartido
 * por las tres pestañas principales: Session Summary, Stint Analysis
 * y Lap Data. Cubre los diferentes estados del componente.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AiInsightPanel from '../components/AiInsightPanel'

// --- Helpers ---

const defaultProps = {
    show: true,
    onAnalyse: vi.fn(),
    analysis: null,
    isLoading: false,
    error: null,
}

// ---------------------------------------------------------------------------
// Visibilidad
// ---------------------------------------------------------------------------

describe('AiInsightPanel — visibilidad', () => {

    it('no renderiza nada cuando show es false', () => {
        const { container } = render(<AiInsightPanel {...defaultProps} show={false} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renderiza la barra cuando show es true', () => {
        render(<AiInsightPanel {...defaultProps} />)
        expect(screen.getByText('AI Analysis')).toBeInTheDocument()
    })

    it('muestra el texto explicativo para usuarios no expertos', () => {
        render(<AiInsightPanel {...defaultProps} />)
        expect(screen.getByText(/plain English/i)).toBeInTheDocument()
    })
})

// ---------------------------------------------------------------------------
// Botón Explain this
// ---------------------------------------------------------------------------

describe('AiInsightPanel — botón', () => {

    it('muestra el botón Explain this cuando no hay análisis', () => {
        render(<AiInsightPanel {...defaultProps} analysis={null} />)
        expect(screen.getByText(/Explain this/i)).toBeInTheDocument()
    })

    it('el botón sigue visible cuando ya hay análisis', () => {
        render(<AiInsightPanel {...defaultProps} analysis="Some analysis text." />)
        expect(screen.getByText(/Explain this/i)).toBeInTheDocument()
    })

    it('llama a onAnalyse al pulsar el botón', () => {
        const mockAnalyse = vi.fn()
        render(<AiInsightPanel {...defaultProps} onAnalyse={mockAnalyse} />)
        fireEvent.click(screen.getByText(/Explain this/i))
        expect(mockAnalyse).toHaveBeenCalledOnce()
    })

    it('muestra el spinner y deshabilita el botón durante la carga', () => {
        render(<AiInsightPanel {...defaultProps} isLoading={true} />)
        expect(screen.getByText(/Analyzing/i)).toBeInTheDocument()
        expect(screen.getByText(/Analyzing/i).closest('button')).toBeDisabled()
    })
})

// ---------------------------------------------------------------------------
// Panel de resultado
// ---------------------------------------------------------------------------

describe('AiInsightPanel — panel de resultado', () => {

    it('no muestra el panel cuando no hay análisis ni error', () => {
        render(<AiInsightPanel {...defaultProps} analysis={null} error={null} />)
        expect(screen.queryByText('AI Insight')).not.toBeInTheDocument()
    })

    it('muestra el análisis cuando llega el texto de Gemini', () => {
        render(<AiInsightPanel {...defaultProps} analysis="Hamilton showed strong pace." />)
        expect(screen.getByText('Hamilton showed strong pace.')).toBeInTheDocument()
    })

    it('muestra el error en rojo cuando Gemini falla', () => {
        render(<AiInsightPanel {...defaultProps} error="AI analysis limit reached." />)
        expect(screen.getByText('AI analysis limit reached.')).toBeInTheDocument()
    })

    it('muestra el disclaimer de contenido generado por IA', () => {
        render(<AiInsightPanel {...defaultProps} analysis="Some analysis." />)
        expect(screen.getByText(/AI-generated content/i)).toBeInTheDocument()
    })
})

// ---------------------------------------------------------------------------
// Collapse / Expand
// ---------------------------------------------------------------------------

describe('AiInsightPanel — collapse y expand', () => {

    it('el panel aparece expandido por defecto cuando llega análisis', () => {
        render(<AiInsightPanel {...defaultProps} analysis="Some analysis text." />)
        expect(screen.getByText('Some analysis text.')).toBeVisible()
    })

    it('colapsa el panel al pulsar la cabecera AI Insight', () => {
        render(<AiInsightPanel {...defaultProps} analysis="Some analysis text." />)
        fireEvent.click(screen.getByText('AI Insight'))
        expect(screen.queryByText('Some analysis text.')).not.toBeInTheDocument()
    })

    it('expande el panel al pulsar de nuevo la cabecera', () => {
        render(<AiInsightPanel {...defaultProps} analysis="Some analysis text." />)
        fireEvent.click(screen.getByText('AI Insight'))
        fireEvent.click(screen.getByText('AI Insight'))
        expect(screen.getByText('Some analysis text.')).toBeInTheDocument()
    })
})