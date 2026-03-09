FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npx prisma generate || true
EXPOSE ${PORT:-3000}
CMD ["node", "src/index.js"]
