# Tenant Onboarding & Isolation

## Requirements

Establish tenant identity as the foundational access boundary of Crossfade: let
an operator register and lifecycle-manage source-application tenants (create,
suspend, reactivate, rotate credential), and let every tenant authenticate
itself via a single opaque credential that resolves to exactly one tenant and
scopes all its data access — so no tenant can ever see, list, or infer another
tenant's existence or data, and every later Crossfade feature (handoff requests,
advisor management, sessions) inherits a safe-by-default isolation boundary.

## Entities

```mermaid
classDiagram
direction TB

class Tenant {
    +String id
    +String slug
    +String name
    +String apiKeyHash
    +String webhookUrl
    +String webhookSecret
    +TenantStatus status
    +DateTime createdAt
    +DateTime updatedAt
}

class TenantStatus {
    <<enumeration>>
    ACTIVE
    SUSPENDED
}

class TenantPublicStatus {
    <<enumeration>>
    active
    suspended
}

class CreateTenantDto {
    +String name
    +String slug
    +String webhookUrl
}

class TenantIssuedResponseDto {
    +String id
    +String slug
    +String name
    +TenantPublicStatus status
    +String apiKey
    +String webhookUrl
    +String webhookSecret
    +DateTime createdAt
}

class TenantSafeResponseDto {
    +String id
    +String slug
    +String name
    +TenantPublicStatus status
    +String webhookUrl
    +DateTime createdAt
    +DateTime updatedAt
}

class RotateKeyResponseDto {
    +String id
    +String apiKey
}

class RequestTenantContext {
    +String tenantId
}

class OperatorUser {
    +String id
    +String email
    +String name
}

class RequestOperatorContext {
    +String operatorUserId
}

Tenant "1" -- "1" TenantStatus : has
TenantStatus --> TenantPublicStatus : toTenantPublicStatus
CreateTenantDto --> Tenant : creates
Tenant --> TenantIssuedResponseDto : maps to on create
Tenant --> TenantSafeResponseDto : maps to on read/list
Tenant --> RequestTenantContext : resolved by TenantAuthGuard
OperatorUser --> RequestOperatorContext : resolved by OperatorAuthGuard via Better Auth session
```

`OperatorUser` and its backing session/credential records (`Session`, `Account`,
`Verification`) are owned and schema-managed by Better Auth's own Prisma
adapter, not hand-modeled by this feature — see Operations for the exact model
set Better Auth generates into `schema.prisma`.

Credential accounts used for operator email/password sign-in MUST set
`Account.issuer` to Better Auth 1.7's local credential issuer
(`local:credential`, i.e. `createLocalAccountIssuer("credential")`),
`Account.providerId` to `credential`, and `Account.accountId` to the user's id.
A seeded row with `issuer` null is treated as "user not found" at
`/api/auth/sign-in/email` even when the email exists.

## Approach

1. Persistence & Domain Module:
   - Introduce the first ORM/persistence layer in `apps/api`: Prisma against
     PostgreSQL, with a `Tenant` model as the sole table this feature owns. The
     Prisma client is generated to `apps/api/src/generated/prisma` and
     re-exported from `apps/api/src/prisma/client.ts`; application code imports
     `PrismaClient` / `TenantStatus` / `Prisma` from that barrel, not from
     `@prisma/client`. `nest-cli.json` copies `generated/**/*` into the build
     output.
   - Introduce the first domain module, `TenantsModule`, following Nest's
     Controller → Service → Repository(Prisma) layering — this becomes the
     reference pattern every later domain module (002+) copies.
   - Split the module into two access surfaces from day one: an operator surface
     (`/operator/tenants/*`, privileged, separately guarded) and a tenant-facing
     surface (`/tenants/me`, credential-guarded) — never share a guard between
     them.

