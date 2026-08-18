# Phase 0 Research: Handoff Intake

## Context

This feature is the second to touch `apps/api` and depends directly on 001
(tenant onboarding & isolation), which already resolved the base stack: NestJS
11 + Prisma + PostgreSQL, tenant auth via bearer API key resolved to a
`tenantId` in a Nest Guard. No Technical Context field is left as NEEDS
CLARIFICATION — this feature reuses 001's stack rather than introducing new
technology. The remaining open questions are about concurrency-safety and
storage shape for opaque JSON, not tech choice.

## Decisions

### Reuse 001's tenant authentication guard, unmodified

- **Decision**: The `handoffs` module's controller is guarded by the same
  `tenant-auth.guard.ts` built in 001; it does not implement its own auth.
- **Rationale**: Spec explicitly assumes the tenant is already authenticated
  (dependency on 001). Every requirement here (FR-001–FR-007) operates on an
  already-resolved `tenantId`; duplicating auth logic would violate the
  isolation invariant 001 established (tenantId must never come from the request
  body).
- **Alternatives considered**: None — introducing a second auth path for one
  endpoint would fragment the isolation guarantee for no benefit.

### Preventing duplicate sessions under concurrent requests: DB-level uniqueness

- **Decision**: Enforce "at most one non-ended session per (tenantId,
  referenceId)" with a partial unique index in PostgreSQL —
  `UNIQUE (tenantId, referenceId) WHERE status != 'ended'` — rather than a
  read-then-write check in application code. The service attempts an insert; on
  a unique-constraint violation it re-reads and returns the existing session
  instead of creating a new one.
- **Rationale**: FR-004 and the "concurrent near-simultaneous requests" edge
  case require that two racing requests never both succeed in creating a
  session. A check-then-insert in application code has a race window between the
  check and the insert; a partial unique index makes the database the single
  source of truth and is atomic regardless of request timing. This directly
  satisfies SC-003 (0% duplicate-session rate under concurrent submission).
- **Alternatives considered**:
  - **Application-level lock/mutex**: rejected — doesn't hold across multiple
    API instances/processes, which a horizontally-scaled NestJS deployment would
    have.
  - **Advisory DB lock per reference ID**: rejected as unnecessary complexity —
    a partial unique index achieves the same guarantee with a standard
    constraint, no explicit lock management.

### Opaque structured context storage: JSON column, no schema

- **Decision**: Store the tenant-supplied structured context in a Prisma `Json`
  column (`Bytes`/`Json` type mapped to PostgreSQL `jsonb`), passed through the
  API layer without any DTO validation on its internal shape — only that it is
  valid JSON if present.
- **Rationale**: FR-002 requires context to be stored opaquely: not parsed for
  meaning, not validated against a Crossfade-defined schema. `jsonb` is
  PostgreSQL's native fit for "arbitrary structured data, queryable if ever
  needed, but not the source of truth for shape." Validating "is this
  syntactically valid JSON" is not the same as interpreting its contents, so it
  does not violate FR-002.
- **Alternatives considered**:
  - **Store as opaque string/text (tenant sends pre-serialized JSON)**: rejected
    — pushes serialization concerns onto the tenant for no benefit, and `jsonb`
    already guarantees opacity of _meaning_ while still being structured
    storage.

## Resolved Technical Context

All Technical Context fields in `plan.md` are resolved by inheritance from 001
plus the decisions above — no outstanding NEEDS CLARIFICATION.
