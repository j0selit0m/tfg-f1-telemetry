# --- Fase 1: Build ---
# Compila el frontend de React en archivos estáticos (HTML, JS, CSS)
FROM node:20-alpine AS build

WORKDIR /app

# Instalar dependencias (cacheadas si package.json no cambia)
COPY package.json package-lock.json ./
RUN npm ci

# URL del backend inyectada en build time
ARG VITE_API_BASE=http://localhost:8000/api
ENV VITE_API_BASE=$VITE_API_BASE

# Copiar código fuente y generar el build de producción
COPY . .
RUN npm run build

# --- Fase 2: Serve ---
# Servir los archivos estáticos con Nginx (imagen ligera, ~5MB)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]