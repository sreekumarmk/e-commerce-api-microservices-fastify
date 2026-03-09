# Fastify Microservices with Postgres, Redis, Prisma

Services included:
- api-gateway
- auth-service (Prisma + Postgres)
- product-service (Prisma + Postgres, Redis Streams, Webhooks)
- order-service (Prisma + Postgres, consumes Redis Streams)
- cart-service (Redis)
- worker (background retry for webhooks)

Quickstart (dev):
1. Start docker services:
   docker compose up --build

2. For each service with Prisma (auth-service, product-service, order-service):
   cd <service>
   npx prisma generate
   npx prisma db push
   node prisma/seed.js  # if exists

Notes:
- Each Prisma datasource uses the same Postgres DB but different schema via DATABASE_URL query param in docker-compose.
- Secure secrets and production configurations before deploying.