2. Technical Implementation:
   - Tenant authentication: opaque bearer API key (`cf_live_<random>`), SHA-256
     hashed at rest, resolved by a `TenantAuthGuard` that runs before any
     handler and attaches `tenantId` to the request context. No JWT, no session,
     no per-request tenant identity in body/params (FR-006). Unchanged by this
     update — the tenant is a source application authenticating
     machine-to-machine, not a person logging in, so Better Auth (a
     human-session auth library) does not apply here.
   - Operator authentication: session-based login via Better Auth, since
     `apps/web` now hosts a real operator login screen (not a hypothetical
     future UI). Better Auth owns its own
     `User`/`Session`/`Account`/`Verification` tables (via its Prisma adapter,
     against the same Postgres database `PrismaService` already connects to) and
     issues an `httpOnly` session cookie on successful email/password sign-in.
     `OperatorAuthGuard` no longer compares a shared secret — it copies the
     Express request headers into a Fetch `Headers` object, calls
     `BetterAuthService.getSession`, and attaches `{ operatorUserId }` as
     `RequestOperatorContext`. This replaces the v1-era single-shared-secret
     mechanism now that a real login surface exists to authenticate against,
     without touching the `Tenant` schema or `TenantAuthGuard` at all. Nest
     disables the global JSON body parser for `/api/auth/*` so Better Auth's
     Node handler can read the raw body; CORS is origin-allowlisted
     (`env.CORS_ORIGIN` via T3 Env, default `http://localhost:3000`) with
     `credentials: true` so the session cookie can be set from `apps/web`.
     Required secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`) fail fast at
     process start through `apps/api/src/env.ts` (`@t3-oss/env-core` + Valibot),
     not via `BetterAuthService.onModuleInit`. `load-env.ts` loads
     `apps/api/.env` before validation because Nest's cwd is often the monorepo
     root. `apps/web` validates `VITE_API_URL` the same way
     (`apps/web/src/env.ts`); `authClient` reads `env.VITE_API_URL`.
   - Isolation enforcement: application-layer scoping. Every tenant-facing query
     is written against a `PrismaService` wrapped by convention: all
     reads/writes take `tenantId` from `RequestTenantContext`, never from a
     route param or body field. Cross-tenant reference attempts always resolve
     as `404 Not Found`, never `403`, so existence is never confirmable
     (FR-008).
   - Global exception handling: a single `GlobalExceptionFilter` (`@Catch()`)
     maps all thrown domain exceptions and Prisma errors to a uniform
     `ErrorResponse` shape and HTTP status, so no handler needs its own
     try/catch for expected failure modes.

3. Business Logic:
   - Registration is atomic and race-safe: slug uniqueness is enforced by a DB
     unique constraint (not a check-then-insert), and the Prisma
     unique-violation error (`P2002`) is caught and translated to `409 Conflict`
     — closes the concurrent-duplicate-registration edge case.
   - Webhook URL is validated for well-formed HTTPS synchronously at
     registration (hard reject if malformed/missing); reachability is not
     checked (registration must not depend on the tenant's own deploy timing).
   - Suspend/reactivate are idempotent state transitions (repeat calls are a
     no-op `200`, not an error). Operator lifecycle POSTs (`suspend`,
     `reactivate`, `rotate-key`) set `@HttpCode(HttpStatus.OK)` so Nest does not
     default POST to `201`; create uses `@HttpCode(HttpStatus.CREATED)`. Status
     is the single source of truth for authorization at the `TenantAuthGuard`
     layer; suspended tenants are rejected with `403` after successful
     credential resolution (distinguishable from `401` for the client, per
     contract).
   - Credential rotation replaces `apiKeyHash` in place on the existing `Tenant`
     row; the raw key is returned once in the rotation response body and never
     persisted or logged in plaintext anywhere (constraint carried into
     Safeguards).
   - Credential "expiry" (mentioned in spec's User Story 2 wording) is
     explicitly out of scope for v1 — no expiry field exists on `Tenant`; only
     missing/invalid/suspended states are enforced. This is a resolved
     ambiguity, not a gap: v1 credentials are valid until rotated or the tenant
     is suspended.

## Structure

### Inheritance Relationships

1. `TenantAuthGuard` implements Nest's `CanActivate` interface.
2. `OperatorAuthGuard` implements Nest's `CanActivate` interface.
3. `GlobalExceptionFilter` implements Nest's `ExceptionFilter` interface,
   decorated `@Catch()`.
4. `DuplicateTenantSlugException`, `TenantNotFoundException`,
   `TenantSuspendedException`, `InvalidCredentialException` all extend a shared
   `BusinessException extends HttpException` base class. Malformed/missing
   `webhookUrl` is rejected by Nest `ValidationPipe` (`400`) via
   `CreateTenantDto`
   (`@IsUrl({ protocols: ['https'], require_protocol: true })`), not a dedicated
   `InvalidWebhookUrlException`.
5. `CreateTenantDto` uses `class-validator` decorators (no custom base class
   needed — existing Nest `ValidationPipe` convention).
6. `AuthController` (new) forwards its catch-all route to Better Auth's own
   request handler — it implements no domain interface, it is a thin adapter
   between Nest's routing and Better Auth's framework-agnostic handler.
7. `PrismaService` extends the generated `PrismaClient` and implements
   `OnModuleInit` / `OnModuleDestroy` (`$connect` / `$disconnect`).

### Dependencies

1. `OperatorTenantsController` depends on `OperatorTenantsService`; guarded by
   `OperatorAuthGuard`.
2. `TenantsController` (tenant-facing, `/tenants/me`) depends on
   `TenantsService`; guarded by `TenantAuthGuard`.
3. `OperatorTenantsService` and `TenantsService` both depend on `PrismaService`
   (new, shared) for persistence — no direct Prisma client usage in controllers.
4. `TenantAuthGuard` depends on `PrismaService` and `TenantCredentialService`
   (hash the bearer token, then `findUnique` on `apiKeyHash`). Guard stays thin
   — hash lookup and status check only, no other business rules.
5. `TenantCredentialService` (new, shared utility) is depended on by
   `OperatorTenantsService` (key generation/hashing on create/rotate) and
   `TenantAuthGuard` (hash comparison on resolution) — single place that owns
   the hashing algorithm. 5b. `toTenantPublicStatus`
   (`apps/api/src/tenants/tenant-status.ts`) is depended on by
   `OperatorTenantsService` and `TenantsService` so JSON `status` is always
   `active` / `suspended`, never Prisma enum members. Response DTOs type
   `status` as `TenantPublicStatus`. 5c. `env` (`apps/api/src/env.ts`) is
   depended on by `main.ts` (listen port), `BetterAuthService`
   (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`), and `parseCorsOrigins()`
   (`CORS_ORIGIN`). `apps/web/src/integrates/auth.ts` depends on
   `apps/web/src/env.ts` (`VITE_API_URL`).
6. `GlobalExceptionFilter` is registered globally in `main.ts` via
   `app.useGlobalFilters(...)`; depended on by nothing, consumed implicitly by
   every controller.
