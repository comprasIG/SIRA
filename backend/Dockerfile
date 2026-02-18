#C:\SIRA\backend\Dockerfile

# 1. Usar la imagen base de Alpine
FROM node:22-alpine AS base

# 2. Establecer el directorio de trabajo
WORKDIR /app

# 3. Copiar los archivos de dependencias
COPY package*.json ./

# 4. Instalar dependencias de producción
RUN npm ci --only=production

# 5. Copiar el resto del código
COPY . .

# 6. Exponer el puerto
EXPOSE 3001

# 7. El comando para iniciar la aplicación
CMD [ "node", "app.js" ]