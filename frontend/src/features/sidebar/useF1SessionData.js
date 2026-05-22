// Hook que orquesta las 3 llamadas en cascada: año → eventos → sesiones → pilotos.
// Cada cascada cancela la petición anterior con AbortController para evitar
// race conditions al cambiar filtros rápidamente.

import { useState, useEffect } from 'react';
import { fetchEvents, fetchSessions, fetchDrivers } from './service';

export function useF1SessionData() {

    const [events, setEvents] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [compounds, setCompounds] = useState({});

    const [selectedYear, setSelectedYear] = useState('');
    const [selectedEvent, setSelectedEvent] = useState('');
    const [selectedSession, setSelectedSession] = useState('');
    const [selectedDrivers, setSelectedDrivers] = useState([]);

    const [loadingEvents, setLoadingEvents] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [loadingDrivers, setLoadingDrivers] = useState(false);

    // ── Cascada 1: año → grandes premios ─────────────────────────────────────

    useEffect(() => {
        if (!selectedYear) return;
        const ctrl = new AbortController();
        setSelectedEvent('');
        setEvents([]);
        setLoadingEvents(true);
        fetchEvents(selectedYear, ctrl.signal)
            .then(setEvents)
            .catch(err => { if (err.name !== 'AbortError') console.error(err); })
            .finally(() => setLoadingEvents(false));
        return () => ctrl.abort();
    }, [selectedYear]);

    // ── Cascada 2: gran premio → sesiones disponibles ─────────────────────────

    useEffect(() => {
        if (!selectedYear || !selectedEvent) return;
        const ctrl = new AbortController();
        setSelectedSession('');
        setSessions([]);
        setLoadingSessions(true);
        fetchSessions(selectedYear, selectedEvent, ctrl.signal)
            .then(setSessions)
            .catch(err => { if (err.name !== 'AbortError') console.error(err); })
            .finally(() => setLoadingSessions(false));
        return () => ctrl.abort();
    }, [selectedYear, selectedEvent]);

    // ── Cascada 3: sesión → pilotos y compuestos ──────────────────────────────

    useEffect(() => {
        if (!selectedYear || !selectedEvent || !selectedSession) return;
        const ctrl = new AbortController();
        setSelectedDrivers([]);
        setDrivers([]);
        setLoadingDrivers(true);
        fetchDrivers(selectedYear, selectedEvent, selectedSession, ctrl.signal)
            .then(res => {
                setDrivers(res.drivers);
                setCompounds(res.compounds);
            })
            .catch(err => { if (err.name !== 'AbortError') console.error(err); })
            .finally(() => setLoadingDrivers(false));
        return () => ctrl.abort();
    }, [selectedYear, selectedEvent, selectedSession]);

    // ── Helpers ───────────────────────────────────────────────────────────────

    const toggleDriver = (abbr) => {
        setSelectedDrivers(prev =>
            prev.includes(abbr) ? prev.filter(d => d !== abbr) : [...prev, abbr]
        );
    };

    // Construye el payload que App.jsx distribuye a todas las vistas.
    const buildFilterPayload = () => {
        const selected = drivers.filter(d => selectedDrivers.includes(d.abbreviation));
        return {
            year: selectedYear,
            round: selectedEvent,
            session: selectedSession,
            driver: selectedDrivers.join(','),
            availableSessions: sessions.map(s => s.id),
            driverColors: Object.fromEntries(selected.map(d => [d.abbreviation, d.driverColor])),
            teamColors: Object.fromEntries(selected.map(d => [d.abbreviation, d.teamColor])),
            compounds,
        };
    };

    const isReady = !!(selectedYear && selectedEvent && selectedSession && selectedDrivers.length);

    return {
        events, sessions, drivers,
        selectedYear, setSelectedYear,
        selectedEvent, setSelectedEvent,
        selectedSession, setSelectedSession,
        selectedDrivers,
        toggleDriver,
        buildFilterPayload,
        isReady,
        loading: {
            events: loadingEvents,
            sessions: loadingSessions,
            drivers: loadingDrivers,
        },
    };
}