7. `OperatorAuthGuard` depends on the shared `BetterAuthService` (new — a thin
   wrapper around the configured Better Auth server instance) to resolve the
   incoming request's session cookie to an `operatorUserId`; it no longer
   depends on `process.env.OPERATOR_API_KEY` or any string-comparison logic.
8. `BetterAuthService` depends on `PrismaService` (Prisma adapter) and `env`
   (`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`) plus `parseCorsOrigins()` for
   `trustedOrigins`. Better Auth's Prisma adapter reads/writes its own
   `User`/`Session`/`Account`/`Verification` tables through the same client, so
   there remains exactly one database connection pool for the whole app, not a
   second one.
9. `AuthController` depends on `BetterAuthService` to obtain the configured
   handler it forwards requests to; it has no dependency on
   `OperatorTenantsService` or `Tenant` at all — Better Auth's own routes
   (`/api/auth/*`) know nothing about tenants.
10. `PrismaModule` is `@Global()` and exports `PrismaService`; `AuthModule`
    exports `BetterAuthService` and is imported by `TenantsModule` so
    `OperatorAuthGuard` can inject it.
11. `apps/web` `authClient` (`createAuthClient`) depends on `env.VITE_API_URL`
    (default `http://localhost:4000`) with base path `/api/auth`.
12. Local operator bootstrap: `apps/api/prisma/seed.ts` depends on
    `../src/generated/prisma` `PrismaClient` and `better-auth/crypto`
    `hashPassword`; it does not instantiate Nest.
13. Unit tests (`*.spec.ts` next to sources) and e2e
    (`test/tenants/tenant-onboarding-isolation.e2e-spec.ts`) depend on
    `test/setup-env.ts` for default env + Better Auth mocks; e2e overrides
    `BetterAuthService` and mocks `../../src/env`.

### Layered Architecture

1. Controller Layer: `OperatorTenantsController` (privileged CRUD/lifecycle),
   `TenantsController` (tenant self-read, `GET /tenants/me`), `AuthController`
   (`/api/auth/*` catch-all) — tenant/operator controllers parse/validate input
   via DTOs + `ValidationPipe` and delegate to services, never touch Prisma
   directly. `AuthController` forwards the raw Node request/response to Better
   Auth (`toNodeHandler`).
2. Service Layer: `OperatorTenantsService`
   (create/suspend/reactivate/rotate/get), `TenantsService` (self-lookup by
   resolved `tenantId`) — own all business rules (uniqueness, status
   transitions, isolation scoping).
3. Guard Layer: `TenantAuthGuard` (credential → `tenantId` resolution, status
   check), `OperatorAuthGuard` (Better Auth session → `operatorUserId`
   resolution) — run before controller handlers, attach
   `RequestTenantContext`/`RequestOperatorContext` respectively.
4. Repository/Data Access Layer: `PrismaService` extends the generated
   `PrismaClient` from `apps/api/src/prisma/client.ts` (`Tenant` model access) —
   single source of DB access for this module; Better Auth's own Prisma adapter
   reads/writes its `User`/`Session`/`Account`/`Verification` tables through the
   same client instance.
5. Exception Handling Layer: `GlobalExceptionFilter` — unified translation of
   `BusinessException` subclasses and Prisma errors (e.g. `P2002`) into the
   `ErrorResponse` DTO shape and correct HTTP status. Prisma error types are
   imported from `prisma/client` (`Prisma.PrismaClientKnownRequestError`).
6. Auth Integration Layer: `BetterAuthService` (configured Better Auth server
   instance, session verification, password-reset URL logging) +
   `AuthController` (mounts Better Auth's own routes under Nest's routing) —
   sits alongside, not inside, the Guard Layer; `OperatorAuthGuard` is the
   layer's only consumer for session checks. Operator UI in `apps/web` is
   `/auth/login` plus forgot/reset-password routes that call the same
   `authClient`.
7. Bootstrap / Config Layer: `load-env.ts` then `env.ts` (T3 Env + Valibot)
   before Nest listen; `apps/api/prisma/seed.ts` (local operator user +
   credential `Account`) run via `prisma db seed` / `tsx prisma/seed.ts`.

## Operations

### Create/Update Persistence Schema - `Tenant` (Prisma)

1. Responsibility: Define the `Tenant` model and `TenantStatus` enum as the
   first persisted table in `apps/api`.
2. Attributes:
   - `id`: `String @id @default(uuid())` — internal identifier, never guessable.
   - `slug`: `String @unique` — immutable after creation.
   - `name`: `String`.
   - `apiKeyHash`: `String @unique` — SHA-256 hex digest of the active raw key
     (unique index is the `TenantAuthGuard` lookup path).
   - `webhookUrl`: `String`.
   - `webhookSecret`: `String`.
   - `status`: `TenantStatus @default(ACTIVE)`.
   - `createdAt`: `DateTime @default(now())`.
   - `updatedAt`: `DateTime @updatedAt`.
3. Constraints: `slug` unique index (DB-level, closes
   concurrent-duplicate-registration race). `apiKeyHash` unique index (guard
   lookup). No cascade/delete path defined in v1 (no deletion feature).
4. Migration: add `apps/api/prisma/schema.prisma` with
   `generator client { provider = "prisma-client-js"; output = "../src/generated/prisma" }`;
   run initial Prisma migration; add `apps/api/src/prisma/client.ts` (re-export
   `Prisma`, `PrismaClient`, `TenantStatus`, `Tenant`) and
   `PrismaService`/`PrismaModule` (global, injectable).
   `PrismaService extends PrismaClient`. Seed (`prisma/seed.ts`) constructs
   `PrismaClient` from `../src/generated/prisma` because it runs outside Nest.
