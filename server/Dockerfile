FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# Cloud Run sets PORT itself and expects the container to listen on it.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
