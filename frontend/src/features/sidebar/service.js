// Capa de red: cada función hace exactamente una llamada al backend,
// soporta cancelación via AbortController y devuelve DTOs, nunca JSON crudo.

import { API_BASE } from '../../config/api';
import { EventDTO, SessionDTO, DriversResponseDTO } from './dtos';

export async function fetchEvents(year, signal) {
    const res = await fetch(`${API_BASE}/schedule/${year}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.map(e => new EventDTO(e));
}

export async function fetchSessions(year, event, signal) {
    const res = await fetch(
        `${API_BASE}/schedule/${year}/${encodeURIComponent(event)}/sessions`,
        { signal }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.map(s => new SessionDTO(s));
}

export async function fetchDrivers(year, event, session, signal) {
    const res = await fetch(
        `${API_BASE}/session/${year}/${encodeURIComponent(event)}/${encodeURIComponent(session)}/drivers`,
        { signal }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new DriversResponseDTO(await res.json());
}