5. Better Auth models (new — additive to the same `schema.prisma`): generate
   Better Auth's standard `User`, `Session`, `Account`, `Verification` models
   via its own schema-generation step (`@better-auth/cli generate`, targeting
   the Prisma adapter), rather than hand-authoring them — these tables are owned
   by Better Auth, this feature only declares the adapter configuration that
   points Better Auth at `PrismaService`'s connection. `Tenant` and Better
   Auth's models coexist in one schema/migration history; there is no foreign
   key from `Tenant` to `User` in v1 (operators are not scoped per tenant —
   there is exactly one operator identity space).

### Configure Environment - `env.ts` / `load-env.ts`

1. Responsibility: Fail-fast typed environment for `apps/api` so missing
   `DATABASE_URL` / `BETTER_AUTH_SECRET` never reach request handling.
2. Logic: `load-env.ts` resolves `apps/api/.env` relative to compiled
   `__dirname` and calls `process.loadEnvFile` when the file exists. `env.ts`
   imports `./load-env` then `createEnv` (`@t3-oss/env-core`) with Valibot:
   required `DATABASE_URL` (URL) and `BETTER_AUTH_SECRET` (non-empty); optional
   `PORT` (digits → number 1–65535), `BETTER_AUTH_URL` (default
   `http://localhost:4000`), `CORS_ORIGIN` (default `http://localhost:3000`).
   `emptyStringAsUndefined: true`. `skipValidation` when
   `SKIP_ENV_VALIDATION === 'true'` (escape hatch; tests currently seed env in
   `test/setup-env.ts` instead).
3. Web: `apps/web/src/env.ts` validates optional `VITE_API_URL` (default
   `http://localhost:4000`); `authClient` uses `env.VITE_API_URL`.

### Configure Auth - `BetterAuthService`

1. Responsibility: Own the single configured Better Auth server instance for the
   app — the one place `betterAuth(...)` is constructed, so no other file
   re-configures or re-instantiates it.
2. Attributes: holds the Better Auth instance constructed in the constructor via
   private `createAuth()`. Configured with the Prisma adapter (pointed at the
   injected `PrismaService` client, PostgreSQL provider), `baseURL` from
   `env.BETTER_AUTH_URL`, `trustedOrigins` from `parseCorsOrigins()`, `secret`
   from `env.BETTER_AUTH_SECRET`, and email/password sign-in enabled.
   `sendResetPassword` currently logs `{user.email, url}` at Nest logger info
   (no mail provider in v1). No social/OAuth providers. No `OnModuleInit` secret
   check — T3 Env already rejected a missing secret at import.
3. Methods:
   - `getSession(headers: Headers): Promise<{ operatorUserId: string } | null>`
     - Logic: delegate to Better Auth's own session-verification API, passing
       the incoming request's headers (which carry the session cookie); on a
       valid session, return `{ operatorUserId: session.user.id }`; on
       no/invalid session, return `null` — no exception thrown here, the caller
       (`OperatorAuthGuard`) decides how to react.
4. Constraints: `BETTER_AUTH_SECRET` is a required environment variable (Better
   Auth uses it to sign session tokens) — validated by `env.ts` at process
   start, same discipline as `DATABASE_URL`.

### Create Controller - `AuthController`

1. Responsibility: Mount Better Auth's own request handler onto Nest's HTTP
   server, so `/api/auth/*` (sign-in, sign-out, session refresh, etc.) is served
   by Better Auth itself rather than reimplemented.
2. Routes:
   - Catch-all under `/api/auth/*` → forwarded verbatim to `BetterAuthService`'s
     underlying handler; Better Auth owns the exact sub-route shapes (e.g.
     `/api/auth/sign-in/email`), not this feature.
3. Annotations: `@Controller('api/auth')` plus `@All('*splat')`, forwarding
   `req`/`res` to `toNodeHandler(this.betterAuthService.auth)` — no
   `ValidationPipe` on this controller. `main.ts` creates Nest with
   `{ bodyParser: false }` and applies `express.json()` only for paths that do
   not start with `/api/auth`. `GlobalExceptionFilter` is still registered
   globally; Better Auth writes its own JSON error bodies for auth routes when
   it handles the response first.
4. Constraints: this controller is unguarded (no
   `TenantAuthGuard`/`OperatorAuthGuard`) — it is the entry point _to_
   authentication, not a protected resource; `OperatorAuthGuard` is what
   protects everything downstream of a successful sign-in.

### Create Utility - `TenantCredentialService`

1. Responsibility: Single owner of credential/secret generation and hashing so
   no other file re-implements crypto logic.
2. Methods:
   - `generateApiKey(): { raw: string; hash: string }`
     - Logic:
       - Generate 32 bytes of cryptographically secure randomness
         (`crypto.randomBytes`).
       - Format raw key as `cf_live_<base64url-encoded-bytes>`.
       - Compute SHA-256 hex digest of the raw key as `hash`.
       - Return both; caller persists only `hash`, returns `raw` to the operator
         exactly once.
   - `hashApiKey(raw: string): string`
     - Logic: SHA-256 hex digest of the input, used by `TenantAuthGuard` to look
       up by hash.
   - `generateWebhookSecret(): string`
     - Logic: Generate 32 bytes of secure randomness, return as a base64url
       string; stored as `webhookSecret` on create only (no rotation path in
       v1).
