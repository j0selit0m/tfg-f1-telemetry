import { useState } from 'react';

export default function AiInsightPanel({
    show,
    onAnalyse,
    analysis,
    isLoading,
    error,
}) {
    const [expanded, setExpanded] = useState(true);

    const handleAnalyse = () => {
        setExpanded(true);
        onAnalyse();
    };

    if (!show) return null;

    const hasResult = !!(analysis || error);

    return (
        <div className="shrink-0 border-b border-gray-800">

            {/* Barra fija con descripción y botón */}
            <div className="flex items-center gap-4 px-5 py-3 bg-[#111318]">
                <span className="text-amber-400 text-base shrink-0">✦</span>
                <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-xs font-bold uppercase tracking-widest">
                        AI Analysis
                    </p>
                    <p className="text-gray-500 text-xs font-mono mt-0.5 truncate">
                        New to F1 data? Get a plain-English explanation of what you're seeing.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleAnalyse}
                    disabled={isLoading}
                    className="shrink-0 flex items-center gap-2 px-4 py-1.5 border
                               border-amber-700/60 text-amber-400 text-xs font-bold
                               uppercase tracking-widest hover:border-amber-500
                               hover:text-amber-300 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <span className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                            Analyzing...
                        </>
                    ) : 'Explain this'}
                </button>
            </div>

            {/* Panel colapsable */}
            {hasResult && (
                <div className="bg-[#0d0f14] border-t border-gray-800/60">

                    {/* Cabecera toggle */}
                    <button
                        type="button"
                        onClick={() => setExpanded(v => !v)}
                        className="w-full flex items-center gap-2 px-5 py-2
                                   hover:opacity-70 transition-opacity text-left"
                    >
                        <span className="text-amber-400/60 text-xs">✦</span>
                        <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">
                            AI Insight
                        </span>
                        <span
                            className="text-gray-500 text-xs ml-1"
                            style={{
                                display: 'inline-block',
                                transition: 'transform 0.2s',
                                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                        >
                            ▲
                        </span>
                    </button>

                    {/* Contenido */}
                    {expanded && (
                        <div className="px-5 pb-4">
                            {error && (
                                <p className="text-red-400 text-sm font-mono">{error}</p>
                            )}
                            {analysis && (
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                                    {analysis}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}