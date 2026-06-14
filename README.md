# PitWall — Plataforma de Análisis de Telemetría de Fórmula 1

Plataforma local de análisis de telemetría de Fórmula 1 desarrollada como
Trabajo de Fin de Grado del Grado en Ingeniería Informática-TI.

Frente a alternativas web como Tracing Insights, esta solución ofrece:

- **Ejecución 100% local** sin dependencia de servidor ni rate limits.
- **Caché persistente** con FastF1 para consultas instantáneas.
- **Análisis asistido por IA** con Gemini para usuarios no técnicos.
- **Arquitectura abierta y extensible** basada en DTOs y separación por capas.

## Stack tecnológico

- **Backend**: Python 3.11+, FastAPI, FastF1, Pydantic v2, Uvicorn
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts
- **IA**: Google Gemini Flash Lite (API REST vía httpx)
- **Infraestructura**: Docker, Docker Compose, Nginx

## Estructura del proyecto

```
PitWall/
├── backend/
│   ├── main.py              # Entry point FastAPI
│   ├── config.py            # Constantes globales y configuración
│   ├── Dockerfile
│   ├── routers/             # Endpoints HTTP agrupados por dominio
│   ├── services/            # Lógica de negocio
│   ├── dtos/                # Contratos de datos (Pydantic v2)
│   ├── core/                # Caché, session loader, Gemini client
│   ├── utils/               # Helpers de formato
│   └── tests/               # Tests con pytest
├── frontend/
│   ├── Dockerfile           # Multi-stage: Node build + Nginx serve
│   ├── nginx.conf           # Configuración SPA
│   └── src/
│       ├── App.jsx          # Componente raíz
│       ├── features/        # Vistas por dominio
│       └── test/            # Tests con Vitest
├── docker-compose.yml
└── README.md
```

## Ejecución

### Docker (recomendado)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend / Swagger: http://localhost:8000/docs

### Desarrollo local

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate  # Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env  # configurar GEMINI_API_KEY
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend / Swagger: http://localhost:8000/docs

## Tests

```bash
# Backend (77 tests)
cd backend && pytest

# Frontend (104 tests)
cd frontend && npm test
```

## Autor

José Moreno González