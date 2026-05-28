// Capa de red: solicita el mapa de microsectores al backend y devuelve un TrackMapDTO.

import { API_BASE } from '../../config/api';
import { TrackMapDTO } from './dtos';

export async function fetchTrackMap({ year, round, driverParam }, signal) {
    const url =
        `${API_BASE}/track/${year}/${encodeURIComponent(round)}/map` +
        `?drivers=${encodeURIComponent(driverParam)}`;

    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return new TrackMapDTO(await res.json());
}