// Modelos que reflejan el contrato del backend para el endpoint de telemetría.

export class DataPointDTO {
    constructor(raw = {}) {
        this.distance = raw.distance ?? 0;
        this.speed = raw.speed ?? 0;
        this.throttle = raw.throttle ?? 0;
        this.brake = raw.brake ?? 0;
        this.rpm = raw.rpm ?? 0;
        this.gear = raw.gear ?? 0;
        // DRS: >= 10 indica estado abierto según especificación de FastF1
        this.drsActive = (raw.drs ?? 0) >= 10 ? 1 : 0;
    }
}

export class DriverTelemetryDTO {
    constructor(raw = {}) {
        this.key = (raw.key ?? '').replaceAll(':', '_');
        this.driverCode = raw.driver ?? '';
        this.session = raw.session ?? '';
        this.lapNumber = raw.lap_number ?? 0;
        this.data = Array.isArray(raw.data)
            ? raw.data.map(d => new DataPointDTO(d))
            : [];
    }
}

export class CornerDTO {
    constructor(raw = {}) {
        this.number = raw.number ?? 0;
        this.letter = raw.letter ?? '';
        this.distance = raw.distance ?? 0;
    }

    get label() {
        return this.letter ? `${this.number}${this.letter}` : `${this.number}`;
    }
}

export class TelemetryDTO {
    constructor(raw = {}) {
        this.corners = (raw.corners ?? []).map(c => new CornerDTO(c));
        this.drivers = Object.fromEntries(
            (raw.drivers ?? []).map(d => {
                const dto = new DriverTelemetryDTO(d);
                return [dto.key, dto];
            })
        );
    }

    // Distancia máxima entre todos los pilotos para inicializar el dominio del zoom
    get maxDistance() {
        const ends = Object.values(this.drivers).map(d =>
            d.data.length ? d.data.at(-1).distance : 0
        );
        return Math.ceil(Math.max(0, ...ends));
    }
}