import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';

import { AppModule } from './app.module';
import { parseCorsOrigins } from './common/cors-origins';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  // Prisma reads process.env, not apps/api/.env, when cwd is the monorepo root.
  const envPath = resolve(__dirname, '..', '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  // bodyParser disabled globally: Better Auth's Node handler reads the raw
  // request body itself, so /api/auth/* must never pass through express.json() first.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(
    (req: Parameters<ReturnType<typeof json>>[0], res: Parameters<ReturnType<typeof json>>[1], next: () => void) => {
      if ((req.originalUrl ?? '').startsWith('/api/auth')) {
        next();
        return;
      }
      json()(req, res, next);
    },
  );

  app.enableCors({
    origin: parseCorsOrigins(),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
