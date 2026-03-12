import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import fetch from 'node-fetch';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
app.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true
});

app.addHook('onRequest', async (req, reply) => {

  // ✅ Allow internal calls via header
  const internalKey = req.headers['x-internal-key'];
  const INTERNAL_SERVICE_KEY = 'super-secret-internal-key';
  if (internalKey === INTERNAL_SERVICE_KEY) return;

  // ✅ Public routes
  if (
    req.raw.url.startsWith('/auth/signup') ||
    req.raw.url.startsWith('/auth/login') ||
    req.raw.url.startsWith('/products')
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

app.register(proxy, { prefix: '/auth', upstream: process.env.AUTH_URL || 'http://auth-service:3001' });
app.register(proxy, { prefix: '/products', upstream: process.env.PRODUCT_URL || 'http://product-service:3002' });
app.register(proxy, { prefix: '/orders', upstream: process.env.ORDER_URL || 'http://order-service:3003' });
app.register(proxy, { prefix: '/cart', upstream: process.env.CART_URL || 'http://cart-service:3004' });

app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  app.log.info('API Gateway listening');
};
start();
