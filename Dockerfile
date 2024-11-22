# Usar una imagen base de Node.js
FROM node:18-slim

# Instalar dependencias necesarias
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.12.0/rhubarb-linux -o /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb

# Crear el directorio de la aplicación
WORKDIR /app

# Copiar archivos de la aplicación
COPY package.json yarn.lock ./
RUN yarn install

COPY . .

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "index.js"]