3. Constraints: Never log the raw key or secret at any log level, in this
   service or any caller — enforced by code review, called out explicitly in
   Safeguards.

### Create Mapper - `toTenantPublicStatus`

1. Responsibility: Single mapping from Prisma `TenantStatus` (`ACTIVE` /
   `SUSPENDED`) to contract JSON literals (`active` / `suspended`).
2. Package: `apps/api/src/tenants/tenant-status.ts`.
3. Methods:
   - `toTenantPublicStatus(status: TenantStatus): TenantPublicStatus`
     - Logic: switch on enum members; TypeScript exhaustiveness (no default).
4. Usage: `OperatorTenantsService.toSafeResponse` / `createTenant` return
   mapping, and `TenantsService.getSelf`.

### Implement Service - `OperatorTenantsService`

1. Interface Definition: `createTenant`, `suspendTenant`, `reactivateTenant`,
   `rotateKey`, `getTenant`.
2. Core Methods:
   - `createTenant(dto: CreateTenantDto): Promise<TenantIssuedResponseDto>`
     - Input Validation: `dto` already validated by `ValidationPipe`
       (name/slug/webhookUrl required; `slug` must match
       `^[a-z0-9]+(-[a-z0-9]+)*$`; `webhookUrl` must be well-formed HTTPS via
       `@IsUrl({ protocols: ['https'], require_protocol: true })`).
     - Business Logic: generate `apiKey`/`webhookSecret` via
       `TenantCredentialService`; attempt `prisma.tenant.create(...)` with
       `status: TenantStatus.ACTIVE`; on Prisma unique-constraint violation
       (`P2002` whose `meta.target` includes `slug`), throw
       `DuplicateTenantSlugException`. Other `P2002`s (e.g. `apiKeyHash`) are
       not translated here.
     - Exception Handling: malformed/missing `webhookUrl` → `ValidationPipe`
       throws `400` before reaching the service (FR-002); duplicate slug →
       `DuplicateTenantSlugException` → `409` via `GlobalExceptionFilter`
       (FR-003).
     - Return Value: `TenantIssuedResponseDto` including the raw `apiKey` and
       `webhookSecret` (only time either is ever returned in plaintext). JSON
       `status` MUST be the contract literals `active` / `suspended`, mapped
       from Prisma `TenantStatus` (`ACTIVE` / `SUSPENDED`) at the DTO boundary —
       never serialize the Prisma enum members. Controller `@HttpCode(CREATED)`
       returns HTTP `201`.
   - `suspendTenant(tenantId: string): Promise<TenantSafeResponseDto>`
     - Business Logic: `setStatus(tenantId, TenantStatus.SUSPENDED)` —
       `getTenantOrThrow` then `prisma.tenant.update`; idempotent — if already
       `SUSPENDED`, still returns `200` with unchanged record (no error).
     - Exception Handling: unknown `tenantId` → `TenantNotFoundException` →
       `404 Not Found` (lookup before update, not a raw Prisma P2025).
     - Return Value: `TenantSafeResponseDto` (no secrets); JSON `status` is
       `active` / `suspended`.
   - `reactivateTenant(tenantId: string): Promise<TenantSafeResponseDto>`
     - Business Logic: mirrors `suspendTenant` via `setStatus(..., ACTIVE)`,
       idempotent.
     - Return Value: `TenantSafeResponseDto`.
   - `rotateKey(tenantId: string): Promise<RotateKeyResponseDto>`
     - Business Logic: `getTenantOrThrow`; generate new `apiKey` via
       `TenantCredentialService`; update `apiKeyHash` in place on the existing
       row; old key immediately stops resolving (no multi-key window in v1, per
       FR-012/Assumptions).
     - Return Value: `RotateKeyResponseDto` with the new raw `apiKey` (shown
       once).
   - `getTenant(tenantId: string): Promise<TenantSafeResponseDto>`
     - Business Logic: `getTenantOrThrow` then `toSafeResponse`; used by
       operator to confirm historical data survived suspension (FR-010).
     - Exception Handling: unknown `tenantId` → `404 Not Found`.
3. Helpers: private `getTenantOrThrow`, `setStatus`, `toSafeResponse`; module
   function `isSlugUniqueViolation`.
4. Dependency Injection: `PrismaService`, `TenantCredentialService`.
5. Transaction Management: `createTenant` is a single-statement Prisma call
   relying on the DB unique constraint for atomicity — no explicit transaction
   block needed since there is exactly one write.

### Implement Service - `TenantsService`

1. Interface Definition: `getSelf`.
2. Core Methods:
   - `getSelf(tenantId: string): Promise<TenantSafeResponseDto>`
     - Input Validation: `tenantId` comes only from `RequestTenantContext`
       (attached by `TenantAuthGuard`), never from a route param — this handler
       takes no tenant-identifying input from the caller (FR-006).
     - Business Logic: fetch tenant by `id`; this is the canonical "confirm my
       own identity resolved correctly" endpoint (User Story 2's independent
       test). Missing row after a resolved `tenantId` →
       `TenantNotFoundException` (defensive; the guard already required an
       active tenant).
     - Return Value: `TenantSafeResponseDto` via `toTenantPublicStatus`.
3. Dependency Injection: `PrismaService`.

### Create Guard - `TenantAuthGuard`

1. Responsibility: Resolve every tenant-facing request to exactly one `tenantId`
   from the `Authorization: Bearer <key>` header, or reject before any handler
   runs (FR-004, FR-005, FR-008 entry point).
