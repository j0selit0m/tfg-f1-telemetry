# Imagen base de Python 3.11 (versión slim para reducir tamaño)
FROM python:3.11-slim

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar e instalar dependencias antes del código fuente.
# Docker cachea esta capa: si requirements.txt no cambia,
# no reinstala las dependencias en cada build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código del backend
COPY . .

EXPOSE 8000

# Arrancar el servidor Uvicorn accesible desde fuera del contenedor
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]