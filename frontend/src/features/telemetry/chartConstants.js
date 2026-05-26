// Fuente única de verdad para las dimensiones de los charts de telemetría.
// Cambiar aquí actualiza charts + hook de zoom + handler de crosshair.

export const CHART_MARGIN = { top: 32, right: 8, left: 30, bottom: 20 };

// Margen inferior compacto para charts sin eje X (solo el último lo muestra).
export const CHART_MARGIN_BOTTOM_COMPACT = 6;

// Ancho fijo del eje Y. Auto-width de Recharts daba ~60px empíricamente
// (30 margen externo + 60 eje Y = 90px de offset total medido en browser).
export const Y_AXIS_WIDTH = 60;

// Offset real del área de plot respecto al borde izquierdo del contenedor.
export const PLOT_LEFT_OFFSET = CHART_MARGIN.left + Y_AXIS_WIDTH; // 90
export const PLOT_RIGHT_OFFSET = CHART_MARGIN.right;               // 8

// Alturas por canal. Los binarios (brake, drs) son bajos porque solo
// muestran dos estados y no necesitan espacio vertical extra.
export const CHART_HEIGHTS = {
    speed:    420,
    throttle: 220,
    brake:    130,
    rpm:      220,
    gear:     180,
    drs:      130,
};