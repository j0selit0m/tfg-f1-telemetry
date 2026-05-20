import { useState, useEffect } from 'react';

// ─── Configuración ────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000/api';
const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

// Helper genérico para fetch: lanza error si el servidor responde con status != 2xx
async function apiFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ─── Custom Hook: useF1SessionData ───────────────────────────────────────────
//
// Encapsula toda la lógica de estado y las 3 llamadas en cascada al backend.
// El componente SidebarFilter solo consume lo que necesita renderizar.
//
// Flujo de llamadas (orden obligatorio según contrato API):
//   1. GET /api/schedule/{year}                              → lista de GPs
//   2. GET /api/schedule/{year}/{event}/sessions             → sesiones del GP
//   3. GET /api/session/{year}/{event}/{session}/drivers     → pilotos + colores

function useF1SessionData() {

    // Datos que llegan del backend
    const [events, setEvents] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [drivers, setDrivers] = useState([]);

    // Selecciones actuales del usuario
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedEvent, setSelectedEvent] = useState('');
    const [selectedSession, setSelectedSession] = useState('');
    const [selectedDrivers, setSelectedDrivers] = useState([]);

    // Estados de carga individuales para dar feedback visual por selector
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [loadingDrivers, setLoadingDrivers] = useState(false);

    // CASCADA 1: Año → Grandes Premios
    // Al cambiar de año se resetean los selectores inferiores para evitar estados inconsistentes
    useEffect(() => {
        if (!selectedYear) return;
        setSelectedEvent('');
        setEvents([]);
        setLoadingEvents(true);
        apiFetch(`${API_BASE}/schedule/${selectedYear}`)
            .then(setEvents)
            .catch(err => console.error('Events fetch failed:', err))
            .finally(() => setLoadingEvents(false));
    }, [selectedYear]);

    // CASCADA 2: Gran Premio → Sesiones disponibles
    useEffect(() => {
        if (!selectedYear || !selectedEvent) return;
        setSelectedSession('');
        setSessions([]);
        setLoadingSessions(true);
        apiFetch(`${API_BASE}/schedule/${selectedYear}/${selectedEvent}/sessions`)
            .then(setSessions)
            .catch(err => console.error('Sessions fetch failed:', err))
            .finally(() => setLoadingSessions(false));
    }, [selectedEvent, selectedYear]);

    // CASCADA 3: Sesión → Pilotos
    // El backend devuelve { drivers: [...], compounds: {} }.
    // Los compounds se gestionarán globalmente (Context/Zustand) en una iteración futura.
    useEffect(() => {
        if (!selectedYear || !selectedEvent || !selectedSession) return;
        setSelectedDrivers([]);
        setDrivers([]);
        setLoadingDrivers(true);
        apiFetch(`${API_BASE}/session/${selectedYear}/${selectedEvent}/${selectedSession}/drivers`)
            .then(data => setDrivers(data.drivers ?? []))
            .catch(err => console.error('Drivers fetch failed:', err))
            .finally(() => setLoadingDrivers(false));
    }, [selectedSession, selectedEvent, selectedYear]);

    // Toggle de selección múltiple de pilotos (add/remove de la lista)
    const toggleDriver = (abbr) => {
        setSelectedDrivers(prev =>
            prev.includes(abbr) ? prev.filter(d => d !== abbr) : [...prev, abbr]
        );
    };

    // Construye el DTO que se emite al componente padre al pulsar "Run Analysis".
    // Separa driverColors (para líneas de gráficas) de teamColors (para elementos UI),
    // ya que el 2º piloto de cada equipo tiene un driver_color aclarado distinto al team_color.
    const buildFilterPayload = () => {
        const selected = drivers.filter(d => selectedDrivers.includes(d.abbreviation));
        return {
            year: selectedYear,
            round: selectedEvent,
            session: selectedSession,
            driver: selectedDrivers.join(','),
            availableSessions: sessions.map(s => s.id),
            driverColors: Object.fromEntries(selected.map(d => [d.abbreviation, d.driver_color])),
            teamColors: Object.fromEntries(selected.map(d => [d.abbreviation, d.team_color])),
        };
    };

    // El botón "Run Analysis" solo se habilita cuando todos los campos están cubiertos
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
        loading: { events: loadingEvents, sessions: loadingSessions, drivers: loadingDrivers },
    };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SidebarFilter({ onFilterReady }) {
    const {
        events, sessions, drivers,
        selectedYear, setSelectedYear,
        selectedEvent, setSelectedEvent,
        selectedSession, setSelectedSession,
        selectedDrivers,
        toggleDriver,
        buildFilterPayload,
        isReady,
        loading,
    } = useF1SessionData();

    return (
        <aside className="w-80 min-h-screen p-5 bg-gradient-to-b from-gray-900 via-gray-800 to-black border-r-4 border-red-700 shadow-2xl flex flex-col font-sans overflow-y-auto overflow-x-hidden">

            <Branding />

            {/* Los tres selectores comparten el mismo componente genérico FilterSelect */}
            <FilterSelect
                label="Season"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                disabled={false}
            >
                {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </FilterSelect>

            <FilterSelect
                label="Grand Prix"
                value={selectedEvent}
                onChange={e => setSelectedEvent(e.target.value)}
                disabled={!events.length}
                loading={loading.events}
            >
                {/* El backend devuelve snake_case: round_number y event_name */}
                {events.map(ev => (
                    <option key={ev.round_number} value={ev.event_name}>
                        R{ev.round_number} - {ev.event_name}
                    </option>
                ))}
            </FilterSelect>

            <FilterSelect
                label="Session"
                value={selectedSession}
                onChange={e => setSelectedSession(e.target.value)}
                disabled={!sessions.length}
                loading={loading.sessions}
                className="mb-6"
            >
                {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.id}</option>
                ))}
            </FilterSelect>

            <DriverGrid
                drivers={drivers}
                selectedDrivers={selectedDrivers}
                onToggle={toggleDriver}
                loading={loading.drivers}
            />

            <SelectedDriversList
                drivers={drivers}
                selectedDrivers={selectedDrivers}
                onToggle={toggleDriver}
            />

            <button
                onClick={() => onFilterReady(buildFilterPayload())}
                disabled={!isReady}
                className="mt-auto w-full py-3 text-lg font-extrabold italic tracking-wider text-white uppercase transition-all bg-gradient-to-r from-red-700 to-red-600 border-2 border-red-800 rounded-sm hover:from-red-600 hover:to-red-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(220,38,38,0.4)] flex-shrink-0"
            >
                Run Analysis
            </button>
        </aside>
    );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

