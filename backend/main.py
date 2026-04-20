from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TFG Formula 1 API")

# Configuración de CORS específica para Vite
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.get("/api/status")
async def get_status():
    return {
        "status": "online", 
        "message": "¡Vite (React) y FastAPI están comunicándose perfectamente en el box!",
        "project": "TFG Formula 1"
    }