2. Methods:
   - `canActivate(context: ExecutionContext): Promise<boolean>`
     - Logic:
       - Extract `Authorization` header; if missing or not `Bearer <token>`
         shape → throw `InvalidCredentialException` (→ `401`).
       - Hash the token via `TenantCredentialService.hashApiKey`; look up
         `Tenant` by `apiKeyHash`.
       - No match → throw `InvalidCredentialException` (→ `401`) — no tenant
         identity resolved, matches contract's "invalid key doesn't confirm
         whether any tenant uses it."
       - Match but `status === SUSPENDED` → throw `TenantSuspendedException` (→
         `403`) — authenticated but rejected, distinguishable per contract from
         `401`.
       - Match and `status === ACTIVE` → attach `{ tenantId: tenant.id }` to
         `request` (as `RequestTenantContext`), return `true`.
3. Annotations: applied via `@UseGuards(TenantAuthGuard)` on `TenantsController`
   (and every future tenant-facing controller in 002+).
4. Constraints: Never accepts `tenantId` from body/query/param as an override or
   fallback (FR-006) — the only input is the header.

### Create Guard - `OperatorAuthGuard`

1. Responsibility: Gate the `/operator/tenants/*` surface with a real,
   per-operator authenticated session (via Better Auth), distinct from any
   tenant's API key and distinct from a single shared secret — so no tenant API
   key can reach operator endpoints, and operator access is now tied to an
   individual login, not a value anyone with the env var could use.
2. Methods:
   - `canActivate(context: ExecutionContext): Promise<boolean>`
     - Logic: copy Express `request.headers` into a Fetch `Headers` instance
       (string and string-array values only), then call
       `BetterAuthService.getSession(headers)`; `null` (missing/invalid/expired
       session cookie) → throw `InvalidCredentialException` (→ `401`, same
       message as tenant credential failures:
       `"Invalid or missing API credential"`); a resolved session → attach
       `{ operatorUserId }` to `request` (as `RequestOperatorContext`), return
       `true`.
3. Annotations: applied via `@UseGuards(OperatorAuthGuard)` on
   `OperatorTenantsController`.
4. Constraints: never accepts an `X-Operator-Key` header or any static shared
   secret as a fallback — the only valid input is a Better Auth session cookie.
   `OPERATOR_API_KEY` is retired entirely by this update; `BETTER_AUTH_SECRET`
   (see `env.ts` / `BetterAuthService`) replaces it as the required environment
   variable the app fails fast on if unset.

### Add Operator Login Page - `apps/web`

1. Responsibility: Give the operator an actual screen to authenticate against,
   since `OperatorAuthGuard` now depends on a real Better Auth session existing
   — without this, the guard would have no way to ever be satisfied.
2. Scope: email/password sign-in at TanStack route `/auth/login`
   (`apps/web/src/modules/auth/login`), using Better Auth's client SDK
   (`createAuthClient` in `apps/web/src/integrates/auth.ts`, pointed at
   `${env.VITE_API_URL}/api/auth`) via `authClient.signIn.email`; on success,
   navigate to `/`. Forgot-password (`/auth/forgot-password`) and reset-password
   (`/auth/reset-password`) pages call `authClient.requestPasswordReset` /
   `authClient.resetPassword` against the same API; reset email delivery is the
   API log line in `BetterAuthService.sendResetPassword` until a mail provider
   is configured. UI primitives for these forms live in `@crossfade/ui`
   (`Alert`, `Field`, `Label`).
3. Constraints: no operator dashboard/tenant-management UI is in scope beyond
   authentication screens. Visual design/UX treatment is an implementation
   detail, not specified further by this canvas.

### Seed Local Operator - `apps/api/prisma/seed.ts`

1. Responsibility: Idempotently upsert a local operator `User` + credential
   `Account` so `/auth/login` can be used without a public sign-up flow.
2. Logic: hash the password with `hashPassword` from `better-auth/crypto`;
   create or update `providerId: credential`, `accountId: user.id`,
   `issuer: local:credential`. Run with `pnpm prisma:seed`
   (`tsx prisma/seed.ts`).
3. Constraints: for local development only; never log the raw password after
   hashing. Re-running the seed updates the stored hash and issuer so sign-in
   stays aligned with Better Auth 1.7 account matching.

### Create Controller - `OperatorTenantsController`

1. Responsibility: Expose the privileged tenant-lifecycle API (FR-001, FR-009,
   FR-011, FR-012).
2. Routes:
   - `POST /operator/tenants` — body: `CreateTenantDto` → `201`
     `TenantIssuedResponseDto` | `400` | `409`.
   - `POST /operator/tenants/:id/suspend` → `200` `TenantSafeResponseDto` |
     `404`.
   - `POST /operator/tenants/:id/reactivate` → `200` `TenantSafeResponseDto` |
     `404`.
   - `POST /operator/tenants/:id/rotate-key` → `200` `RotateKeyResponseDto` |
     `404`.
   - `GET /operator/tenants/:id` → `200` `TenantSafeResponseDto` | `404`.
3. Annotations: `@Controller('operator/tenants')`,
   `@UseGuards(OperatorAuthGuard)` at class level, `@Body()`/`@Param('id')` per
   route, `ValidationPipe` applied globally for `CreateTenantDto`.
   `@HttpCode(HttpStatus.CREATED)` on create; `@HttpCode(HttpStatus.OK)` on
   `suspend` / `reactivate` / `rotate-key` (GET getTenant uses Nest default
   200).
