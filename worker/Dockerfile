FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
EXPOSE ${PORT:-3000}
CMD ["node", "src/index.js"]
