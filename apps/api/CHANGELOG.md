# @crossfade/api

## 0.0.2

### Patch Changes

- 74be126: Enable Better Auth `sendResetPassword` so operators can request a
  password reset. Reset URLs are logged in the API process until a mail provider
  is configured.
- b5a7d6f: Seed a local operator account so the web login can be used without
  signing up.
- 73fb986: Validate `DATABASE_URL`, `BETTER_AUTH_SECRET`, and related env at
  startup with T3 Env and Valibot.
- 13d962f: Return 200 from operator suspend, reactivate, and rotate-key instead
  of Nest's default POST 201.
- 3d58570: Generate Prisma Client into `src/generated` and serialize tenant
  `status` as `active` / `suspended` instead of Prisma enum members.
