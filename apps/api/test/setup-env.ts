import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/crossfade';
process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-32chars!!';
process.env.BETTER_AUTH_URL ??= 'http://localhost:4000';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';

jest.mock('better-auth', () => ({
  betterAuth: () => ({
    api: { getSession: async () => null },
    handler: async () => undefined,
  }),
}));

jest.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: () => ({}),
}));

jest.mock('better-auth/node', () => ({
  toNodeHandler: () => async () => undefined,
}));
