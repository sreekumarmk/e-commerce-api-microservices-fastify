import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main(){
  const pass = await bcrypt.hash('123321', 10);
  await prisma.user.createMany({
    data: [
    {
      "firstName": "Sreekumar",
      "lastName": "M K",
      "email": "sreekumarmktp@gmail.com",
      "password": pass,
    },
    {
      "firstName": "Sree",
      "lastName": "Kumar",
      "email": "sreekumaronit@gmail.com",
      "password": pass,
    },
    {
      "firstName": "Kumar",
      "lastName": "Sree",
      "email": "a@gmail.com",
      "password": pass,
    },
    {
      "firstName": "Sreekumar",
      "lastName": "Thinkpalm",
      "email": "sreekumar.mk@thinkpalm.com",
      "password": pass,
    }
  ],
    skipDuplicates: true
  });
  console.error('seeded auth');
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
