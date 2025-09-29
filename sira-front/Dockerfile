#C:\SIRA\sira-front\Dockerfile
# Dockerfile
# 1) Build: compila tu app con Vite
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Serve: usa Nginx para entregar la carpeta dist
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copiamos nuestra configuración personalizada de NGINX para que funcione como SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]