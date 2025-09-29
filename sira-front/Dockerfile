#C:\SIRA\sira-front\Dockerfile
# Dockerfile
# ---- Etapa 1: Construcción (Build) ----
# Esta etapa se queda igual, ¡estaba perfecta!
FROM node:18-alpine AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

RUN echo ">>>>>> VITE_API_URL DENTRO DEL BUILD ES: $VITE_API_URL <<<<<<"

RUN npm run build

# ---- Etapa 2: Producción (Serve) ----
FROM nginx:1.25-alpine

# ---- INICIO DE CAMBIOS ----

# 1. Instalamos 'gettext' que nos da la herramienta 'envsubst'
# para sustituir variables de entorno en archivos.
RUN apk add --no-cache gettext

COPY --from=build /app/dist /usr/share/nginx/html

# 2. Copiamos nuestra configuración de NGINX como una plantilla.
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# 3. Copiamos y damos permisos de ejecución a nuestro script de inicio.
COPY start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# 4. Exponemos el puerto que Cloud Run usará por defecto.
EXPOSE 8080

# 5. Usamos nuestro script personalizado para iniciar el contenedor.
CMD ["/start-nginx.sh"]

