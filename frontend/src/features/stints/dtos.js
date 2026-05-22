// Modelos que reflejan el contrato del backend para el endpoint de stints.

export class StintBestLapDTO {
    constructor(raw = {}) {
        this.time = raw.time ?? '--:--.---';
        // Posición de la vuelta dentro del stint, no número global de vuelta
        this.lapInStint = raw.lap_in_stint ?? 0;
    }
}

export class StintDriverDataDTO {
    constructor(raw = {}) {
        this.compound = raw.compound ?? 'UNKNOWN';
        // Color y label oficiales de la temporada, resueltos por el backend
        this.compoundColor = raw.compound_color ?? '#FFFFFF';
        this.compoundLabel = raw.compound_label ?? '?';
        this.durationLaps = raw.duration_laps ?? 0;
        this.durationTime = raw.duration_time ?? '--:--.---';
        this.bestLap = new StintBestLapDTO(raw.best_lap ?? {});
        this.average = raw.average ?? '--:--.---';
        this.median = raw.median ?? '--:--.---';
        this.stdDev = raw.std_dev ?? '0.000';
        this.consistency = typeof raw.consistency === 'number' ? raw.consistency : 0;
    }
}

export class StintDTO {
    constructor(raw = {}) {
        this.stintNumber = raw.stint_number ?? 0;
        // Si el piloto no participó en este stint su valor es null
        this.drivers = Object.fromEntries(
            Object.entries(raw.drivers ?? {}).map(([code, data]) => [
                code,
                data ? new StintDriverDataDTO(data) : null,
            ])
        );
    }
}

export class StintsResponseDTO {
    constructor(raw = {}) {
        // drivers define el orden de columnas; stints el orden de filas
        this.drivers = raw.drivers ?? [];
        this.stints = (raw.stints ?? []).map(s => new StintDTO(s));
    }
}