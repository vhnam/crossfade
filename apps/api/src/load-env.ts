import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Prisma and T3 Env both read process.env. Nest's cwd is often the monorepo
// root, so load apps/api/.env explicitly before any schema validation.
const envPath = resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
