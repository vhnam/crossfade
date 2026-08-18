# Phase 0 Research: Session Outcome & Callback

## Context

Fourth and terminal feature on `apps/api`, building on 001 (tenant + webhook
registration), 002 (`Session` creation), and 003 (`Session` lifecycle to
`ended`/`abandoned`, advisor identity, message transcript). New decisions here:
exactly-once outcome recording under concurrent triggers, webhook signing
scheme, and retry/backoff mechanics.

## Decisions

### Exactly-once outcome recording: DB unique constraint on `sessionId`, same pattern as 002/003

- **Decision**: `Outcome.sessionId` is a unique foreign key (one-to-one with
  `Session`). Both the explicit "advisor ends session" path and 003's
  abandonment sweep attempt to `INSERT ... ON CONFLICT (sessionId) DO NOTHING`
  when recording the outcome; whichever write wins is the outcome of record, and
  the loser's path simply proceeds without error (since the row now exists).
- **Rationale**: FR-007/SC-006 require exactly one outcome per session even
  under a race between an advisor's explicit end and the abandonment sweep
  firing near-simultaneously. This is the same "database as single source of
  truth for a race" pattern already used in 002 (duplicate-handoff prevention)
  and 003 (concurrent pickup) — consistent approach across the whole chain
  rather than inventing a new concurrency primitive for this feature.
- **Alternatives considered**:
  - **Application-level distributed lock per session**: rejected for the same
    reason as 002/003 — doesn't hold across multiple API instances.
  - **Only ever transition via one code path (merge sweep and explicit-end into
    one function with a lock)**: rejected — 003 already owns the
    state-transition logic; duplicating or reaching into it from this feature
    couples the two modules more tightly than a shared unique-constraint
    contract does.

### Webhook signing: HMAC-SHA256 over the raw payload, secret from 001's `Tenant.webhookSecret`

- **Decision**: Sign each webhook payload with
  `HMAC-SHA256(tenant's current webhookSecret, rawJsonBody)`, sent as a header
  (e.g. `X-Crossfade-Signature: sha256=<hex>`). The secret is read fresh from
  the `Tenant` row at delivery time (not cached from session creation),
  satisfying FR-009's requirement that rotation between session start and
  conclusion is respected.
- **Rationale**: FR-002/SC-002 require tenant-verifiable signing. HMAC-SHA256
  over the raw body is the standard, minimal-dependency approach (matches common
  webhook conventions — e.g. Stripe/GitHub style) and needs no new dependency
  beyond Node's built-in `crypto`, consistent with this project's preference for
  minimal added dependencies (001/002/003 introduced no signing library either).
- **Alternatives considered**:
  - **Asymmetric signing (e.g. RSA/Ed25519)**: rejected — no requirement for
    tenants to avoid holding a shared secret; 001 already models the webhook
    secret as a shared value the tenant possesses, so symmetric HMAC is the
    natural continuation, not a new trust model.

### Retry/backoff: scheduled sweep of due `WebhookDeliveryAttempt` rows, same scheduler pattern as 003

- **Decision**: On outcome recording, create a `WebhookDeliveryAttempt` row with
  `status: pending`, `nextAttemptAt: now`. A periodic `@nestjs/schedule` job
  (reusing 003's in-process scheduler pattern) picks up due attempts, performs
  the HTTP call, and on failure updates `attemptCount`/`nextAttemptAt` using
  exponential backoff (e.g. 1m, 5m, 30m, 2h, 12h — capped around 5-6 attempts
  over roughly a day) until either a `2xx` response is received or attempts are
  exhausted (then `status: failed`, but the `Outcome` row itself remains fully
  retrievable regardless — FR-005).
- **Rationale**: FR-003 requires retry-with-backoff instead of dropping failed
  deliveries. A scheduled sweep (vs. an in-memory timer per delivery) is
  restart-safe and consistent with 003's own choice to reject in-memory
  per-entity timers for the same reason (research.md, 003). At v1's low volume
  (single tenant), a dedicated job queue (BullMQ/Redis) is unjustified
  infrastructure — the same reasoning 003 used to reject Redis-backed delayed
  jobs for the abandonment sweep.
- **Alternatives considered**:
  - **Synchronous delivery attempt inline with outcome recording, no retry
    table**: rejected — cannot satisfy FR-003's retry requirement; a single
    synchronous attempt either blocks the end-session request on an unreliable
    third-party endpoint or silently drops failures.
  - **Third-party webhook delivery service**: rejected as unjustified external
    dependency at v1 scale; revisit if delivery volume or reliability
    requirements grow.

### Note length limit: bounded at the DTO/validation layer, not the data model

- **Decision**: The advisor's free-text note is capped at 500 characters,
  enforced by request validation (DTO), not truncated silently.
- **Rationale**: Spec edge case requires rejection or truncation with a clear
  limit, not unbounded storage; explicit rejection (400 on over-length input) is
  more honest to the advisor than silent truncation, which could lose meaning
  without them knowing.
- **Alternatives considered**:
  - **Silent truncation**: rejected — spec edge case allows it but an advisor
    silently losing part of their note is worse UX than an immediate, clear
    validation error.

## Resolved Technical Context

All Technical Context fields in `plan.md` are resolved by the decisions above
plus inheritance from 001/002/003 — no outstanding NEEDS CLARIFICATION.
