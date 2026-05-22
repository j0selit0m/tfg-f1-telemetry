// Contenedor de cada gráfico. Registra el wheel handler con { passive: false }
// para permitir preventDefault y propaga los eventos de ratón al sistema de zoom/pan.

import { memo, useRef, useEffect } from 'react';

const ChartWrapper = memo(function ChartWrapper({
    height, buildWheelHandler,
    handleMouseDown, handleMouseMove, handleMouseUp,
    onDoubleClick, onMouseLeave, children,
}) {
    const nodeRef = useRef(null);

    useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;
        const handler = buildWheelHandler(() => node.getBoundingClientRect());
        node.addEventListener('wheel', handler, { passive: false });
        return () => node.removeEventListener('wheel', handler);
    }, [buildWheelHandler]);

    return (
        <div
            ref={nodeRef}
            style={{ width: '100%', height, cursor: 'crosshair', userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={onDoubleClick}
            onMouseLeave={onMouseLeave}
        >
            {children}
        </div>
    );
});

export default ChartWrapper;