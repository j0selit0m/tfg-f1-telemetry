/**
 * Tests unitarios de los DTOs del dominio de análisis de stints.
 *
 * Verifica que la transformación snake_case → camelCase es correcta
 * y que los valores por defecto se aplican cuando faltan campos.
 * No requiere React ni mocks — son clases JavaScript puras.
 */

import { describe, it, expect } from 'vitest'
import { StintBestLapDTO, StintDriverDataDTO, StintDTO, StintsResponseDTO } from '../features/stints/dtos'


// ---------------------------------------------------------------------------
// StintBestLapDTO
// ---------------------------------------------------------------------------

describe('StintBestLapDTO', () => {

    it('transforma correctamente lap_in_stint a lapInStint', () => {
        const dto = new StintBestLapDTO({ time: '1:33.456', lap_in_stint: 3 })
        expect(dto.time).toBe('1:33.456')
        expect(dto.lapInStint).toBe(3)
    })

    it('aplica valores por defecto cuando los campos están ausentes', () => {
        const dto = new StintBestLapDTO({})
        expect(dto.time).toBe('--:--.---')
        expect(dto.lapInStint).toBe(0)
    })
})


// ---------------------------------------------------------------------------
// StintDriverDataDTO
// ---------------------------------------------------------------------------

describe('StintDriverDataDTO', () => {

    const rawDriverData = {
        compound: 'SOFT',
        compound_color: '#da291c',
        compound_label: 'S',
        duration_laps: 20,
        duration_time: '30:00.000',
        best_lap: { time: '1:33.456', lap_in_stint: 3 },
        average: '1:35.000',
        median: '1:34.500',
        std_dev: '0.500',
        consistency: 98.5,
    }

    it('transforma correctamente todos los campos snake_case a camelCase', () => {
        const dto = new StintDriverDataDTO(rawDriverData)
        expect(dto.compound).toBe('SOFT')
        expect(dto.compoundColor).toBe('#da291c')
        expect(dto.compoundLabel).toBe('S')
        expect(dto.durationLaps).toBe(20)
        expect(dto.durationTime).toBe('30:00.000')
        expect(dto.average).toBe('1:35.000')
        expect(dto.median).toBe('1:34.500')
        expect(dto.stdDev).toBe('0.500')
        expect(dto.consistency).toBe(98.5)
    })

    it('construye bestLap como StintBestLapDTO', () => {
        const dto = new StintDriverDataDTO(rawDriverData)
        expect(dto.bestLap.time).toBe('1:33.456')
        expect(dto.bestLap.lapInStint).toBe(3)
    })

    it('aplica valores por defecto cuando los campos están ausentes', () => {
        const dto = new StintDriverDataDTO({})
        expect(dto.compound).toBe('UNKNOWN')
        expect(dto.compoundColor).toBe('#FFFFFF')
        expect(dto.compoundLabel).toBe('?')
        expect(dto.durationLaps).toBe(0)
        expect(dto.consistency).toBe(0)
    })

    it('aplica 0 como consistencia cuando el valor no es numérico', () => {
        const dto = new StintDriverDataDTO({ ...rawDriverData, consistency: 'invalid' })
        expect(dto.consistency).toBe(0)
    })
})


// ---------------------------------------------------------------------------
// StintDTO
// ---------------------------------------------------------------------------

describe('StintDTO', () => {

    const rawStint = {
        stint_number: 2,
        drivers: {
            HAM: {
                compound: 'MEDIUM',
                compound_color: '#FFF200',
                compound_label: 'M',
                duration_laps: 30,
                duration_time: '45:00.000',
                best_lap: { time: '1:34.000', lap_in_stint: 5 },
                average: '1:36.000',
                median: '1:35.500',
                std_dev: '0.600',
                consistency: 95.0,
            },
            RUS: null,
        },
    }

    it('transforma stint_number a stintNumber', () => {
        const dto = new StintDTO(rawStint)
        expect(dto.stintNumber).toBe(2)
    })

    it('construye StintDriverDataDTO para pilotos con datos', () => {
        const dto = new StintDTO(rawStint)
        expect(dto.drivers.HAM).toBeDefined()
        expect(dto.drivers.HAM.compoundLabel).toBe('M')
        expect(dto.drivers.HAM.durationLaps).toBe(30)
    })

    it('mantiene null para pilotos que no participaron en el stint', () => {
        const dto = new StintDTO(rawStint)
        expect(dto.drivers.RUS).toBeNull()
    })

    it('aplica valores por defecto cuando faltan campos', () => {
        const dto = new StintDTO({})
        expect(dto.stintNumber).toBe(0)
        expect(dto.drivers).toEqual({})
    })
})


// ---------------------------------------------------------------------------
// StintsResponseDTO
// ---------------------------------------------------------------------------

describe('StintsResponseDTO', () => {

    const rawResponse = {
        drivers: ['HAM', 'RUS'],
        stints: [
            {
                stint_number: 1,
                drivers: {
                    HAM: {
                        compound: 'SOFT', compound_color: '#da291c', compound_label: 'S',
                        duration_laps: 20, duration_time: '30:00.000',
                        best_lap: { time: '1:33.456', lap_in_stint: 3 },
                        average: '1:35.000', median: '1:34.500', std_dev: '0.500', consistency: 98.5,
                    },
                    RUS: null,
                },
            },
        ],
    }

    it('preserva el orden de drivers dictado por el backend', () => {
        const dto = new StintsResponseDTO(rawResponse)
        expect(dto.drivers).toEqual(['HAM', 'RUS'])
    })

    it('construye StintDTO por cada stint', () => {
        const dto = new StintsResponseDTO(rawResponse)
        expect(dto.stints).toHaveLength(1)
        expect(dto.stints[0].stintNumber).toBe(1)
    })

    it('aplica valores por defecto con respuesta vacía', () => {
        const dto = new StintsResponseDTO({})
        expect(dto.drivers).toEqual([])
        expect(dto.stints).toEqual([])
    })

    it('mantiene null para pilotos sin datos en un stint', () => {
        const dto = new StintsResponseDTO(rawResponse)
        expect(dto.stints[0].drivers.RUS).toBeNull()
    })
})