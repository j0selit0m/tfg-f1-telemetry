# TFG Formula 1 — Plataforma de Análisis de Telemetría

Plataforma local de análisis de telemetría de Fórmula 1 desarrollada como
Trabajo de Fin de Grado del Grado en Ingeniería Informática.

Frente a alternativas web como Tracing Insights, esta solución ofrece:

- **Ejecución 100% local** sin dependencia de servidor ni rate limits.
- **Caché persistente** con FastF1 para consultas instantáneas.
- **Stack Python end-to-end** sobre la fuente original de datos.
- **Arquitectura abierta y extensible** basada en DTOs y separación por capas.

## Stack tecnológico

- **Backend**: Python 3.11+, FastAPI, FastF1, Pydantic, Uvicorn
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts
- **Arquitectura**: Separación en capas con DTOs (routers → services → DTOs)

## Estructura del proyecto

\`\`\`
TFG-F1/
├── backend/
│   ├── main.py              # Entry point FastAPI
│   ├── config.py            # Constantes globales y configuración
│   ├── routers/             # Endpoints HTTP agrupados por dominio
│   ├── services/            # Lógica de negocio
│   ├── dtos/                # Contratos de datos (Pydantic)
│   ├── core/                # Caché, session loader, colores
│   ├── utils/               # Helpers de formato
│   └── scripts/             # Scripts auxiliares (fastf1_tester)
├── frontend/
│   └── src/
│       ├── App.jsx          # Componente raíz
│       ├── config/api.js    # Punto único de configuración de red
│       └── features/        # Vistas por dominio
└── README.md
\`\`\`

## Requisitos previos

- Python 3.11 o superior
- Node.js 20.19+ y npm
- ~5 GB libres para la caché de FastF1

## Instalación

### Backend

\`\`\`bash
cd backend
python -m venv venv

# Activar entorno virtual:
# Windows:
venv\\Scripts\\activate
# Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt

# Configurar variables de entorno
copy .env.example .env       # Windows
# cp .env.example .env       # Linux/Mac
# Editar .env y ajustar FASTF1_CACHE_HDD_PATH si procede
\`\`\`

### Frontend

\`\`\`bash
cd frontend
npm install

# (Opcional) configurar URL del backend
copy .env.example .env       # Windows
# cp .env.example .env       # Linux/Mac
\`\`\`

## Ejecución

### Backend

\`\`\`bash
cd backend
# Con el venv activado
uvicorn main:app --reload
\`\`\`

- API: http://localhost:8000
- Documentación Swagger: http://localhost:8000/docs

### Frontend

\`\`\`bash
cd frontend
npm run dev
\`\`\`

Aplicación: http://localhost:5173

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `FASTF1_CACHE_HDD_PATH` | Ruta preferida para la caché (HDD externo) | `E:\\TFG_F1_Cache` |
| `FASTF1_CACHE_LOCAL_PATH` | Ruta de caché alternativa (local) | `fastf1_cache_local` |
| `CORS_ORIGINS` | Orígenes CORS permitidos, separados por coma | `http://localhost:5173,http://127.0.0.1:5173` |

### Frontend (`frontend/.env`)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `VITE_API_BASE` | URL base del backend | `http://localhost:8000/api` |

## Endpoints principales

- `GET /api/schedule/{year}` — calendario de la temporada
- `GET /api/schedule/{year}/{event}/sessions` — sesiones de un GP
- `GET /api/session/{year}/{event}/{session}/drivers` — pilotos y colores
- `GET /api/analysis/{year}/{event}/{session}/laps` — vueltas agrupadas
- `GET /api/analysis/{year}/{event}/{session}/summary` — estadísticas resumen
- `GET /api/analysis/{year}/{event}/{session}/stints` — métricas por stint
- `GET /api/telemetry/{year}/{event}/full` — telemetría completa

Para detalles y ejemplos, consultar `/docs` (Swagger UI) con el backend en marcha.

## Tests

(Sección pendiente)

## Autor

José Moreno González

## Referencias

- [FastF1 — Documentación oficial](https://docs.fastf1.dev/)
- [FastAPI — Documentación oficial](https://fastapi.tiangolo.com/)
- [React — Documentación oficial](https://react.dev/)