4. Constraints: never returns `apiKeyHash` or `webhookSecret` on any route
   except the plaintext-once fields on create/rotate responses.

### Create Controller - `TenantsController`

1. Responsibility: Expose the tenant self-identity endpoint (User Story 2's
   independent test surface, and the pattern 002+ controllers copy).
2. Routes:
   - `GET /tenants/me` → `200` `TenantSafeResponseDto` | `401` | `403`.
3. Annotations: `@Controller('tenants')`, `@UseGuards(TenantAuthGuard)` at class
   level; reads `tenantId` from `request` (attached by guard), never from a
   param.

### Create Exception Handler - `GlobalExceptionFilter`

1. Responsibility: Unified translation of all thrown exceptions (domain
   `BusinessException` subclasses, Prisma errors, Nest's built-in
   `HttpException`s) into one `ErrorResponse` shape.
2. Exception Types:
   - `InvalidCredentialException` → `401`, message
     `"Invalid or missing API credential"`.
   - `TenantSuspendedException` → `403`, message `"Tenant is suspended"`.
   - `DuplicateTenantSlugException` → `409`, message
     `"Tenant slug already registered"`.
   - `TenantNotFoundException` → `404`, message `"Tenant not found"`.
   - Prisma `PrismaClientKnownRequestError` (`P2002`) not already caught by a
     service → mapped defensively to `409` with message
     `"Resource already exists"`.
   - Nest `HttpException` (including `ValidationPipe` `400` and
     `BusinessException` subclasses) → status from the exception; `message`
     string or joined array from the exception body.
   - Anything uncaught → `500`, generic message only (no stack trace, no
     internal detail in the response body).
3. Methods:
   - `catch(exception: unknown, host: ArgumentsHost): void`
     - Logic: inspect exception type/instance, map to `{ statusCode, message }`,
       write via `response.status(...).json(...)`. Log full exception
       server-side (never the raw request body, which may contain nothing
       sensitive here, but guard the pattern for future features that may carry
       credentials in-body).
4. Annotations: `@Catch()`, registered globally via
   `app.useGlobalFilters(new GlobalExceptionFilter())` in `main.ts`.
5. Response Format: `{ statusCode: number; message: string }` — matches the
   shape already specified in `contracts/tenant-authentication.md`. `message`
   may be a comma-joined string when ValidationPipe returns an array.

### Create Business Exceptions

1. Inheritance: `BusinessException extends HttpException`;
   `InvalidCredentialException`, `TenantSuspendedException`,
   `DuplicateTenantSlugException`, `TenantNotFoundException` all
   `extends BusinessException`.
2. Attributes: each subclass fixes its own HTTP status and message at
   construction (no dynamic `errorCode` needed — v1 has no client-facing
   error-code taxonomy beyond HTTP status + message, per the two existing
   contracts).
3. Constructors: each subclass takes an optional message override, defaults to
   the contract-specified message.
4. Usage Scenarios: thrown from guards (`TenantAuthGuard`, `OperatorAuthGuard`)
   and services (`OperatorTenantsService`, `TenantsService`) at the exact points
   described in their Operations entries above.

### Add Tests - unit and e2e

1. Responsibility: Lock credential isolation, lifecycle HTTP status, JSON
   `status` literals, and env/auth wiring against regressions.
2. Unit (Jest `rootDir: src`, `setupFiles: test/setup-env.ts`):
   - `tenant-status.spec.ts`, `tenant-credential.service.spec.ts`,
     `operator-tenants.service.spec.ts`, `tenants.controller.spec.ts`,
     `tenant-auth.guard.spec.ts`, `operator-auth.guard.spec.ts`,
     `global-exception.filter.spec.ts`.
3. E2e (`test/jest-e2e.json`,
   `test/tenants/tenant-onboarding-isolation.e2e-spec.ts`): Nest testing module
   with `AppModule`; mock `src/env`; override `BetterAuthService.getSession` to
   accept cookie `e2e-operator-session=1`; same body-parser skip for `/api/auth`
   as `main.ts`; cleanup created tenants after the suite.
4. Constraints: never log or assert plaintext production secrets; test env
   defaults live in `setup-env.ts`.

## Norms

1. Annotation Standards: controllers use `@Controller(path)` + class-level
   `@UseGuards(...)`; DTOs use `class-validator` decorators (`@IsString()`,
   `@IsUrl(...)`, `@IsNotEmpty()`, `@Matches(...)` for slug); providers use
   standard `@Injectable()`; no custom decorators introduced beyond what's
   listed above.
2. Dependency Injection: constructor injection only, one responsibility per
   injected service; guards inject `PrismaService`/`TenantCredentialService`
   directly (no intermediate service layer inside guards, to keep them fast and
   side-effect-free besides the DB lookup).
3. Exception Handling:
   - All business-rule failures throw a `BusinessException` subclass — never
     return an error via a normal return value or a raw `throw new Error(...)`.
   - `BusinessException` subclasses fix HTTP status at the exception, not at the
     filter, so the filter stays a pure dispatcher.
   - Unified error response format: `{ statusCode: number; message: string }`
     for every 4xx/5xx from this module.
   - `GlobalExceptionFilter` logs full exception detail server-side; response
     bodies never include stack traces or raw DB errors.
4. Data Validation: all controller inputs validated via Nest's `ValidationPipe`
   (`whitelist: true, forbidNonWhitelisted: true`) against DTOs; no manual
   `if (!x) throw` validation in controllers or services for shape/format checks
   — only for business-rule checks (uniqueness, status). Slug format is
   `@Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)`.
