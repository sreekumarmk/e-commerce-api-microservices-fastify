import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import Redis from 'ioredis';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
app.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3003'],
  credentials: true
});
const prisma = new PrismaClient();
app.decorate('prisma', prisma);
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
app.decorate('redis', redis);

async function publishEvent(event, data){
  await redis.xadd('product_events', '*', 'event', event, 'data', JSON.stringify(data));
}

async function dispatchWebhook(payload){
  const subs = await prisma.webhookSubscription.findMany();
  for (const s of subs){
    try {
      await axios.post(s.url, payload, { timeout: 5000 });
    } catch (e){
      app.log.error('webhook failed', s.url, e.message);
      await redis.xadd('webhook_retry', '*', 'url', s.url, 'payload', JSON.stringify(payload));
    }
  }
}

app.get('/list', async () => prisma.product.findMany());

app.get('/:id', async (req, reply) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }});
  if (!p) return reply.code(404).send({ error: 'not found' });
  return p;
});

app.post('/create', async (req) => {
  const created = await prisma.product.create({ data: req.body });
  await publishEvent('PRODUCT.CREATED', created);
  await dispatchWebhook({ event: 'PRODUCT.CREATED', data: created });
  return created;
});

app.patch('/update/:id', async (req) => {
  const updated = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  await publishEvent('PRODUCT.UPDATED', updated);
  await dispatchWebhook({ event: 'PRODUCT.UPDATED', data: updated });
  return updated;
});

app.post('/reserve', async (req, reply) => {
  console.log('Reserving stock for product:', req.body);
  const { productId, quantity } = req.body;
  try {
    const res = await prisma.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId }});
      if (!p) throw new Error('Not found');
      if (p.stock < quantity) throw new Error('Insufficient stock');
      return await tx.product.update({ where: { id: productId }, data: { stock: p.stock - quantity }});
    });
    await publishEvent('PRODUCT.STOCK.UPDATED', { id: res.id, stock: res.stock });
    await dispatchWebhook({ event: 'PRODUCT.STOCK.UPDATED', data: { id: res.id, stock: res.stock }});
    return res;
  } catch (e) {
    return reply.code(400).send({ error: e.message });
  }
});

app.post('/webhooks/register', async (req) => {
  const { service, url } = req.body;
  const exists = await prisma.webhookSubscription.findFirst({ where: { service, url }});
  if (exists) return exists;
  return prisma.webhookSubscription.create({ data: { service, url }});
});

const start = async () => {
  await prisma.$connect();
  await app.listen({ port: process.env.PORT || 3002, host: '0.0.0.0' });
  app.log.info('Product service listening');
};
start();
