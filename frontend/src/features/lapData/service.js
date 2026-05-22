// Capa de red: solicita los datos de vueltas al backend y devuelve DTOs.

import { API_BASE } from '../../config/api';
import { LapDataResponseDTO } from './dtos';

export async function fetchLapData({ year, round, session, driver }, signal) {
    const url = `${API_BASE}/analysis/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/laps?drivers=${driver}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new LapDataResponseDTO(await res.json());
}