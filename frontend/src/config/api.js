// URL base del backend. Configurable vía variable de entorno VITE_API_BASE.
// Si no está definida, se usa el valor por defecto para desarrollo local.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';