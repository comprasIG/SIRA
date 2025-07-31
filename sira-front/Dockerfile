# Dockerfile
FROM node:18-alpine

# 1. Directorio de trabajo en el contenedor
WORKDIR /app

# 2. Copiamos sólo package.json para cachear npm install
COPY package.json package-lock.json* ./

# 3. Instalamos dependencias
RUN npm ci

# 4. Copiamos el resto del código
COPY . .

# 5. Exponemos el puerto de Vite
EXPOSE 5173

# 6. Arrancamos el dev-server
CMD ["npm", "run", "dev"]
