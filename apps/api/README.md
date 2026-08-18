# `@crossfade/api`

Tenant-facing NestJS HTTP API. Resolves tenant identity from the tenant API
credential, scopes data to that tenant, and does not accept a client-supplied
tenant id as a substitute.

Operator session auth (Better Auth) is used only for operator tenant lifecycle
routes. Tenant routes use `Authorization: Bearer <api-key>`.

## Setup

From the repo root:

```bash
cp apps/api/.env.example apps/api/.env
```

| Variable             | Required | Notes                                                |
| -------------------- | -------- | ---------------------------------------------------- |
| `DATABASE_URL`       | yes      | PostgreSQL URL                                       |
| `BETTER_AUTH_SECRET` | yes      | Better Auth signing secret                           |
| `PORT`               | no       | Defaults to `4000`                                   |
| `BETTER_AUTH_URL`    | no       | Defaults to `http://localhost:4000`                  |
| `CORS_ORIGIN`        | no       | Defaults to `http://localhost:3000`; comma-separated |

Then:

```bash
vp run api#prisma:migrate
vp run api#prisma:seed
vp run dev:api
```

`prisma:seed` creates a local operator user (email and password are in
`prisma/seed.ts`). Do not use that seed in production.

Set `SKIP_ENV_VALIDATION=true` only in tests; startup otherwise validates env
with T3 Env and Valibot (`src/env.ts`).

## Scripts

Run from the repo root with `vp run api#<script>` (or `vp run` inside this
package):

| Script            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `start:dev`       | Watch mode (`prisma generate` then Nest) |
| `start`           | Nest without watch                       |
| `start:prod`      | `node dist/main`                         |
| `build`           | Generate Prisma client and compile       |
| `test`            | Jest unit tests                          |
| `test:e2e`        | Jest e2e (`test/jest-e2e.json`)          |
| `prisma:generate` | Prisma Client                            |
| `prisma:migrate`  | `prisma migrate dev`                     |
| `prisma:seed`     | Seed local operator                      |
| `auth:generate`   | Regenerate Better Auth Prisma models     |

Do not hand-edit Better Auth models in `prisma/schema.prisma`; regenerate with
`auth:generate`.

## HTTP surface

| Area     | Base path           | Auth                   |
| -------- | ------------------- | ---------------------- |
| Auth     | `/api/auth/*`       | Better Auth (raw body) |
| Operator | `/operator/tenants` | Operator session       |
| Tenant   | `/tenants/me`       | Bearer tenant API key  |

Operator tenant lifecycle (session required): create, get, suspend, reactivate,
rotate key. Create returns the plaintext API key once; later reads omit it.
Tenant `status` in JSON is `active` or `suspended`.

`/api/auth/*` skips `express.json()` so Better Auth can read the raw body.

## Isolation

- Resolve tenant from the hashed API key, not from a body or query tenant id.
- Suspended tenants are rejected (`403`) even with a valid key.
- Invalid or missing credentials are opaque (`401`); do not leak whether a
  tenant exists.

See [`AGENTS.md`](../../AGENTS.md) §10.

## Data

Prisma schema: `prisma/schema.prisma`. Client is generated to
`src/generated/prisma` (gitignored).
