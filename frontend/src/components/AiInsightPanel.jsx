// Panel desplegable que muestra el resultado del análisis con IA.
// Incluye estados de carga, error y el texto generado.
// Reutilizable en cualquier vista: recibe las props del hook useAiAnalysis.

export default function AiInsightPanel({ analysis, isLoading, error, onClose }) {

    // No renderiza nada si no hay contenido que mostrar.
    if (!analysis && !isLoading && !error) return null;

    return (
        <div className="mx-5 mb-4 border border-purple-900/60 bg-purple-950/10 rounded overflow-hidden">

            {/* --- Cabecera --- */}

            <div className="flex items-center justify-between px-4 py-2 bg-purple-950/30 border-b border-purple-900/40">
                <div className="flex items-center gap-2">
                    <span className="text-purple-400 text-sm">✦</span>
                    <span className="text-purple-300 text-xs font-bold uppercase tracking-widest">
                        AI Analysis
                    </span>
                </div>
                {!isLoading && (
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 text-xs font-mono transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* --- Contenido --- */}

            <div className="px-4 py-3">

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center gap-3 py-4">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-purple-400 text-sm font-mono animate-pulse">
                            Generating analysis...
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && !isLoading && (
                    <p className="text-red-400 text-sm font-mono">{error}</p>
                )}

                {/* Texto del análisis */}
                {analysis && !isLoading && (
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                        {analysis}
                    </p>
                )}
            </div>
        </div>
    );
}