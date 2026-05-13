import { useState, useEffect } from 'react';

export default function SidebarFilter({ onFilterReady }) {
    // 1. CONSTANTES Y ESTADOS GLOBALES (State Management)
    const availableYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
    const API_BASE = 'http://localhost:8000/api';

    // Estados para almacenar los datos que llegan del backend
    const [events, setEvents] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [drivers, setDrivers] = useState([]);

    // Estados para almacenar las selecciones actuales del usuario
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedEvent, setSelectedEvent] = useState('');
    const [selectedSession, setSelectedSession] = useState('');
    const [selectedDrivers, setSelectedDrivers] = useState([]); // Array para selección múltiple

    // --- 2. LÓGICA DE FILTROS EN CASCADA (Cascading Dropdowns) ---
    // Los 'useEffect' se encadenan. Cuando el usuario elige un Año, se buscan los Eventos.
    // Cuando elige un Evento, se buscan las Sesiones.

    // CASCADA 1: El usuario selecciona un Año -> Buscamos los Grandes Premios (Events)
    useEffect(() => {
        if (!selectedYear) return; // Si no hay año, no hacemos nada

        // Limpiamos los selectores inferiores para evitar datos residuales
        setSelectedEvent('');
        setEvents([]);

        fetch(`${API_BASE}/schedule/${selectedYear}`)
            .then(res => res.json())
            .then(data => setEvents(data))
            .catch(err => console.error("Error loading events:", err));
    }, [selectedYear]); // Este hook solo se ejecuta si 'selectedYear' cambia

    // CASCADA 2: El usuario selecciona un Gran Premio -> Buscamos las Sesiones (FP1, Q, R...)
    useEffect(() => {
        if (!selectedYear || !selectedEvent) return;

        setSelectedSession('');
        setSessions([]);

        fetch(`${API_BASE}/schedule/${selectedYear}/${selectedEvent}/sessions`)
            .then(res => res.json())
            .then(data => setSessions(data))
            .catch(err => console.error("Error loading sessions:", err));
    }, [selectedEvent, selectedYear]);

    // CASCADA 3: El usuario selecciona una Sesión -> Buscamos los Pilotos de esa sesión
    useEffect(() => {
        if (!selectedYear || !selectedEvent || !selectedSession) return;

        // Limpiamos los pilotos previamente seleccionados si cambiamos de sesión
        setSelectedDrivers([]);
        setDrivers([]);

        fetch(`${API_BASE}/session/${selectedYear}/${selectedEvent}/${selectedSession}/drivers`)
            .then(res => res.json())
            .then(data => setDrivers(data))
            .catch(err => console.error("Error loading drivers:", err));
    }, [selectedSession, selectedEvent, selectedYear]);


    // --- 3. LÓGICA DE SELECCIÓN MÚLTIPLE ---
    // Agrega o elimina un piloto del array de seleccionados de forma inmutable
    const handleDriverToggle = (driverAbbr) => {
        setSelectedDrivers(prevSelected => {
            // Si el piloto ya está en la lista, lo filtramos (lo quitamos)
            if (prevSelected.includes(driverAbbr)) {
                return prevSelected.filter(d => d !== driverAbbr);
            } else {
                // Si no está, devolvemos una copia del array anterior más el nuevo piloto
                return [...prevSelected, driverAbbr];
            }
        });
    };

    // --- 4. RENDERIZADO DE LA INTERFAZ (UI) ---
    return (
        <aside className="w-80 min-h-screen p-5 bg-gradient-to-b from-gray-900 via-gray-800 to-black border-r-4 border-red-700 shadow-2xl flex flex-col font-sans overflow-y-auto overflow-x-hidden">

            {/* Cabecera / Branding */}
            <div className="mb-6 border-b-2 border-gray-600 pb-4">
                <h2 className="text-3xl font-extrabold italic uppercase tracking-wider text-white drop-shadow-md">
                    <span className="text-red-600 text-4xl mr-1">F1</span>
                    Telemetry
                </h2>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Data Analysis System</p>
            </div>

            {/* SELECTOR: Año (Season) */}
            <div className="mb-4">
                <label className="block mb-1 text-sm font-bold italic text-gray-300 uppercase tracking-wide">Season</label>
                <select
                    className="w-full p-2 text-white bg-black border border-gray-500 rounded-sm shadow-inner focus:border-red-600 focus:outline-none font-bold"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                >
                    <option value="">-- SELECT --</option>
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>

            {/* SELECTOR: Gran Premio (Grand Prix / Event) */}
            <div className="mb-4">
                <label className="block mb-1 text-sm font-bold italic text-gray-300 uppercase tracking-wide">Grand Prix</label>
                <select
                    className="w-full p-2 text-white bg-black border border-gray-500 rounded-sm shadow-inner focus:border-red-600 focus:outline-none disabled:opacity-40 font-bold"
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    disabled={!events.length} // Se deshabilita si no hay eventos cargados
                >
                    <option value="">-- SELECT --</option>
                    {events.map(event => (
                        <option key={`${event.RoundNumber}-${event.EventName}`} value={event.EventName}>                            R{event.RoundNumber} - {event.EventName}
                        </option>
                    ))}
                </select>
            </div>

            {/* SELECTOR: Sesión (Session) */}
            <div className="mb-6">
                <label className="block mb-1 text-sm font-bold italic text-gray-300 uppercase tracking-wide">Session</label>
                <select
                    className="w-full p-2 text-white bg-black border border-gray-500 rounded-sm shadow-inner focus:border-red-600 focus:outline-none disabled:opacity-40 font-bold"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    disabled={!sessions.length}
                >
                    <option value="">-- SELECT --</option>
                    {sessions.map(session => (
                        <option key={session.id} value={session.id}>{session.id}</option>
                    ))}
                </select>
            </div>

            {/* --- PARTE 1: CUADRÍCULA TÁCTICA DE PILOTOS (Driver Grid) --- */}
            <div className="mb-2">
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold italic text-gray-300 uppercase tracking-wide">
                        Driver Grid
                    </label>
                </div>

                {/* Aplicamos opacidad si aún no hay pilotos cargados */}
                <div className={`grid grid-cols-4 gap-1.5 ${!drivers.length ? 'opacity-40 pointer-events-none' : ''}`}>
                    {!drivers.length ? (
                        <div className="col-span-4 text-gray-500 text-xs text-center mt-2 italic border border-gray-700 p-2">
                            Awaiting session data...
                        </div>
                    ) : (
                        drivers.map(driver => {
                            const isSelected = selectedDrivers.includes(driver.abbreviation);
                            const teamColor = driver.team_color || '#FFFFFF';

                            return (
                                <button
                                    key={driver.abbreviation}
                                    onClick={() => handleDriverToggle(driver.abbreviation)}
                                    // Cambio de color dinámico si el botón está "presionado" (seleccionado)
                                    className={`relative py-1.5 px-1 border transition-all overflow-hidden ${isSelected ? 'bg-gray-900' : 'bg-black hover:bg-gray-800'
                                        }`}
                                    style={{ borderColor: isSelected ? teamColor : '#374151' }}
                                >
                                    {/* Pequeña franja superior con el color del equipo */}
                                    <div
                                        className="absolute top-0 left-0 w-full h-1"
                                        style={{ backgroundColor: isSelected ? teamColor : 'transparent' }}
                                    ></div>
                                    <span className={`font-mono text-sm tracking-tighter ${isSelected ? 'text-white font-black' : 'text-gray-500 font-bold'}`}>
                                        {driver.abbreviation}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- PARTE 2: VISOR DE TARJETAS TÁCTICAS (Live Telemetry Bento Box) --- */}
            <div className="mb-6 flex-1">
                {selectedDrivers.length > 0 && (
                    <div className="mt-4 flex flex-col gap-2">
                        {/* Divisor estético estilo HUD */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-[2px] flex-1 bg-gray-700"></div>
                            <span className="text-[10px] font-black italic text-red-500 uppercase tracking-widest">
                                Live_Telemetry
                            </span>
                            <div className="h-[2px] w-4 bg-gray-700"></div>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                            {selectedDrivers.map(abbr => {
                                // Buscamos el objeto completo del piloto usando su abreviatura
                                const driver = drivers.find(d => d.abbreviation === abbr);
                                const color = driver?.team_color || '#FFFFFF';

                                return (
                                    <div
                                        key={abbr}
                                        className="relative flex items-stretch overflow-hidden border border-gray-800 shadow-lg group bg-black"
                                    >
                                        {/* Franja lateral sólida */}
                                        <div className="w-3 shrink-0" style={{ backgroundColor: color }}></div>

                                        <div
                                            className="flex-1 p-2.5 flex items-center justify-between relative"
                                            style={{ background: `linear-gradient(90deg, ${color}15 0%, transparent 100%)` }}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-2">
                                                    {/* Abreviatura con efecto Glow (resplandor LED) */}
                                                    <span
                                                        className="text-2xl font-black italic uppercase leading-none tracking-tighter"
                                                        style={{
                                                            color: color,
                                                            textShadow: `0 0 12px ${color}60`
                                                        }}
                                                    >
                                                        {abbr}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-gray-800 text-gray-300">
                                                        #{driver?.driver_number || '00'}
                                                    </span>
                                                </div>

                                                <span className="text-xs font-bold uppercase text-white tracking-widest mt-1 italic">
                                                    {driver?.full_name || 'Driver'}
                                                </span>

                                                <span className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider mt-0.5">
                                                    {driver?.team_name || 'Team'}
                                                </span>
                                            </div>

                                            {/* Botón de eliminar (X) */}
                                            <button
                                                onClick={() => handleDriverToggle(abbr)}
                                                className="w-6 h-6 flex items-center justify-center border border-gray-700 bg-gray-900 rounded-sm hover:border-red-500 hover:bg-red-900/30 transition-all z-10 cursor-pointer"
                                            >
                                                <span className="text-[10px] font-bold text-gray-400 group-hover:text-red-500">X</span>
                                            </button>
                                        </div>

                                        {/* Línea inferior simulando un sensor óptico */}
                                        <div className="absolute bottom-0 left-3 right-0 h-[2px] bg-gray-900">
                                            <div className="h-full w-full opacity-60" style={{ backgroundColor: color }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* --- BOTÓN FINAL DE EJECUCIÓN --- */}
            <button
                className="mt-auto w-full py-3 text-lg font-extrabold italic tracking-wider text-white uppercase transition-all bg-gradient-to-r from-red-700 to-red-600 border-2 border-red-800 rounded-sm hover:from-red-600 hover:to-red-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(220,38,38,0.4)] flex-shrink-0"
                // El botón solo se activa si todo está seleccionado y hay al menos 1 piloto
                disabled={!selectedYear || !selectedEvent || !selectedSession || selectedDrivers.length === 0}
                onClick={() => onFilterReady({
                    year: selectedYear,
                    round: selectedEvent,
                    session: selectedSession,
                    // Transformamos el array ['ALO', 'VER'] en un string separado por comas "ALO,VER"
                    driver: selectedDrivers.join(',')
                })}
            >
                Run Analysis
            </button>
        </aside>
    );
}