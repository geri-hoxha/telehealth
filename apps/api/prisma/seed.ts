import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Demo login for the prototype.
const DEMO_USERNAME = 'geri';
const DEMO_PASSWORD = '1234';

async function main() {
  await prisma.user.upsert({
    where: { username: DEMO_USERNAME },
    update: {},
    create: {
      username: DEMO_USERNAME,
      email: 'geri@telehealth.al',
      passwordHash: await hash(DEMO_PASSWORD),
      firstName: 'Geri',
      lastName: 'Demo',
    },
  });
  console.log(`Seeded demo user: ${DEMO_USERNAME} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