5. Logging: never log `apiKey`, `webhookSecret`, or their raw values at any log
   level, in any service, guard, or exception filter — only `tenantId`/`slug`
   may appear in logs. This is the single hard rule the plan.md constraint
   (`plaintext credential never logged`) resolves to in code. Extended by this
   update: never log an operator's password or raw session-cookie value either —
   Better Auth's own request handling is trusted to manage this internally, but
   any custom logging added around `OperatorAuthGuard`/`BetterAuthService` must
   follow the same discipline.
6. Documentation Standards: no doc comments required beyond what's already
   specified in `contracts/operator-api.md` and
   `contracts/tenant-authentication.md`, which remain the source of truth for
   request/response shapes — this Operations section must not drift from them.
7. Auth Configuration: `BetterAuthService` is the single place `betterAuth(...)`
   is constructed — no controller, guard, or service outside it may import
   Better Auth's server-side configuration APIs directly; `OperatorAuthGuard`
   only ever calls `BetterAuthService.getSession(...)`. CORS origins for the
   session cookie are owned by `parseCorsOrigins()` reading `env.CORS_ORIGIN`.
   Process env is not read ad hoc in services/guards for those keys.
8. Environment Validation: `apps/api/src/env.ts` is the single validated env
   object for the API; `apps/web/src/env.ts` is the single validated env object
   for the web client. Do not scatter `process.env.BETTER_AUTH_*` /
   `process.env.VITE_API_URL` reads outside those modules (tests may mock
   `src/env` or set defaults in `setup-env.ts`).
9. Prisma Imports: application TypeScript under `apps/api/src` imports Prisma
   types and the client from `prisma/client.ts`, never from `@prisma/client` or
   `generated/prisma` directly (seed is the exception: it imports generated
   `PrismaClient` because it is not a Nest provider).

## Safeguards

1. Functional Constraints: every tenant-facing route MUST be behind
   `TenantAuthGuard`; every operator route MUST be behind `OperatorAuthGuard`;
   no route may accept a `tenantId` as a path/query/body parameter that
   overrides the guard-resolved value (FR-006).
2. Performance Constraints: `TenantAuthGuard`'s per-request lookup MUST be a
   single indexed query (`apiKeyHash` is `@unique`, in addition to `slug`); no
   N+1 or additional round-trips in the auth path.
3. Security Constraints: raw `apiKey`/`webhookSecret` MUST be returned in
   plaintext only in the exact create/rotate response bodies specified in
   `contracts/operator-api.md`, and MUST NOT be persisted, logged, or returned
   by any other route (including `GET /operator/tenants/:id`); `apiKeyHash` MUST
   use SHA-256 (or stronger) over the full-entropy random token, never a fast
   general hash misapplied to a weak input. Operator session cookies (issued by
   Better Auth) MUST be `httpOnly` and `secure` in any non-local environment —
   never readable by client-side JavaScript, never transmitted over plain HTTP.
4. Integration Constraints: this feature's touch on `apps/web` is limited
   strictly to operator authentication (login, forgot-password, reset-password)
   and Better Auth client wiring — it MUST NOT introduce any endpoint or
   behavior related to self-serve tenant signup, billing/plan tiers, or
   multi-advisor assignment (FR-013, explicit non-goals), and MUST NOT build out
   any operator dashboard/UI beyond those auth screens.
5. Business Rule Constraints: `slug` uniqueness MUST be enforced at the database
   level (unique index), not only in application code, to close the
   concurrent-registration race; suspend/reactivate MUST be idempotent (repeat
   calls return `200`, never an error).
6. Exception Handling Constraints:
   - Every `BusinessException` subclass MUST map to exactly one HTTP status and
     a fixed, non-internal message.
   - Exception messages MUST NOT expose whether a given `slug` or `tenantId`
     belongs to another tenant when the requester is not that tenant —
     cross-tenant reference attempts always return `404`, never `403` or a
     message implying existence (FR-008).
   - All business exceptions MUST be caught and formatted by
     `GlobalExceptionFilter` — no controller/service may format its own error
     response.
7. Technical Constraints: this feature is the first to introduce
   Prisma/PostgreSQL into `apps/api` — schema changes MUST go through Prisma
   migrations (no manual DB changes); `PrismaService` MUST be the only Prisma
   client instance in the app (shared, injectable, not re-instantiated per
   module); Better Auth's Prisma adapter MUST be configured against that same
   connection, never a second pool. `BETTER_AUTH_SECRET` MUST be a required
   environment variable with a fail-fast boot check in `apps/api/src/env.ts` (T3
   Env + Valibot), replacing the retired `OPERATOR_API_KEY` variable entirely.
   `DATABASE_URL` MUST likewise fail fast if missing or not a URL.
8. Data Constraints: `slug` MUST be validated as URL-safe (lowercase
   alphanumeric + hyphen) and immutable after creation; `webhookUrl` MUST be
   validated as a well-formed HTTPS URL at registration (hard reject on
   malformed, no reachability check required to pass).
9. API Constraints: response shapes MUST exactly match
   `contracts/operator-api.md` and `contracts/tenant-authentication.md` (status
   codes, field names, once-only secret fields) — these two contract files are
   binding, not illustrative, for this implementation. JSON `status` MUST be
   `active` or `suspended`. Persistence MAY keep Prisma `TenantStatus` (`ACTIVE`
   / `SUSPENDED`); mapping happens in the service-to-DTO layer, not by changing
   the database enum.