// Spinner de carga inline para los labels de los selectores
function Spinner() {
    return (
        <span className="inline-block w-3 h-3 border border-gray-500 border-t-red-500 rounded-full animate-spin ml-2" />
    );
}

function Branding() {
    return (
        <div className="mb-6 border-b-2 border-gray-600 pb-4 flex items-center gap-3">
            {/* Zona reservada para el logo. Cuando lo tengas, sustituye este div por un <img> */}
            {/* Cuando tengas el logo, el <img src={logo} className="w-10 h-10 object-contain" /> sustituye directamente ese <div> placeholder sin tocar nada más.*/}
            <div className="w-10 h-10 border border-gray-600 border-dashed rounded-sm flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-gray-600">PW</span>
            </div>
            <h2 className="text-3xl font-extrabold italic uppercase tracking-wider text-white drop-shadow-md leading-none">
                <span className="text-white">PIT</span>
                <span className="text-red-600">WALL</span>
            </h2>
        </div>
    );
}

// Select reutilizable con label, spinner de carga y estado disabled unificados.
// className es override del margen inferior (mb-4 por defecto, mb-6 en Session).
function FilterSelect({ label, value, onChange, disabled, loading = false, children, className = 'mb-4' }) {
    return (
        <div className={className}>
            <label className="flex items-center mb-1 text-sm font-bold italic text-gray-300 uppercase tracking-wide">
                {label}
                {loading && <Spinner />}
            </label>
            <select
                className="w-full p-2 text-white bg-black border border-gray-500 rounded-sm shadow-inner focus:border-red-600 focus:outline-none disabled:opacity-40 font-bold"
                value={value}
                onChange={onChange}
                disabled={disabled}
            >
                <option value="">-- SELECT --</option>
                {children}
            </select>
        </div>
    );
}

