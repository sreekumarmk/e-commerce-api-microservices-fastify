import Fastify from 'fastify';
import Redis from 'ioredis';
import cors from '@fastify/cors';
import axios from 'axios';

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

  const items = await Promise.all(
    Object.entries(data).map(async ([productId, quantity]) => {
      let productDetails = {};
      try {
        const productRes = await axios.get(`${process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'}/${productId}`);
        productDetails = productRes.data;
      } catch (err) {
        req.log.error(`Failed to fetch product ${productId}: ${err.message}`);
      }
      return {
        productId,
        quantity: Number(quantity),
        ...productDetails
      };
    })
  );

  const subtotal = items.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0);

  return {
    items,
    subtotal,
  }
});

app.delete('/:userId/:productId', async (req) => {
  await redis.hdel(`cart:${req.params.userId}`, req.params.productId);
  return { ok: true };
});

app.post('/delete', async (req, reply) => {
  const { userId, productId } = req.body;
  if (!userId || !productId) {
    return reply.code(400).send({ error: 'userId and productId are required' });
  }
  await redis.hdel(`cart:${userId}`, productId);
  return { ok: true };
});

const start = async () => {
  await app.listen({ port: process.env.PORT || 3004, host: '0.0.0.0' });
  app.log.info('Cart service listening');
};
start();
