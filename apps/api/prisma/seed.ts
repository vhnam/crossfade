import { randomUUID } from 'node:crypto';

import { hashPassword } from 'better-auth/crypto';

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@crossfade.io';
const ADMIN_PASSWORD = 'P@ssw0rd!!';
const ADMIN_NAME = 'Admin';
const CREDENTIAL_ISSUER = 'local:credential';

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { accounts: true },
  });

  if (!existing) {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        emailVerified: true,
        accounts: {
          create: {
            accountId: id,
            providerId: 'credential',
            issuer: CREDENTIAL_ISSUER,
            password: passwordHash,
          },
        },
      },
    });
    console.log(`Seeded operator ${ADMIN_EMAIL}`);
    return;
  }

  const credential = existing.accounts.find((account) => account.providerId === 'credential');
  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: { password: passwordHash, issuer: CREDENTIAL_ISSUER, accountId: existing.id },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: existing.id,
        accountId: existing.id,
        providerId: 'credential',
        issuer: CREDENTIAL_ISSUER,
        password: passwordHash,
      },
    });
  }

  console.log(`Updated operator ${ADMIN_EMAIL}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
