/**
 * Tests unitarios de los DTOs del dominio de datos de vuelta.
 *
 * Verifica que la transformación snake_case -> camelCase es correcta
 * y que los valores por defecto se aplican cuando faltan campos.
 * No requiere React ni mocks — son clases JavaScript puras.
 */

import { describe, it, expect } from 'vitest'
import { LapEntryDTO, LapRowDTO, LapDataResponseDTO } from '../features/lapData/dtos'


// ---------------------------------------------------------------------------
// LapEntryDTO
// ---------------------------------------------------------------------------

describe('LapEntryDTO', () => {

    const rawEntry = {
        lap_time: '1:33.456',
        sector1: '28.000',
        sector2: '35.000',
        sector3: '30.456',
        compound: 'SOFT',
        tyre_life: 5,
        stint: 1,
        position: 3,
        track_status: '1',
        pit_in: false,
        pit_out: false,
        deleted: false,
        is_accurate: true,
        is_fastest_lap: true,
    }

    it('transforma correctamente todos los campos snake_case a camelCase', () => {
        const dto = new LapEntryDTO(rawEntry)
        expect(dto.lapTime).toBe('1:33.456')
        expect(dto.tyreLife).toBe(5)
        expect(dto.trackStatus).toBe('1')
        expect(dto.pitIn).toBe(false)
        expect(dto.pitOut).toBe(false)
        expect(dto.isFastestLap).toBe(true)
        expect(dto.isAccurate).toBe(true)
        expect(dto.deleted).toBe(false)
    })

    it('aplica valores por defecto cuando los campos están ausentes', () => {
        const dto = new LapEntryDTO({})
        expect(dto.lapTime).toBeNull()
        expect(dto.compound).toBe('UNKNOWN')
        expect(dto.tyreLife).toBe(0)
        expect(dto.stint).toBe(0)
        expect(dto.position).toBeNull()
        expect(dto.trackStatus).toBeNull()
        expect(dto.pitIn).toBe(false)
        expect(dto.pitOut).toBe(false)
        expect(dto.isFastestLap).toBe(false)
        expect(dto.isAccurate).toBe(true)
        expect(dto.deleted).toBe(false)
    })

    it('preserva los sectores correctamente', () => {
        const dto = new LapEntryDTO(rawEntry)
        expect(dto.sector1).toBe('28.000')
        expect(dto.sector2).toBe('35.000')
        expect(dto.sector3).toBe('30.456')
    })
})


// ---------------------------------------------------------------------------
// LapRowDTO
// ---------------------------------------------------------------------------

describe('LapRowDTO', () => {

    const rawRow = {
        lap_number: 5,
        entries: {
            HAM: {
                lap_time: '1:33.456',
                compound: 'SOFT',
                tyre_life: 5,
                pit_in: false,
                pit_out: false,
                deleted: false,
                is_accurate: true,
                is_fastest_lap: false,
            },
            RUS: null,
        },
    }

    it('transforma lap_number a lapNumber', () => {
        const dto = new LapRowDTO(rawRow)
        expect(dto.lapNumber).toBe(5)
    })

    it('construye LapEntryDTO para pilotos con datos', () => {
        const dto = new LapRowDTO(rawRow)
        expect(dto.entries.HAM).toBeDefined()
        expect(dto.entries.HAM.lapTime).toBe('1:33.456')
    })

    it('mantiene null para pilotos sin datos en esa vuelta', () => {
        const dto = new LapRowDTO(rawRow)
        expect(dto.entries.RUS).toBeNull()
    })

    it('aplica valores por defecto cuando faltan campos', () => {
        const dto = new LapRowDTO({})
        expect(dto.lapNumber).toBe(0)
        expect(dto.entries).toEqual({})
    })
})


// ---------------------------------------------------------------------------
// LapDataResponseDTO
// ---------------------------------------------------------------------------

describe('LapDataResponseDTO', () => {

    const rawResponse = {
        drivers: ['HAM', 'RUS'],
        laps: [
            {
                lap_number: 1,
                entries: {
                    HAM: { lap_time: '1:33.456', compound: 'SOFT', tyre_life: 1, pit_in: false, pit_out: false, deleted: false, is_accurate: true, is_fastest_lap: false },
                    RUS: null,
                },
            },
            {
                lap_number: 2,
                entries: {
                    HAM: { lap_time: '1:34.000', compound: 'SOFT', tyre_life: 2, pit_in: false, pit_out: false, deleted: false, is_accurate: true, is_fastest_lap: false },
                    RUS: { lap_time: '1:34.500', compound: 'SOFT', tyre_life: 2, pit_in: false, pit_out: false, deleted: false, is_accurate: true, is_fastest_lap: false },
                },
            },
        ],
    }

    it('preserva el orden de drivers dictado por el backend', () => {
        const dto = new LapDataResponseDTO(rawResponse)
        expect(dto.drivers).toEqual(['HAM', 'RUS'])
    })

    it('construye LapRowDTO por cada vuelta', () => {
        const dto = new LapDataResponseDTO(rawResponse)
        expect(dto.laps).toHaveLength(2)
        expect(dto.laps[0].lapNumber).toBe(1)
        expect(dto.laps[1].lapNumber).toBe(2)
    })

    it('aplica valores por defecto con respuesta vacía', () => {
        const dto = new LapDataResponseDTO({})
        expect(dto.drivers).toEqual([])
        expect(dto.laps).toEqual([])
    })

    it('mantiene null para entradas de piloto ausentes en una vuelta', () => {
        const dto = new LapDataResponseDTO(rawResponse)
        expect(dto.laps[0].entries.RUS).toBeNull()
    })
})