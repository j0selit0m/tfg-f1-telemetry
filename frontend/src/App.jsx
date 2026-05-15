import { useState } from 'react';
import SidebarFilter from './components/SidebarFilter';
import TelemetryTable from './components/TelemetryTable';
import SummaryStatistics from './components/SummaryStatistics'; // ← nuevo

function App() {
  // --- 1. ESTADO GLOBAL ---
  // Guardamos los filtros que el usuario confirma al pulsar el botón de análisis.
  // Inicialmente es 'null' hasta que el usuario interactúe con el panel lateral.
  const [activeFilters, setActiveFilters] = useState(null);

  // --- 2. GESTOR DE EVENTOS (CALLBACK) ---
  // Esta función se ejecuta cuando el Sidebar envía los datos seleccionados tras la validación.
  const handleFilterReady = (filters) => {
    console.log("Filtros recibidos en el Dashboard principal:", filters);
    // Actualizamos el estado para que el resto de los componentes (como la tabla) se re-rendericen con los nuevos datos.
    setActiveFilters(filters);
  };

  return (
    // CONTENEDOR PRINCIPAL: Usamos 'flex' para colocar el Sidebar y el área de trabajo lado a lado.
    // 'min-h-screen' asegura que el fondo negro cubra toda la altura de la ventana del navegador.
    <div className="flex min-h-screen bg-black text-white font-sans overflow-hidden">

      {/* SECCIÓN 1: MENÚ LATERAL (SIDEBAR) */}
      {/* Pasamos la función 'handleFilterReady' como 'prop' para establecer comunicación desde el hijo hacia este componente padre */}
      <SidebarFilter onFilterReady={handleFilterReady} />

      {/* SECCIÓN 2: ÁREA DE TRABAJO (MAIN DASHBOARD) */}
      {/* 'flex-1' permite que esta sección ocupe todo el ancho restante de la pantalla */}
      <main className="flex-1 p-8 overflow-y-auto">

        {/* Cabecera Principal (Estilo Telemetría 2010-2012) */}
        <header className="mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            Performance <span className="text-red-600 font-extrabold">Analysis</span>
          </h1>

          {/* Subtítulo dinámico: Cambia dependiendo de si el usuario ha enviado filtros o no */}
          <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">
            {activeFilters
              ? `ACTIVE SESSION: SEASON ${activeFilters.year} | ROUND ${activeFilters.round} | ${activeFilters.session}`
              : "TELEMETRY SYSTEM: AWAITING SESSION SELECTION..."
            }
          </p>
        </header>

        {/* ZONA DE VISUALIZACIÓN DE DATOS */}
        {/* Aquí inyectamos el componente de la tabla, pasándole los filtros actuales.
            La propia tabla maneja sus estados de carga y pantallas vacías de forma independiente. */}
        <section className="h-[75vh] flex flex-col gap-6">
          <TelemetryTable filters={activeFilters} />
          <SummaryStatistics filters={activeFilters} />

        </section>

      </main>
    </div>
  );
}

export default App;