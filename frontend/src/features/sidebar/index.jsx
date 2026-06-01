// Orquestador del sidebar. Consume useF1SessionData y compone los sub-componentes
// de selección. Emite el payload de filtros al componente raíz via onFilterReady.

import { useF1SessionData } from './useF1SessionData';
import DriverGrid from './DriverGrid';
import DriverCard from './DriverCard';
import FilterSelect from './FilterSelect';

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

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
                {events.map(ev => (
                    <option key={ev.roundNumber} value={ev.eventName}>
                        R{ev.roundNumber} - {ev.eventName}
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

// --- Sub-componentes ---

function Branding() {
    return (
        <div className="mb-6 border-b-2 border-gray-600 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 border border-gray-600 border-dashed rounded-sm flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-gray-600">PW</span>
            </div>
            <h2 className="text-5xl font-extrabold italic tracking-wider text-white drop-shadow-md leading-none">
                <span className="text-white">Pit</span>
                <span className="text-red-600">Wall</span>
            </h2>
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
                    const driverColor = driver?.driverColor || '#FFFFFF';
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