// Componente raíz. Gestiona el estado global de filtros y la navegación por pestañas.
// Patrón: Lifting State Up — los filtros suben desde SidebarFilter y se distribuyen
// a cada vista.

import { useState } from 'react';
import SidebarFilter from './features/sidebar';
import LapDataGrid from './features/lapData';
import SummaryStatistics from './features/summary';
import StintAnalysis from './features/stints';
import TelemetryView from './features/telemetry';
import TrackMapView from './features/trackMap';

// Registro declarativo de pestañas. Para añadir una vista nueva basta con importar
// el componente y añadir un objeto aquí.
const TABS = [
  { id: 'lap-data', label: 'Lap Data', component: LapDataGrid },
  { id: 'session-summary', label: 'Session Summary', component: SummaryStatistics },
  { id: 'stint-analysis', label: 'Stint Analysis', component: StintAnalysis },
  { id: 'speed-telemetry', label: 'Telemetry', component: TelemetryView },
  { id: 'track-map', label: 'Track Map', component: TrackMapView },
];

export default function App() {
  const [activeFilters, setActiveFilters] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  // Lazy mount: solo se montan las pestañas visitadas al menos una vez.
  // Evita fetches en paralelo al pulsar Run Analysis y mantiene en memoria
  // las ya visitadas para que el cambio entre tabs sea instantáneo.
  const [visitedTabs, setVisitedTabs] = useState(new Set([TABS[0].id]));

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setVisitedTabs(prev => new Set(prev).add(tabId));
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">

      <SidebarFilter onFilterReady={setActiveFilters} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header filters={activeFilters} />
        <TabNav tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

        {/* Las pestañas no visitadas no se montan; las visitadas permanecen
                    montadas y se ocultan con display:none cuando no son la activa. */}
        <main className="flex-1 overflow-y-auto">
          {TABS.map(tab => {
            if (!visitedTabs.has(tab.id)) return null;
            const TabComponent = tab.component;
            return (
              <div
                key={tab.id}
                style={{ display: activeTab === tab.id ? 'block' : 'none' }}
              >
                <TabComponent filters={activeFilters} />
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}

// --- Sub-componentes ---

// Muestra el contexto de la sesión activa cuando hay filtros aplicados.
function Header({ filters }) {
  return (
    <header className="flex items-center gap-3 px-5 py-3 bg-[#111318] border-b border-gray-800 flex-shrink-0">
      {filters ? (
        <>
          <span className="text-xl font-black italic uppercase tracking-tight text-white">
            {filters.round}
          </span>
          <span className="text-red-600 font-black">·</span>
          <span className="text-xl font-black italic uppercase tracking-tight text-gray-300">
            {filters.session}
          </span>
          <span className="text-red-600 font-black">·</span>
          <span className="text-base font-mono font-bold text-gray-500 tabular-nums">
            {filters.year}
          </span>
        </>
      ) : (
        <span className="text-base text-gray-500 uppercase tracking-widest font-mono">
          Formula 1 Data Analysis
        </span>
      )}
    </header>
  );
}

function TabNav({ tabs, activeTab, onChange }) {
  return (
    <nav className="flex bg-[#111318] border-b border-gray-800 flex-shrink-0">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          aria-selected={activeTab === tab.id}
          className={[
            'px-8 py-4 text-base font-black uppercase tracking-widest font-mono',
            'transition-colors duration-150 border-b-2 -mb-px cursor-pointer',
            activeTab === tab.id
              ? 'text-white border-red-600'
              : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}