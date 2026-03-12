import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import Redis from 'ioredis';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

const app = Fastify({ logger: true });
app.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
});

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'change_this_secret'
});
const prisma = new PrismaClient();
app.decorate('prisma', prisma);
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
app.decorate('redis', redis);

app.addHook('onRequest', async (req, reply) => {

  // ✅ Allow internal calls via header
  const internalKey = req.headers['x-internal-key'];
  const INTERNAL_SERVICE_KEY = 'super-secret-internal-key';
  if (internalKey === INTERNAL_SERVICE_KEY) return;

  // ✅ Public routes
  if (
    req.raw.url.startsWith('/auth/signup') ||
    req.raw.url.startsWith('/auth/login') ||
    req.raw.url.startsWith('/products') ||
    req.raw.url.startsWith('/health')
  ) return;

  // ✅ Normal JWT authentication
  const auth = req.headers.authorization;
  if (!auth) {
    reply.code(401).send({ error: 'missing token' });
    return;
  }

  try {
    const res = await fetch(`${process.env.AUTH_URL || 'http://auth-service:3001'}/verify`, {
      headers: { Authorization: auth }
    });

    if (!res.ok) throw new Error('unauthorized');
    const userInfo = await res.json();
    req.user = userInfo;
  } catch {
    reply.code(401).send({ error: 'invalid token' });
  }
});

async function consumeProductEvents() {
  let lastId = '$';
  while(true){
    try {
      const res = await redis.xread('BLOCK', 0, 'STREAMS', 'product_events', lastId);
      if (res) {
        for (const [, entries] of res) {
          for (const [id, pairs] of entries) {
            lastId = id;
            const obj = {};
            for (let i=0;i<pairs.length;i+=2) obj[pairs[i]] = pairs[i+1];
            const event = obj.event;
            const data = JSON.parse(obj.data || '{}');
            await prisma.productCache.upsert({
              where: { id: data.id },
              update: { title: data.title || '', price: data.price || 0, image: data.image || null, stock: data.stock || null, updatedAt: new Date() },
              create: { id: data.id, title: data.title || '', price: data.price || 0, image: data.image || null, stock: data.stock || null }
            });
            app.log.info('handled event', event, data.id);
          }
        }
      }
    } catch (e) {
      app.log.error('stream read error', e.message);
      await new Promise(r=>setTimeout(r,1000));
    }
  }
}

app.post('/create', async (req, reply) => {
  const { user, products } = req.body;

  try {
    const reserved = [];
    for (const it of products) { 
      const res = await axios.post(`http://product-service:3002/reserve`, { productId: it.id, quantity: it.quantity}); 
      reserved.push(res.data); 
    }
    const snapshot = products.map(it => {
      const p = reserved.find(r => r.id === it.id) || {};
      return {
        productId: it.id,
        quantity: it.quantity,
        price: p.price || 0,
        product: {
          title: p.title || null,
          category: p.category,
          image: p.image
        }
      };
    });

    const subtotal = snapshot.reduce((s, i) => s + i.price * i.quantity, 0);

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        user: user,
        subtotal,
        status: 'Processing',

        products: {
          createMany: {
            data: snapshot
          }
        }
      },
      include: {
        products: true
      }
    });

    return order;
  } catch (e) {
    console.error(e);
    return reply.code(400).send({ error: e.message });
  }
});


app.get('/list', async () => prisma.order.findMany());

app.get('/me', async (req) => {
  const userId = req.user.sub;

  return prisma.order.findMany({
    where: {
      user: {
        path: ['id'],
        equals: userId
      }
    },
    orderBy: { createdAt: 'desc' }
  });
});

app.get('/:id', async (req) => prisma.order.findUnique({ where: { id: req.params.id }, include: {
      products: true
    }}));

app.post('/webhooks/product', async (req) => {
  const { event, data } = req.body;
  if (!data || !data.id) return { ok: false };
  await prisma.productCache.upsert({
    where: { id: data.id },
    update: { title: data.title, price: data.price || 0, image: data.image || null, stock: data.stock || null, updatedAt: new Date() },
    create: { id: data.id, title: data.title || '', price: data.price || 0, image: data.image || null, stock: data.stock || null }
  });
  return { ok: true };
});

app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  await prisma.$connect();
  consumeProductEvents().catch(e=>app.log.error(e));
  await app.listen({ port: process.env.PORT || 3003, host: '0.0.0.0' });
  app.log.info('Order service listening');
};
start();
