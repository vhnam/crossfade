import '../jest-globals';
import type { Server } from 'node:http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { BetterAuthService } from '../../src/auth/better-auth.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.mock('../../src/env', () => ({
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: 4000,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  },
}));

const OPERATOR_COOKIE = 'e2e-operator-session=1';

async function createApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(BetterAuthService)
    .useValue({
      getSession: async (headers: Headers) => {
        if (headers.get('cookie')?.includes('e2e-operator-session=1')) {
          return { operatorUserId: 'e2e-operator' };
        }
        return null;
      },
    })
    .compile();

  const app = moduleFixture.createNestApplication({ bodyParser: false, logger: false });
  app.use(
    (req: Parameters<ReturnType<typeof json>>[0], res: Parameters<ReturnType<typeof json>>[1], next: () => void) => {
      if ((req.originalUrl ?? '').startsWith('/api/auth')) {
        next();
        return;
      }
      json()(req, res, next);
    },
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}

describe('Tenant onboarding and isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.tenant.deleteMany({ where: { id: { in: createdIds } } });
    }
    await app.close();
  });

  function httpRequest() {
    return request(app.getHttpServer() as Server);
  }

  function operatorGet(path: string) {
    return httpRequest().get(path).set('Cookie', OPERATOR_COOKIE);
  }

  function operatorPost(path: string) {
    return httpRequest().post(path).set('Cookie', OPERATOR_COOKIE);
  }

  async function registerTenant(slug: string, name = slug) {
    const response = await operatorPost('/operator/tenants').send({
      name,
      slug,
      webhookUrl: `https://${slug}.example.com/crossfade/callback`,
    });
    const id = response.body?.id;
    if (typeof id === 'string') {
      createdIds.push(id);
    }
    return response;
  }

  it('registers a tenant and returns secrets once (201)', async () => {
    const slug = `windwise-${Date.now()}`;
    const response = await registerTenant(slug, 'Windwise');

    expect(response.status).toBe(201);
    expect(response.body.apiKey).toMatch(/^cf_live_/);
    expect(response.body.webhookSecret).toBeDefined();
    expect(response.body.status).toBe('active');
    expect(response.body.slug).toBe(slug);
  });

  it('rejects a missing webhook URL with 400', async () => {
    const response = await operatorPost('/operator/tenants').send({
      name: 'No Hook',
      slug: `no-hook-${Date.now()}`,
    });

    expect(response.status).toBe(400);
  });

  it('rejects a duplicate slug with 409', async () => {
    const slug = `dup-${Date.now()}`;
    const first = await registerTenant(slug);
    expect(first.status).toBe(201);

    const second = await operatorPost('/operator/tenants').send({
      name: 'Other',
      slug,
      webhookUrl: 'https://other.example.com/hook',
    });

    expect(second.status).toBe(409);
    expect(second.body).toEqual({
      statusCode: 409,
      message: 'Tenant slug already registered',
    });
  });

  it('resolves GET /tenants/me from the bearer credential alone', async () => {
    const created = await registerTenant(`me-${Date.now()}`, 'Me');
    const { apiKey, id } = created.body as { apiKey: string; id: string };

    const me = await httpRequest().get('/tenants/me').set('Authorization', `Bearer ${apiKey}`);

    expect(me.status).toBe(200);
    expect(me.body.id).toBe(id);
    expect(me.body.status).toBe('active');
    expect(me.body).not.toHaveProperty('apiKey');
    expect(me.body).not.toHaveProperty('webhookSecret');
  });

  it('rejects missing and invalid tenant credentials with 401', async () => {
    const missing = await httpRequest().get('/tenants/me');
    expect(missing.status).toBe(401);
    expect(missing.body.message).toBe('Invalid or missing API credential');

    const invalid = await httpRequest().get('/tenants/me').set('Authorization', 'Bearer cf_live_not-a-real-key');
    expect(invalid.status).toBe(401);
  });

  it('never exposes another tenant through GET /tenants/me or a guessed id', async () => {
    const tenantA = await registerTenant(`iso-a-${Date.now()}`, 'A');
    const tenantB = await registerTenant(`iso-b-${Date.now()}`, 'B');

    const asA = await httpRequest().get('/tenants/me').set('Authorization', `Bearer ${tenantA.body.apiKey}`);
    expect(asA.body.id).toBe(tenantA.body.id);
    expect(asA.body.id).not.toBe(tenantB.body.id);

    const guessed = await httpRequest()
      .get(`/tenants/${tenantB.body.id}`)
      .set('Authorization', `Bearer ${tenantA.body.apiKey}`);
    expect(guessed.status).toBe(404);
  });

  it('suspends with 200, rejects tenant traffic with 403, then reactivates', async () => {
    const created = await registerTenant(`suspend-${Date.now()}`, 'Suspend Me');
    const { id, apiKey } = created.body as { id: string; apiKey: string };

    const suspended = await operatorPost(`/operator/tenants/${id}/suspend`);
    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe('suspended');
    expect(suspended.body).not.toHaveProperty('apiKey');

    const blocked = await httpRequest().get('/tenants/me').set('Authorization', `Bearer ${apiKey}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('Tenant is suspended');

    const inspected = await operatorGet(`/operator/tenants/${id}`);
    expect(inspected.status).toBe(200);
    expect(inspected.body.slug).toBe(created.body.slug);

    const reactivated = await operatorPost(`/operator/tenants/${id}/reactivate`);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.status).toBe('active');

    const allowed = await httpRequest().get('/tenants/me').set('Authorization', `Bearer ${apiKey}`);
    expect(allowed.status).toBe(200);
  });

  it('rotates the key so the old credential stops resolving', async () => {
    const created = await registerTenant(`rotate-${Date.now()}`, 'Rotate Me');
    const { id, apiKey: oldKey } = created.body as { id: string; apiKey: string };

    const rotated = await operatorPost(`/operator/tenants/${id}/rotate-key`);
    expect(rotated.status).toBe(200);
    expect(rotated.body.apiKey).toMatch(/^cf_live_/);
    expect(rotated.body.apiKey).not.toBe(oldKey);

    const oldRejected = await httpRequest().get('/tenants/me').set('Authorization', `Bearer ${oldKey}`);
    expect(oldRejected.status).toBe(401);

    const newAccepted = await httpRequest().get('/tenants/me').set('Authorization', `Bearer ${rotated.body.apiKey}`);
    expect(newAccepted.status).toBe(200);
    expect(newAccepted.body.id).toBe(id);
  });

  it('rejects operator routes without a session', async () => {
    const response = await httpRequest().get('/operator/tenants/does-not-matter');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or missing API credential');
  });
});
