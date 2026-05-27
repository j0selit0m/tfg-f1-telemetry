// DTOs del dominio de mapa de circuito.
// Espejo de backend/dtos/track_dto.py

export class MicrosectorPointDTO {
    constructor(raw = {}) {
        this.x = raw.x ?? 0;
        this.y = raw.y ?? 0;
        this.distance = raw.distance ?? 0;
        this.fastest = raw.fastest ?? '';
    }
}

export class SectorTimeDTO {
    constructor(raw = {}) {
        this.sectorNumber = raw.sector_number ?? 0;
        this.fastest = raw.fastest ?? '';
        this.times = raw.times ?? {};
    }
}

export class CornerPositionDTO {
    constructor(raw = {}) {
        this.number = raw.number ?? 0;
        this.letter = raw.letter ?? '';
        this.x = raw.x ?? 0;
        this.y = raw.y ?? 0;
        this.angle = raw.angle ?? 0;
    }
}

export class DriverLapInfoDTO {
    constructor(raw = {}) {
        this.driver = raw.driver ?? '';
        this.lapNumber = raw.lap_number ?? 0;
    }
}

export class TrackMapDTO {
    constructor(raw = {}) {
        this.session = raw.session ?? '';
        this.drivers = Array.isArray(raw.drivers)
            ? raw.drivers.map(d => new DriverLapInfoDTO(d))
            : [];
        this.points = Array.isArray(raw.points)
            ? raw.points.map(p => new MicrosectorPointDTO(p))
            : [];
        this.sectors = Array.isArray(raw.sectors)
            ? raw.sectors.map(s => new SectorTimeDTO(s))
            : [];
        this.corners = Array.isArray(raw.corners)
            ? raw.corners.map(c => new CornerPositionDTO(c))
            : [];
    }
}

