// Línea vertical de crosshair controlada imperativamente vía ref.
// Vive como overlay absoluto encima de cada chart. Su posición se actualiza
// por manipulación directa del DOM, sin pasar por React state.
// Esto elimina el re-render de Recharts en cada movimiento del ratón.

import { forwardRef, useImperativeHandle, useRef } from 'react';

const CrosshairOverlay = forwardRef(function CrosshairOverlay(_, ref) {
    const lineRef = useRef(null);

    useImperativeHandle(ref, () => ({
        // Mueve la línea a un porcentaje del ancho del contenedor.
        // pct = null la oculta.
        setPercent(pct) {
            const el = lineRef.current;
            if (!el) return;
            if (pct === null || pct === undefined) {
                el.style.opacity = '0';
            } else {
                el.style.opacity = '1';
                el.style.left = `${pct}%`;
            }
        }
    }));

    return (
        <div
            ref={lineRef}
            className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-10"
            style={{ opacity: 0 }}
        />
    );
});

export default CrosshairOverlay;