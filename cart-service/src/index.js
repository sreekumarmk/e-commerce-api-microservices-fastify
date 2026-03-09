import Fastify from 'fastify';
import Redis from 'ioredis';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
app.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
});
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

app.post('/add', async (req, reply) => {
  console.log('Add to cart request:', req.body);
  const { userId, productId, qty } = req.body;
  if (!userId || !productId || !qty) return reply.code(400).send({ error: 'userId, productId, qty required' });
  await redis.hincrby(`cart:${userId}`, productId, Number(qty));
  return { ok: true };
});

app.get('/:userId', async (req, res) => {
  const data = await redis.hgetall(`cart:${req.params.userId}`);

  const items = Object.entries(data).map(([productId, quantity]) => ({
    productId,
    quantity: Number(quantity),
  }));

  const subtotal = 0; // calculate later using prices if needed

  return {
    items,
    subtotal,
  }
});

app.delete('/:userId/:productId', async (req) => {
  await redis.hdel(`cart:${req.params.userId}`, req.params.productId);
  return { ok: true };
});

const start = async () => {
  await app.listen({ port: process.env.PORT || 3004, host: '0.0.0.0' });
  app.log.info('Cart service listening');
};
start();
