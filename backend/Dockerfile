# backend/Dockerfile

# 1. Usar una imagen oficial de Node.js como base. 'alpine' es una versión muy ligera.
FROM node:18-alpine AS base

# 2. Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiar los archivos de dependencias
# Se copian primero para aprovechar el caché de Docker. Si no cambian, no se reinstala todo.
COPY package*.json ./

# 4. Instalar dependencias de producción de forma limpia
# 'npm ci' es más rápido y seguro para producción que 'npm install'
RUN npm ci --only=production

# 5. Copiar el resto del código de la aplicación
COPY . .

# 6. Exponer el puerto en el que corre tu app (según tu .env es el 3001)
EXPOSE 3001

# 7. El comando para iniciar la aplicación cuando se ejecute el contenedor
CMD [ "node", "app.js" ]