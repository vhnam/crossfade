# Crossfade

Operator-run live-chat handoff between a source application (tenant) and a human
advisor. Tenants authenticate with their own credentials; Crossfade resolves
identity from those credentials and never trusts a client-supplied tenant id.

## Layout

```text
apps/api          NestJS HTTP API (@crossfade/api)
apps/web          Operator Vite / React app (@crossfade/web)
packages/ui       Shared Tailwind / shadcn primitives (@crossfade/ui)
docs/specs        Spec Kit feature artifacts
docs/spdd         Open-SPDD analysis and prompts
```

See each package README for env vars, scripts, and local setup.

## Prerequisites

- Node.js `>=24.19.0`
- [Vite+](https://viteplus.dev/guide/) (`vp`) for install, check, test, and
  tasks
- PostgreSQL for `@crossfade/api`

## Setup

```bash
vp install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Fill `apps/api/.env` (at least `DATABASE_URL` and `BETTER_AUTH_SECRET`). Then
apply migrations and seed the local operator:

```bash
vp run api#prisma:migrate
vp run api#prisma:seed
```

## Development

```bash
vp run ready          # format, lint, typecheck, test, and build
vp run -r test        # tests across workspace packages
vp run -r build       # production builds
vp run dev:web        # operator app (http://localhost:3000)
vp run dev:api        # API (http://localhost:4000)
```

`vp check` formats, lints, and type-checks. Prefer `vp run <script>` for package
scripts and `vite.config.ts` tasks; do not call the underlying tools directly.

## Versions

Workspace packages use [Changesets](https://github.com/changesets/changesets)
(`private`, `workspace:*`). Do not publish to npm. See
[`.changeset/README.md`](.changeset/README.md).

```bash
vp run changeset
vp run changeset:version
```

## Agent workflow

Specification-first process (Notion → Spec Kit → Open-SPDD → Git) lives in
[`AGENTS.md`](AGENTS.md).
