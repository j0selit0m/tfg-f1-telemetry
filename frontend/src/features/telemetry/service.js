// Capa de red: solicita la telemetría completa al backend y devuelve DTOs.

import { API_BASE } from '../../config/api';
import { TelemetryDTO } from './dtos';

export async function fetchTelemetry({ year, round, driverParam }, signal) {
    const url =
        `${API_BASE}/telemetry/${year}/${encodeURIComponent(round)}/full` +
        `?drivers=${encodeURIComponent(driverParam)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return new TelemetryDTO(await res.json());
}