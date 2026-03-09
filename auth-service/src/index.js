import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
app.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
});
const prisma = new PrismaClient();
app.decorate('prisma', prisma);

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'change_refresh_secret';

const userPublicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  updatedAt: true
};


app.post('/signup', async (req, reply) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password || !firstName || !lastName) return reply.code(400).send({ error: 'InvalidInputs', message: 'Email, password, first name and last name are required' });
    //Check if user with this email already exists
    const users = await prisma.user.findMany({ where: { email }, select: {...userPublicSelect}});
    const userExists = users.some(
      (user) => user.email === email
    );
    if (userExists) {
      return reply.code(400).send({ error: 'EmailTaken', message: 'User with this email already exists' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const u = await prisma.user.create({ data: { email, firstName, lastName, password: hashed }});
    const access = jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: '1h' });
    const refresh = jwt.sign({ sub: u.id }, REFRESH_SECRET, { expiresIn: '7d' });
    await prisma.user.update({ where: { id: u.id }, data: { refreshToken: refresh }});
    return { access, refresh };

});

app.post('/login', async (req, reply) => {
  const { email, password } = req.body;
  const u = await prisma.user.findUnique({ where: { email }, select: {...userPublicSelect, password: true }});
  if (!u) return reply.code(401).send({ error: 'invalid' });
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return reply.code(401).send({ error: 'invalid' });
  const access = jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: '1h' });
  const refresh = jwt.sign({ sub: u.id }, REFRESH_SECRET, { expiresIn: '7d' });
  await prisma.user.update({ where: { id: u.id }, data: { refreshToken: refresh }});
  return { access, refresh };
});

app.get('/users', async () => prisma.user.findMany({select: userPublicSelect}));

app.get('/user', async (req, reply) => {
  const { id } = req.query;
  const user = await prisma.user.findUnique({ where: { id }, select: userPublicSelect});
  return user;
});

app.get('/profile', async (req, reply) => {
  const { email } = req.query;
  const user = await prisma.user.findUnique({ where: { email }, select: userPublicSelect});
  return user;
});

app.post('/token', async (req, reply) => {
  const { refresh } = req.body;
  if (!refresh) return reply.code(400).send({ error: 'refresh required' });
  try {
    const payload = jwt.verify(refresh, REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: userPublicSelect});
    if (!user || user.refreshToken !== refresh) return reply.code(401).send({ error: 'invalid' });
    const access = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    return { access };
  } catch (e) {
    return reply.code(401).send({ error: 'invalid refresh' });
  }
});

app.get('/verify', async (req, reply) => {
  const auth = req.headers.authorization;
  console.log('Verifying token:', auth);
  if (!auth) return reply.code(401).send({ error: 'no token' });
  const token = auth.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch (e) {
    return reply.code(401).send({ error: 'invalid token' });
  }
});

const start = async () => {
  await prisma.$connect();
  await app.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' });
  app.log.info('Auth service listening');
};
start();
