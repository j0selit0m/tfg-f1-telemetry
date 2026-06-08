/**
 * Tests unitarios de los DTOs del dominio de resumen de sesión.
 *
 * Verifica que la transformación snake_case -> camelCase es correcta
 * y que los valores por defecto se aplican cuando faltan campos.
 * No requiere React ni mocks — son clases JavaScript puras.
 */

import { describe, it, expect } from 'vitest'
import { CompoundDTO, BestLapDTO, DriverSummaryDTO, SessionSummaryDTO } from '../features/summary/dtos'

// ---------------------------------------------------------------------------
// CompoundDTO
// ---------------------------------------------------------------------------

describe('CompoundDTO', () => {

    it('transforma correctamente los campos del backend', () => {
        const dto = new CompoundDTO({ compound: 'SOFT', color: '#da291c', label: 'S' })
        expect(dto.compound).toBe('SOFT')
        expect(dto.color).toBe('#da291c')
        expect(dto.label).toBe('S')
    })

    it('aplica valores por defecto cuando los campos están ausentes', () => {
        const dto = new CompoundDTO({})
        expect(dto.compound).toBe('UNKNOWN')
        expect(dto.color).toBe('#FFFFFF')
        expect(dto.label).toBe('?')
    })
})


// ---------------------------------------------------------------------------
// BestLapDTO
// ---------------------------------------------------------------------------

describe('BestLapDTO', () => {

    it('transforma correctamente lap_number a lapNumber', () => {
        const dto = new BestLapDTO({ time: '1:33.456', lap_number: 5 })
        expect(dto.time).toBe('1:33.456')
        expect(dto.lapNumber).toBe(5)
    })

    it('aplica el tiempo por defecto cuando falta el campo time', () => {
        const dto = new BestLapDTO({})
        expect(dto.time).toBe('--:--.---')
        expect(dto.lapNumber).toBeNull()
    })
})


// ---------------------------------------------------------------------------
// DriverSummaryDTO
// ---------------------------------------------------------------------------

describe('DriverSummaryDTO', () => {

    const rawDriver = {
        best_lap: { time: '1:33.456', lap_number: 5 },
        average: '1:35.000',
        median: '1:34.500',
        std_dev: '0.500',
        consistency: 98.5,
        valid_laps: 20,
        strategy: [{ compound: 'SOFT', color: '#da291c', label: 'S' }],
    }

    it('transforma correctamente todos los campos snake_case a camelCase', () => {
        const dto = new DriverSummaryDTO('HAM', rawDriver)
        expect(dto.driverCode).toBe('HAM')
        expect(dto.average).toBe('1:35.000')
        expect(dto.median).toBe('1:34.500')
        expect(dto.stdDev).toBe('0.500')
        expect(dto.consistency).toBe(98.5)
        expect(dto.validLaps).toBe(20)
    })

    it('construye el bestLap como BestLapDTO', () => {
        const dto = new DriverSummaryDTO('HAM', rawDriver)
        expect(dto.bestLap.time).toBe('1:33.456')
        expect(dto.bestLap.lapNumber).toBe(5)
    })

    it('construye la strategy como array de CompoundDTO', () => {
        const dto = new DriverSummaryDTO('HAM', rawDriver)
        expect(dto.strategy).toHaveLength(1)
        expect(dto.strategy[0].label).toBe('S')
    })

    it('consistencyLabel devuelve Excellent para consistencia >= 90', () => {
        const dto = new DriverSummaryDTO('HAM', { ...rawDriver, consistency: 95 })
        expect(dto.consistencyLabel).toBe('Excellent')
    })

    it('consistencyLabel devuelve Good para consistencia entre 75 y 89', () => {
        const dto = new DriverSummaryDTO('HAM', { ...rawDriver, consistency: 80 })
        expect(dto.consistencyLabel).toBe('Good')
    })

    it('consistencyLabel devuelve Average para consistencia entre 60 y 74', () => {
        const dto = new DriverSummaryDTO('HAM', { ...rawDriver, consistency: 65 })
        expect(dto.consistencyLabel).toBe('Average')
    })

    it('consistencyLabel devuelve Poor para consistencia menor de 60', () => {
        const dto = new DriverSummaryDTO('HAM', { ...rawDriver, consistency: 50 })
        expect(dto.consistencyLabel).toBe('Poor')
    })

    it('aplica 0 como consistencia cuando el valor no es numérico', () => {
        const dto = new DriverSummaryDTO('HAM', { ...rawDriver, consistency: 'invalid' })
        expect(dto.consistency).toBe(0)
    })
})


// ---------------------------------------------------------------------------
// SessionSummaryDTO
// ---------------------------------------------------------------------------

describe('SessionSummaryDTO', () => {

    const rawResponse = {
        drivers: ['HAM', 'RUS'],
        summaries: {
            HAM: {
                best_lap: { time: '1:33.456', lap_number: 5 },
                average: '1:35.000',
                median: '1:34.500',
                std_dev: '0.500',
                consistency: 98.5,
                valid_laps: 20,
                strategy: [],
            },
            RUS: {
                best_lap: { time: '1:34.000', lap_number: 3 },
                average: '1:36.000',
                median: '1:35.500',
                std_dev: '0.600',
                consistency: 95.0,
                valid_laps: 18,
                strategy: [],
            },
        },
    }

    it('construye un DriverSummaryDTO por cada piloto', () => {
        const dto = new SessionSummaryDTO(rawResponse)
        expect(dto.drivers).toHaveLength(2)
        expect(dto.drivers[0].driverCode).toBe('HAM')
        expect(dto.drivers[1].driverCode).toBe('RUS')
    })

    it('fastestDriver devuelve el piloto con mejor tiempo', () => {
        const dto = new SessionSummaryDTO(rawResponse)
        expect(dto.fastestDriver.driverCode).toBe('HAM')
    })

    it('filtra pilotos sin datos (null en summaries)', () => {
        const raw = {
            drivers: ['HAM', 'XXX'],
            summaries: { HAM: rawResponse.summaries.HAM, XXX: null },
        }
        const dto = new SessionSummaryDTO(raw)
        expect(dto.drivers).toHaveLength(1)
        expect(dto.drivers[0].driverCode).toBe('HAM')
    })

    it('fastestDriver devuelve null cuando no hay pilotos', () => {
        const dto = new SessionSummaryDTO({ drivers: [], summaries: {} })
        expect(dto.fastestDriver).toBeNull()
    })
})