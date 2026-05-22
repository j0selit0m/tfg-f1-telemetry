// Capa de red: solicita el análisis de stints al backend y devuelve DTOs.

import { API_BASE } from '../../config/api';
import { StintsResponseDTO } from './dtos';

export async function fetchStints({ year, round, session, driver }, signal) {
    const url = `${API_BASE}/analysis/${year}/${encodeURIComponent(round)}/${encodeURIComponent(session)}/stints?drivers=${driver}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new StintsResponseDTO(await res.json());
}