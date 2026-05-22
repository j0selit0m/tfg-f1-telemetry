// Capa de red: solicita el resumen de sesión al backend y devuelve DTOs.

import { API_BASE } from '../../config/api';
import { SessionSummaryDTO } from './dtos';

export async function fetchSummary({ year, round, session, driver }, signal) {
    const url = `${API_BASE}/analysis/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/summary?drivers=${driver}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new SessionSummaryDTO(await res.json());
}