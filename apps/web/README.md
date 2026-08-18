# `@crossfade/web`

Operator-facing Vite + React app. Crossfade product UI (login, tenant workflows)
lives here. Reusable primitives come from `@crossfade/ui`; do not add shadcn
components in this package.

## Setup

From the repo root:

```bash
cp apps/web/.env.example apps/web/.env
vp run dev:web
```

| Variable       | Required | Notes                               |
| -------------- | -------- | ----------------------------------- |
| `VITE_API_URL` | no       | Defaults to `http://localhost:4000` |

Dev server: `http://localhost:3000`. Better Auth client talks to
`${VITE_API_URL}/api/auth`. CORS on the API must include this origin
(`CORS_ORIGIN`).

Env is validated at build/dev time in `src/env.ts` (T3 Env + Valibot).

## Scripts

| Script    | Purpose             |
| --------- | ------------------- |
| `dev`     | Vite+ dev server    |
| `build`   | Typecheck and build |
| `preview` | Preview production  |

From the repo root: `vp run dev:web` or `vp run web#dev`.

## Stack

- TanStack Router (file routes under `src/routes/`)
- TanStack Query
- Better Auth React client (`src/integrates/auth.ts`)
- Tailwind via `@crossfade/ui/globals.css`

Import primitives from the UI package, for example:

```tsx
import { Button } from "@crossfade/ui/components/button";
import { ThemeProvider } from "@crossfade/ui/lib/theme-provider";
```
