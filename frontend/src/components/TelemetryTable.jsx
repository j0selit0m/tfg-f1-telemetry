import { useState, useEffect, useMemo } from 'react';

export default function TelemetryTable({ filters }) {
    // 1. ESTADOS LOCALES (State Management)
    // lapData almacena la respuesta cruda de la API. isLoading maneja la UI de carga.
    const [lapData, setLapData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // 2. EFECTO SECUNDARIO: CONSUMO DE LA API (Data Fetching)
    // Este useEffect se ejecuta cada vez que el objeto 'filters' cambia.
    useEffect(() => {
        // Programación defensiva: Si no hay parámetros válidos, limpiamos y abortamos.
        if (!filters || !filters.driver) {
            setLapData([]);
            return;
        }

        setIsLoading(true);
        const { year, round, session, driver } = filters;
        const API_BASE = 'http://localhost:8000/api';

        // Llamada HTTP al backend (FastAPI)
        fetch(`${API_BASE}/analysis/${year}/${round}/${session}/laps?drivers=${driver}`)
            .then(res => res.json())
            .then(data => {
                setLapData(data); // Guardamos el JSON crudo en el estado
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Error cargando la telemetría:", err);
                setIsLoading(false);
            });
    }, [filters]);

    // 3. MOTOR DE TRANSFORMACIÓN (Data Pivoting)
    // useMemo memoriza este cálculo. Solo se vuelve a calcular si 'lapData' cambia.
    // Transformamos una lista plana [{ALO, Lap 1}, {VER, Lap 1}] a un diccionario agrupado por vuelta.
    const pivotedLaps = useMemo(() => {
        if (!lapData || lapData.length === 0) return [];

        const grouped = {};
        lapData.forEach(lap => {
            // Si la vuelta (ej. Vuelta 54) no existe en nuestro objeto, la inicializamos
            if (!grouped[lap.LapNumber]) {
                grouped[lap.LapNumber] = { lapNumber: lap.LapNumber, drivers: {} };
            }
            // Insertamos los datos del piloto dentro de esa vuelta
            grouped[lap.LapNumber].drivers[lap.Driver] = lap;
        });

        // Convertimos el objeto a un array y lo ordenamos cronológicamente (Vuelta 1, 2, 3...)
        return Object.values(grouped).sort((a, b) => a.lapNumber - b.lapNumber);
    }, [lapData]);

    // Extraemos un array con los nombres de los pilotos para generar las columnas (Eje X)
    const activeDriverKeys = filters?.driver ? filters.driver.split(',') : [];

    // 4. FUNCIONES DE APOYO VISUAL (Design System Helpers)

    // A) Traductor de Neumáticos (Retorna letra y clases CSS de colores)
    const getCompoundInfo = (compound) => {
        const compMap = {
            SOFT: { letter: 'S', colorClass: 'border-red-600 text-red-500' },
            MEDIUM: { letter: 'M', colorClass: 'border-yellow-400 text-yellow-400' },
            HARD: { letter: 'H', colorClass: 'border-gray-200 text-gray-200' },
            INTERMEDIATE: { letter: 'I', colorClass: 'border-green-500 text-green-500' },
            WET: { letter: 'W', colorClass: 'border-blue-600 text-blue-500' },
            UNKNOWN: { letter: 'X', colorClass: 'border-purple-500 text-purple-500' }
        };
        return compMap[compound?.toUpperCase()] || compMap['UNKNOWN'];
    };

    // B) Renderizador de LEDs de Estado de Pista
    const renderTrackStatusDots = (trackStatus) => {
        if (!trackStatus) return null; // Si no hay dato, no pinta nada

        // Convertimos de forma segura a String para evitar errores y separamos por caracteres
        const statusArray = String(trackStatus).split('');

        return (
            <div className="flex gap-1 items-center" title={`Secuencia de pista: ${trackStatus}`}>
                {statusArray.map((status, index) => {
                    let dotStyle = 'bg-green-500 shadow-[0_0_4px_#22c55e]'; // Estado 1 (Pista Libre) por defecto

                    if (status === '2') dotStyle = 'bg-yellow-400 shadow-[0_0_4px_#facc15]';
                    else if (status === '3') dotStyle = 'bg-gray-500'; // Sectores despejándose
                    else if (status === '4') dotStyle = 'bg-orange-500 shadow-[0_0_4px_#f97316]'; // Safety Car
                    else if (status === '5') dotStyle = 'bg-red-600 shadow-[0_0_4px_#dc2626]'; // Bandera Roja
                    else if (status === '6' || status === '7') dotStyle = 'border border-orange-400 bg-transparent'; // VSC

                    return <div key={index} className={`w-1.5 h-1.5 rounded-full ${dotStyle}`}></div>;
                })}
            </div>
        );
    };

    // 5. RENDERIZADO DEL COMPONENTE (UI)
    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0c] border border-gray-800 shadow-2xl font-sans text-gray-200">

            {/* 5.1 HEAD-UP DISPLAY (Leyenda Fija) */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700 p-5 shrink-0">
                <h3 className="text-red-600 font-black italic uppercase tracking-widest text-xl mb-4 border-b border-gray-800 pb-2">
                    Data Display Legend
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Bloque 1: Compuestos de Neumáticos */}
                    <div className="space-y-4">
                        <div>
                            <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Tire Compounds</span>
                            <div className="flex flex-wrap gap-3">
                                <span className="flex items-center text-sm font-bold text-gray-300">
                                    <div className="w-5 h-5 flex items-center justify-center rounded-full border-[3px] border-red-600 bg-[#1a1a1a] mr-1.5"><span className="font-black text-[9px] text-red-500">S</span></div> Soft
                                </span>
                                {/* ... (el resto de ruedas de la leyenda se mantiene igual) ... */}
                                <span className="flex items-center text-sm font-bold text-gray-300">
                                    <div className="w-5 h-5 flex items-center justify-center rounded-full border-[3px] border-yellow-400 bg-[#1a1a1a] mr-1.5"><span className="font-black text-[9px] text-yellow-400">M</span></div> Medium
                                </span>
                                <span className="flex items-center text-sm font-bold text-gray-300">
                                    <div className="w-5 h-5 flex items-center justify-center rounded-full border-[3px] border-gray-200 bg-[#1a1a1a] mr-1.5"><span className="font-black text-[9px] text-gray-200">H</span></div> Hard
                                </span>
                                <span className="flex items-center text-sm font-bold text-gray-300">
                                    <div className="w-5 h-5 flex items-center justify-center rounded-full border-[3px] border-green-500 bg-[#1a1a1a] mr-1.5"><span className="font-black text-[9px] text-green-500">I</span></div> Inter
                                </span>
                                <span className="flex items-center text-sm font-bold text-gray-300">
                                    <div className="w-5 h-5 flex items-center justify-center rounded-full border-[3px] border-blue-600 bg-[#1a1a1a] mr-1.5"><span className="font-black text-[9px] text-blue-500">W</span></div> Wet
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-6 mt-2">
                            <span className="flex items-center text-sm font-mono text-gray-300"><span className="px-2 py-0.5 bg-gray-800 text-white font-bold rounded-sm mr-2 border border-gray-600">S1</span> Stint Num</span>
                            <span className="flex items-center text-sm font-mono text-gray-300"><span className="px-2 py-0.5 bg-gray-800 text-red-400 font-bold rounded-sm mr-2 border border-gray-600">L12</span> Tire Age</span>
                        </div>
                    </div>

                    {/* Bloque 2: Código LED de Track Status */}
                    <div>
                        <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Track Status Sequence</span>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-green-500 shadow-[0_0_4px_#22c55e] rounded-full mr-2"></span> Clear
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2 shadow-[0_0_4px_#facc15]"></span> Yellow
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 shadow-[0_0_4px_#f97316]"></span> Safety Car
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 bg-red-600 rounded-full mr-2 shadow-[0_0_4px_#dc2626]"></span> Red Flag
                            </span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="w-2 h-2 border-2 border-orange-400 rounded-full bg-transparent mr-2"></span> Virtual SC
                            </span>
                        </div>
                    </div>

                    {/* Bloque 3: Eventos y Posiciones */}
                    <div>
                        <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Events & Positions</span>
                        <div className="flex flex-col gap-2">
                            <span className="flex items-center text-sm font-mono text-gray-300"><span className="text-purple-400 mr-3 font-black text-lg">⚡</span> Personal Best</span>
                            <span className="flex items-center text-sm font-mono text-gray-300"><span className="text-blue-500 mr-3 font-black text-lg">📥</span> Pit Stop</span>
                            <span className="flex items-center text-sm font-mono text-gray-300"><span className="text-gray-500 line-through mr-3">1:35.000</span> Invalid Lap</span>
                            <span className="flex items-center text-sm font-mono text-gray-300">
                                <span className="px-2 py-0.5 bg-gray-800 text-gray-300 font-bold rounded-sm mr-2 border border-gray-600">P1</span>
                                <span className="text-green-500 font-black mr-1 text-xs">▲1</span>
                                <span className="text-red-500 font-black mr-2 text-xs">▼2</span>
                                Position Delta
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5.2 ÁREA DINÁMICA DE LA TABLA */}
            <div className="flex-1 overflow-auto bg-[#0a0a0c] relative">

                {/* Renderizado Condicional: Pantalla de Carga */}
                {isLoading && (
                    <div className="absolute inset-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <div className="text-red-600 font-mono text-lg uppercase tracking-widest animate-pulse">Processing Telemetry...</div>
                    </div>
                )}

                {/* Renderizado Condicional: Estado Vacío (Sin Pilotos) */}
                {!isLoading && (!filters || !filters.driver || lapData.length === 0) ? (
                    <div className="flex h-full items-center justify-center flex-col opacity-50">
                        <span className="text-6xl mb-4">🏎️</span>
                        <h2 className="text-2xl font-black italic uppercase tracking-widest text-gray-500">Telemetry Standby</h2>
                        <p className="text-sm font-mono text-gray-600 mt-2">Selecciona parámetros y pilotos en el panel lateral para iniciar el análisis.</p>
                    </div>
                ) : (
                    /* Renderizado Principal: Tabla de Datos */
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 sticky top-0 z-10 shadow-lg">
                            <tr>
                                {/* Cabecera Eje Y: Vueltas */}
                                <th className="p-4 w-20 border-r border-b-2 border-gray-700 text-center text-sm uppercase font-black tracking-widest text-gray-400 bg-black">
                                    LAP
                                </th>

                                {/* Cabecera Eje X: Generación dinámica de columnas por piloto */}
                                {activeDriverKeys.map(driver => (
                                    <th key={driver} className="p-4 border-r border-b-2 border-gray-700 text-center bg-gray-900 min-w-[280px]">
                                        <span className="text-2xl font-black italic uppercase text-white tracking-tighter">
                                            {driver}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="font-mono">
                            {/* Iteramos sobre nuestro objeto pivotado (Vuelta 1, Vuelta 2...) */}
                            {pivotedLaps.map((lapRow, index) => (
                                <tr key={lapRow.lapNumber} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">

                                    {/* Celda indicadora del número de vuelta */}
                                    <td className="p-3 border-r border-gray-800 text-center bg-black/50">
                                        <span className="text-lg font-black text-gray-400">{lapRow.lapNumber}</span>
                                    </td>

                                    {/* Iteramos sobre los pilotos activos para buscar si tienen datos en esta vuelta concreta */}
                                    {activeDriverKeys.map(driverAbbr => {
                                        const data = lapRow.drivers[driverAbbr];

                                        // Si el piloto abandonó o no tiene tiempo, renderizamos una celda vacía
                                        if (!data) return <td key={driverAbbr} className="p-3 border-r border-gray-800 bg-gray-900/10 text-center text-gray-700 text-lg">-</td>;

                                        // Lógica para calcular posiciones ganadas o perdidas respecto a la vuelta anterior
                                        let posDelta = 0;
                                        if (index > 0) {
                                            const prevLapData = pivotedLaps[index - 1].drivers[driverAbbr];
                                            if (prevLapData && prevLapData.Position && data.Position) {
                                                posDelta = prevLapData.Position - data.Position;
                                            }
                                        }

                                        const compInfo = getCompoundInfo(data.Compound);
                                        const isPB = data.IsPersonalBest && !data.Deleted;

                                        return (
                                            <td key={driverAbbr} className={`p-3 border-r border-gray-800 relative ${data.Deleted ? 'opacity-30' : ''}`}>
                                                <div className="pl-2 pr-2 py-1 flex flex-col gap-2">

                                                    {/* Llamada al renderizador de LEDs de estado de pista */}
                                                    <div className="flex justify-end w-full mb-1">
                                                        {renderTrackStatusDots(data.TrackStatus)}
                                                    </div>

                                                    {/* Fila superior de la celda: Posición, Eventos en Pit, y Tiempo */}
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs bg-gray-800 px-2 py-1 rounded-sm text-gray-300 font-bold border border-gray-700">P{data.Position}</span>
                                                            {/* Renderizado condicional del Delta de Posición */}
                                                            {posDelta > 0 && <span className="text-[11px] font-black text-green-500">▲{posDelta}</span>}
                                                            {posDelta < 0 && <span className="text-[11px] font-black text-red-500">▼{Math.abs(posDelta)}</span>}
                                                            {posDelta === 0 && index > 0 && <span className="text-[11px] font-bold text-gray-600">-</span>}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* Renderizado de eventos y tachado si la vuelta fue eliminada */}
                                                            {isPB && <span className="text-purple-400 text-xl" title="Personal Best">⚡</span>}
                                                            {data.PitIn && <span className="text-blue-500 text-xl animate-pulse" title="Pit In">📥</span>}
                                                            {data.PitOut && <span className="text-blue-500 text-xl" title="Pit Out">📤</span>}
                                                            <span className={`text-xl font-black tracking-tighter ${isPB ? 'text-purple-400' : 'text-white'} ${data.Deleted ? 'line-through text-gray-500' : ''}`}>
                                                                {data.LapTime || 'NO TIME'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Fila inferior de la celda: Microsectores y desgaste de Neumáticos */}
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div className="flex gap-3 text-xs text-gray-500 font-semibold">
                                                            <span>S1: <span className="text-gray-200">{data.Sector1 || '-'}</span></span>
                                                            <span>S2: <span className="text-gray-200">{data.Sector2 || '-'}</span></span>
                                                            <span>S3: <span className="text-gray-200">{data.Sector3 || '-'}</span></span>
                                                        </div>

                                                        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded p-1">
                                                            <span className="text-xs px-1.5 font-bold text-gray-400">S{data.Stint}</span>
                                                            {/* Si el neumático tiene más de 15 vueltas, alertamos en color rojo */}
                                                            <span className={`text-xs px-1.5 font-bold border-l border-r border-gray-700 ${data.TyreLife > 15 ? 'text-red-400' : 'text-gray-200'}`}>L{data.TyreLife}</span>
                                                            {/* Renderizado de la Rueda Pirelli mediante CSS */}
                                                            <div className={`w-6 h-6 flex items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-inner ${compInfo.colorClass}`} title={`Compound: ${data.Compound}`}>
                                                                <span className="font-black text-[10px] leading-none">{compInfo.letter}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}