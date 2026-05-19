// App.jsx — Componente raíz. Gestiona el estado global de filtros y la navegación por pestañas.
// Patrón: Lifting State Up — los filtros suben desde SidebarFilter y se distribuyen a cada vista.

import { useState } from 'react';
import SidebarFilter from './components/SidebarFilter';
import TelemetryTable from './components/TelemetryTable';
import SummaryStatistics from './components/SummaryStatistics';
import StintAnalysis from './components/StintAnalysis';
import SpeedAnalysis from './components/SpeedAnalysis';


// Registro declarativo de pestañas. Para añadir una vista nueva basta con importar
// el componente y añadir un objeto aquí; el render y la barra de tabs se actualizan solos.
const TABS = [
  { id: 'lap-data', label: 'Lap Data', component: TelemetryTable },
  { id: 'session-summary', label: 'Session Summary', component: SummaryStatistics },
  { id: 'stint-analysis', label: 'Stint Analysis', component: StintAnalysis },
  { id: 'speed-telemetry', label: 'Speed Telemetry', component: SpeedAnalysis },
];


function App() {
  // null mientras el usuario no haya confirmado una sesión desde el Sidebar.
  // Cada componente hijo es responsable de mostrar su propio estado vacío.
  const [activeFilters, setActiveFilters] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  // Callback que recibe SidebarFilter al validar y confirmar la selección de sesión.
  const handleFilterReady = (filters) => {
    setActiveFilters(filters);
  };

  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.component;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">

      {/* Sidebar: selección de temporada, GP, sesión y pilotos */}
      <SidebarFilter onFilterReady={handleFilterReady} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        <header className="flex items-center gap-3 px-6 py-3 bg-[#111318] border-b border-gray-800 flex-shrink-0">
          <span className="text-sm font-black italic uppercase tracking-tight text-white">
            Pit<span className="text-red-600">wall</span>
          </span>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-xs text-gray-500 uppercase tracking-widest">
            Formula 1 Data Analysis
          </span>
        </header>

        {/* Navegación por pestañas generada a partir del array TABS */}
        <nav className="flex bg-[#111318] border-b border-gray-800 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              className={[
                'px-5 py-3 text-xs font-semibold uppercase tracking-widest',
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

        {/* El scroll vive aquí para mantener sidebar y tabs siempre visibles */}
        <main className="flex-1 overflow-y-auto">
          {TABS.map(tab => {
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

export default App;