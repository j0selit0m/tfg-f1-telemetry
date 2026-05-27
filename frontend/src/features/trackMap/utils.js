// Utilidades puras para el renderizado del mapa de circuito.

// Calcula los límites XY del trazado a partir de los puntos del backend.
export function getXYBounds(points) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const pt of points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
    }
    return { minX, maxX, minY, maxY };
}

// Parámetros de normalización derivados de los bounds y el viewBox.
// Se calculan una vez y se reutilizan tanto para los puntos del trazado
// como para las posiciones de las curvas.
export function getNormParams(bounds, vbW, vbH, padding) {
    const { minX, maxX, minY, maxY } = bounds;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const availW = vbW - 2 * padding;
    const availH = vbH - 2 * padding;
    const scale = Math.min(availW / rangeX, availH / rangeY);
    const offsetX = padding + (availW - rangeX * scale) / 2;
    const offsetY = padding + (availH - rangeY * scale) / 2;
    return { scale, offsetX, offsetY, minX, minY, vbH };
}

// Normaliza un array de puntos a coordenadas SVG manteniendo el aspect ratio.
// Invierte el eje Y porque SVG y=0 está arriba.
export function normalizePoints(points, params) {
    const { scale, offsetX, offsetY, minX, minY, vbH } = params;
    return points.map(pt => ({
        ...pt,
        nx: offsetX + (pt.x - minX) * scale,
        ny: vbH - (offsetY + (pt.y - minY) * scale),
    }));
}

// Normaliza un único punto X/Y usando los mismos parámetros que el trazado.
// Usado para posicionar los badges de curva en el mismo sistema de coordenadas.
export function normalizeXY(x, y, params) {
    const { scale, offsetX, offsetY, minX, minY, vbH } = params;
    return {
        nx: offsetX + (x - minX) * scale,
        ny: vbH - (offsetY + (y - minY) * scale),
    };
}