// Modelos que reflejan el contrato del backend para el endpoint de resumen de sesión.

export class CompoundDTO {
    constructor(raw = {}) {
        this.compound = raw.compound ?? 'UNKNOWN';
        // Color y label oficiales de la temporada, resueltos por el backend
        this.color = raw.color ?? '#FFFFFF';
        this.label = raw.label ?? '?';
    }
}

export class BestLapDTO {
    constructor(raw = {}) {
        this.time = raw.time ?? '--:--.---';
        this.lapNumber = raw.lap_number ?? null;
    }
}

export class DriverSummaryDTO {
    constructor(driverCode, raw = {}) {
        this.driverCode = driverCode;
        this.bestLap = new BestLapDTO(raw.best_lap ?? {});
        this.average = raw.average ?? '--:--.---';
        this.median = raw.median ?? '--:--.---';
        this.stdDev = raw.std_dev ?? '---.---';
        this.consistency = typeof raw.consistency === 'number' ? raw.consistency : 0;
        this.validLaps = raw.valid_laps ?? 0;
        this.strategy = Array.isArray(raw.strategy)
            ? raw.strategy.map(s => new CompoundDTO(s))
            : [];
    }

    // Etiqueta cualitativa de consistencia para mostrar en la UI
    get consistencyLabel() {
        if (this.consistency >= 90) return 'Excellent';
        if (this.consistency >= 75) return 'Good';
        if (this.consistency >= 60) return 'Average';
        return 'Poor';
    }
}

export class SessionSummaryDTO {
    constructor(raw = {}) {
        this.drivers = (raw.drivers ?? [])
            .map(code => {
                const data = raw.summaries?.[code];
                return data ? new DriverSummaryDTO(code, data) : null;
            })
            .filter(Boolean);
    }

    // Comparación lexicográfica válida para el formato "M:SS.mmm"
    get fastestDriver() {
        if (!this.drivers.length) return null;
        return this.drivers.reduce((best, cur) =>
            cur.bestLap.time < best.bestLap.time ? cur : best
        );
    }
}