// Grid de botones toggle con la abreviatura de cada piloto.
// El borde y la franja superior usan team_color; driver_color queda reservado para las gráficas.
function DriverGrid({ drivers, selectedDrivers, onToggle, loading }) {
    return (
        <div className="mb-2">
            <label className="flex items-center text-sm font-bold italic text-gray-300 uppercase tracking-wide mb-2">
                Driver Grid
                {loading && <Spinner />}
            </label>

            <div className={`grid grid-cols-4 gap-1.5 ${!drivers.length ? 'opacity-40 pointer-events-none' : ''}`}>
                {!drivers.length ? (
                    <p className="col-span-4 text-gray-500 text-xs text-center mt-2 italic border border-gray-700 p-2">
                        Awaiting session data...
                    </p>
                ) : (
                    drivers.map(driver => {
                        const isSelected = selectedDrivers.includes(driver.abbreviation);
                        const color = driver.team_color || '#FFFFFF';

                        return (
                            <button
                                key={driver.abbreviation}
                                onClick={() => onToggle(driver.abbreviation)}
                                className={`relative py-1.5 px-1 border transition-all overflow-hidden ${isSelected ? 'bg-gray-900' : 'bg-black hover:bg-gray-800'
                                    }`}
                                style={{ borderColor: isSelected ? color : '#374151' }}
                            >
                                {/* Franja de color superior: visible solo cuando está seleccionado */}
                                <div
                                    className="absolute top-0 left-0 w-full h-1"
                                    style={{ backgroundColor: isSelected ? color : 'transparent' }}
                                />
                                <span className={`font-mono text-sm tracking-tighter ${isSelected ? 'text-white font-black' : 'text-gray-500 font-bold'
                                    }`}>
                                    {driver.abbreviation}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// Lista de tarjetas de pilotos seleccionados. Se oculta si no hay ninguno.
function SelectedDriversList({ drivers, selectedDrivers, onToggle }) {
    if (!selectedDrivers.length) return null;

    return (
        <div className="mb-6 flex-1 mt-4 flex flex-col gap-2">
            <span className="text-[10px] font-black italic text-gray-500 uppercase tracking-widest mb-1">
                Selected Drivers
            </span>
            <div className="grid grid-cols-1 gap-1.5">
                {selectedDrivers.map(abbr => {
                    const driver = drivers.find(d => d.abbreviation === abbr);
                    const driverColor = driver?.driver_color || '#FFFFFF';
                    return (
                        <DriverCard
                            key={abbr}
                            driver={driver}
                            abbr={abbr}
                            driverColor={driverColor}
                            onRemove={() => onToggle(abbr)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// Tarjeta individual de piloto seleccionado.
// driverColor → franja lateral izquierda, glow del nombre, línea inferior (color individual del piloto)
// teamColor   → nombre del equipo (color de escudería)
function DriverCard({ driver, abbr, driverColor, onRemove }) {
    return (
        <div className="relative flex items-stretch overflow-hidden border border-gray-800 shadow-lg group bg-black">
            <div className="w-2 shrink-0" style={{ backgroundColor: driverColor }} />

            <div
                className="flex-1 px-2.5 py-1.5 flex items-center justify-between"
                style={{ background: `linear-gradient(90deg, ${driverColor}15 0%, transparent 100%)` }}
            >
                <div className="flex items-baseline gap-2">
                    <span
                        className="text-lg font-black italic uppercase tracking-tighter"
                        style={{ color: driverColor, textShadow: `0 0 12px ${driverColor}60` }}
                    >
                        {abbr}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                        {driver?.full_name || 'Driver'}
                    </span>
                </div>

                <button
                    onClick={onRemove}
                    className="w-5 h-5 flex items-center justify-center border border-gray-700 bg-gray-900 rounded-sm hover:border-red-500 hover:bg-red-900/30 transition-all cursor-pointer"
                >
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-red-500">✕</span>
                </button>
            </div>
        </div>
    );
}