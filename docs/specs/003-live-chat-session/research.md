# Phase 0 Research: Live 1:1 Chat Session

## Context

Third feature on `apps/api`, building on 001's stack (NestJS 11 + Prisma

- PostgreSQL, tenant auth guard) and 002's `Session` entity. This is the first
  feature needing real-time delivery and the first needing an advisor identity
  (no prior feature registers advisors), so those are the two genuinely new
  decisions.

## Decisions

### Real-time transport: WebSocket gateway via `@nestjs/websockets` (Socket.IO adapter)

- **Decision**: Use NestJS's `@nestjs/websockets` module with the Socket.IO
  adapter for message delivery. Each `active` session maps to a Socket.IO room;
  the user and assigned advisor both join that room on connect, and messages are
  broadcast to the room.
- **Rationale**: FR-004 requires real-time bidirectional delivery for the
  duration of an `active` session — a persistent connection is the natural fit
  over polling. Socket.IO is the most common pairing with NestJS (first-class
  adapter, reconnection handling, room primitives map directly onto "one session
  = one room"), and gives SC-002's sub-second perceived latency without custom
  infrastructure. Using NestJS's own gateway abstraction keeps auth (guards),
  DI, and the rest of the request lifecycle consistent with the REST controllers
  in 001/002 rather than standing up a separate WS server.
- **Alternatives considered**:
  - **Server-Sent Events (SSE)**: rejected — one-directional (server→client);
    would need a separate REST POST path for the other direction, more moving
    parts than one bidirectional channel.
  - **Raw `ws` library**: rejected — loses Socket.IO's reconnection/room
    conveniences for marginal overhead savings not justified at v1 scale (one
    advisor per tenant, FR-011).
  - **Polling**: rejected outright — cannot plausibly meet "real time" (FR-004)
    or SC-002's instantaneous-perceived-delivery bar.

### Advisor identity: new lightweight `Advisor` entity + separate auth guard

- **Decision**: Introduce an `Advisor` record (scoped to one tenant, with a
  disclosed display name) and a distinct advisor-auth mechanism (credential
  resolves to `tenantId` + `advisorId`), parallel to but separate from 001's
  tenant-auth guard. Advisor provisioning mechanics (how an advisor's credential
  is first issued) are treated the same way 001 treated tenant provisioning: an
  operator-driven action, not self-serve, consistent with v1's
  single-advisor-per-tenant assumption (FR-011).
- **Rationale**: No prior feature defines "advisor" as an authenticated actor —
  001 only authenticates tenants (source applications), not individual people.
  FR-001 requires an advisor to see only their own tenant's sessions, and FR-007
  requires a disclosed identity per advisor, so an advisor needs its own
  identity distinct from the tenant's API credential. Keeping this a separate
  guard (rather than overloading tenant auth) preserves 001's isolation
  guarantee cleanly: the tenant's API key authenticates the _source
  application_; the advisor's credential authenticates a _person_ who happens to
  work for that tenant.
- **Alternatives considered**:
  - **Reuse tenant API key for advisor actions**: rejected — conflates "the
    tenant's backend calling Crossfade" with "a specific human advisor acting,"
    and can't support FR-007's per-advisor disclosed identity or "exactly one
    advisor assigned" (FR-003) without an advisor-level identity anyway.
  - **Full auth system (JWT + login flow) for advisors**: rejected for v1 — same
    reasoning 001 used to reject JWT for tenants: no self-serve signup exists
    yet, so an issued long-lived credential is simplest thing that satisfies the
    requirements.

### Concurrent pickup safety: same pattern as 002's duplicate-handoff guard

- **Decision**: Enforce "at most one advisor per session" with a conditional
  update —
  `UPDATE Session SET advisorId = ?, status = 'active' WHERE id = ? AND status = 'waiting'`
  — checking the affected row count. If zero rows affected, the pickup is
  rejected (session was already picked up or isn't `waiting`).
- **Rationale**: FR-003/SC-003 require exactly one success under concurrent
  pickup attempts on the same session. A conditional (compare-and-swap style)
  update is atomic at the database level, avoiding the same read-then-write race
  002's research.md already identified and solved with a DB-level constraint.
  Consistent pattern across features 002 and 003 for "prevent double-claiming a
  resource under race."
- **Alternatives considered**:
  - **Application-level lock**: rejected for the same reason as 002 — doesn't
    hold across multiple API instances.

### Abandonment sweep: in-process scheduled job (`@nestjs/schedule`)

- **Decision**: A periodic job (e.g., every 1 minute) queries `active` sessions
  whose most recent activity timestamp exceeds the inactivity window (30
  minutes, per spec Assumptions) and transitions them to `abandoned` in a batch
  update.
- **Rationale**: FR-009 requires the transition to happen "automatically" — it
  must not depend on a client being connected to trigger it (a disconnected user
  can't "check itself" into abandonment). A scheduled sweep decouples the
  transition from any live connection. `@nestjs/schedule` is the standard
  NestJS-native way to run periodic jobs in-process, appropriate at v1 scale
  (single advisor per tenant, no need for a separate job-queue infrastructure).
- **Alternatives considered**:
  - **Per-session timer set on last activity**: rejected — N in-memory timers
    don't survive a process restart and don't work if the API scales to multiple
    instances (a timer set on instance A is invisible to instance B); a periodic
    sweep query is simpler and restart-safe.
  - **Redis-backed delayed job per session**: rejected as premature
    infrastructure for v1's scale — revisit if sweep query performance ever
    becomes a bottleneck.

### Message activity resets inactivity clock: derive from `Message.createdAt`, no separate "last activity" column

- **Decision**: The abandonment sweep computes each session's last activity as
  `max(Session.createdAt, most recent Message.createdAt)` at query time rather
  than maintaining a separately-updated `lastActivityAt` column on `Session`.
- **Rationale**: FR-010 requires activity to reset the inactivity clock.
  Deriving it from the `Message` table's own timestamps avoids a second write on
  every message send (simpler, no risk of the two getting out of sync) at v1's
  message volume; the sweep query already has to touch `active` sessions, so an
  aggregate join is cheap enough to not need a denormalized column yet.
- **Alternatives considered**:
  - **Denormalized `lastActivityAt` column, updated per message**: rejected for
    v1 as a premature optimization — revisit if the sweep query's join becomes a
    measured bottleneck at higher message volume.

## Resolved Technical Context

All Technical Context fields in `plan.md` are resolved by the decisions above
(plus inheritance from 001/002) — no outstanding NEEDS CLARIFICATION.
