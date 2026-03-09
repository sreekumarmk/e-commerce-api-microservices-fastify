import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const GATEWAY = 'http://api-gateway:3000';

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomItem = (arr) =>
  arr[Math.floor(Math.random() * arr.length)];

async function fetchUsers() {
  const res = await axios.get(`${GATEWAY}/auth/users`, {
  headers: {
    'x-internal-key': process.env.INTERNAL_SERVICE_KEY
  }
});
  return res.data;
}

async function fetchProducts() {
  const res = await axios.get(`${GATEWAY}/products/list`, {
  headers: {
    'x-internal-key': process.env.INTERNAL_SERVICE_KEY
  }
});
  return res.data;
}

async function main() {

  // ✅ fetch from APIs instead of Prisma
  const users = await fetchUsers();
  const products = await fetchProducts();

  if (!users.length || !products.length) {
    throw new Error("Auth-Service or Product-Service returned empty data.");
  }

  console.log("Users loaded from Auth-Service:", users.length);
  console.log("Products loaded from Product-Service:", products.length);

  const NUMBER_OF_ORDERS = 5;

  for (let i = 0; i < NUMBER_OF_ORDERS; i++) {

    const user = randomItem(users);

    const itemCount = randomInt(1, 4);
    const chosenProducts = [...products]
      .sort(() => 0.5 - Math.random())
      .slice(0, itemCount);

    let subtotal = 0;

    const items = chosenProducts.map(p => {
      const quantity = randomInt(1, 3);
      const price = p.price;
      subtotal += quantity * price;

      return {
        quantity,
        price,
        product: {
          id: p.id,
          title: p.title,
          category: p.category,
          image: p.image
        },
        productId: p.id
      };
    });

    await prisma.order.create({
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        products: {
          create: items
        },
        userId: user.id,
        subtotal,
        status: "Processing",
        createdAt: new Date()
      }
    });

    console.log("✅ Order created for:", user.email);
  }

  console.log("🎉 Orders seeded via microservices.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
