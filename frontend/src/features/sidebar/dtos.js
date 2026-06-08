// Modelos que reflejan el contrato del backend.
// Garantizan valores por defecto seguros si algún campo llega undefined.

export class EventDTO {
    constructor(raw = {}) {
        this.roundNumber = raw.round_number ?? 0;
        this.eventName = raw.event_name ?? '';
    }
}

export class SessionDTO {
    constructor(raw = {}) {
        this.id = raw.id ?? '';
    }
}

export class DriverDTO {
    constructor(raw = {}) {
        this.abbreviation = raw.abbreviation ?? '';
        this.fullName = raw.full_name ?? '';
        // driverColor -> líneas de gráficas (color individual del piloto)
        // teamColor   -> elementos UI del sidebar (color de escudería)
        this.driverColor = raw.driver_color ?? '#FFFFFF';
        this.teamColor = raw.team_color ?? '#FFFFFF';
    }
}

export class DriversResponseDTO {
    constructor(raw = {}) {
        this.drivers = (raw.drivers ?? []).map(d => new DriverDTO(d));
        this.compounds = raw.compounds ?? {};
    }
}