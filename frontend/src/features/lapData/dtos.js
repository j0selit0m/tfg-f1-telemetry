// Modelos que reflejan el contrato del backend para el endpoint de vueltas.
// LapEntryDTO representa los datos de un piloto en una vuelta concreta.

export class LapEntryDTO {
    constructor(raw = {}) {
        this.lapTime = raw.lap_time ?? null;
        this.sector1 = raw.sector1 ?? null;
        this.sector2 = raw.sector2 ?? null;
        this.sector3 = raw.sector3 ?? null;
        this.compound = raw.compound ?? 'UNKNOWN';
        this.tyreLife = raw.tyre_life ?? 0;
        this.stint = raw.stint ?? 0;
        this.position = raw.position ?? null;
        this.trackStatus = raw.track_status ?? null;
        this.pitIn = raw.pit_in ?? false;
        this.pitOut = raw.pit_out ?? false;
        this.deleted = raw.deleted ?? false;
        this.isAccurate = raw.is_accurate ?? true;
        this.isFastestLap = raw.is_fastest_lap ?? false;
    }
}

export class LapRowDTO {
    constructor(raw = {}) {
        this.lapNumber = raw.lap_number ?? 0;
        // entries: mapa piloto -> LapEntryDTO | null
        this.entries = Object.fromEntries(
            Object.entries(raw.entries ?? {}).map(([driver, entry]) => [
                driver,
                entry ? new LapEntryDTO(entry) : null,
            ])
        );
    }
}

export class LapDataResponseDTO {
    constructor(raw = {}) {
        // drivers define el orden de columnas dictado por el backend
        this.drivers = raw.drivers ?? [];
        this.laps = (raw.laps ?? []).map(l => new LapRowDTO(l));
    }
}