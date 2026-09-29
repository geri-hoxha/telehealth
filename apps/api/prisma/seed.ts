import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Demo logins for the prototype: a patient who calls, and a doctor whose phone rings.
const DEMO_PASSWORD = '1234';
const DEMO_USERS = [
  { username: 'geri', email: 'geri@telehealth.al', firstName: 'Geri', lastName: 'Demo', role: 'PATIENT' },
  { username: 'doktor', email: 'doktor@telehealth.al', firstName: 'Arben', lastName: 'Mjeku', role: 'DOCTOR' },
] as const;

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD);
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: { role: user.role },
      create: { ...user, passwordHash },
    });
    console.log(`Seeded ${user.role.toLowerCase()}: ${user.username} / ${DEMO_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
