# Phase 0 Research: Tenant Onboarding & Isolation

## Context

`apps/api` is a fresh NestJS 11 skeleton (Express platform) with no ORM,
database, or auth mechanism chosen yet. This feature is the first to need
persistence and request authentication, so those choices are made here and
become the baseline for every later Crossfade feature (handoff requests, advisor
management, sessions).

## Decisions

### Storage: PostgreSQL + Prisma

- **Decision**: Use PostgreSQL as the datastore, accessed via Prisma as the
  ORM/migration tool.
- **Rationale**: Tenant records, credentials, and (soon) sessions/transcripts
  are relational with clear ownership boundaries (tenant → advisor → session) —
  a good fit for a relational store. Prisma gives first-class TypeScript types
  matching NestJS's TS-first stack, and its migration system directly satisfies
  the `db-use-migrations` best practice. PostgreSQL is the de facto default for
  new NestJS services and is well supported by every likely hosting target.
- **Alternatives considered**:
  - **MongoDB**: rejected — no strong document/nested-data shape here,
    relational isolation invariants (FR-008, no cross-tenant reads) are easier
    to enforce with foreign keys than with app-level filtering discipline.
  - **TypeORM**: rejected in favor of Prisma — Prisma's generated client and
    migration diffing needs less boilerplate for a small early-stage schema than
    TypeORM's decorator-based entities.
  - **SQLite**: rejected — fine for local dev but not a realistic production
    target once webhook delivery and later features add concurrent writes.

### Tenant authentication: API key (bearer token) + Nest Guard

- **Decision**: Each tenant has exactly one active opaque API key (long random
  token). Requests authenticate via an `Authorization: Bearer <key>` header. A
  custom NestJS `AuthGuard`/strategy hashes the incoming key and looks up the
  matching tenant by hash; no tenant identity is ever accepted from the request
  body (FR-006).
- **Rationale**: Matches FR-004/FR-005/FR-006 directly — one credential resolves
  to exactly one tenant, invalid/missing credentials are rejected before any
  tenant is resolved. API keys (vs. JWT/OAuth) are the simplest mechanism that
  satisfies "tenant authenticates itself" without needing an issuing/refresh
  flow — appropriate for a single, manually-onboarded tenant in v1. Storing only
  a hash (not the raw key) follows `security-validate-all-input`/`security-*`
  guidance and means a database leak doesn't leak usable credentials.
- **Alternatives considered**:
  - **JWT issued per tenant**: rejected for v1 — adds signing-key management and
    expiry/refresh complexity with no benefit when there's one long-lived tenant
    relationship, not end users logging in and out.
  - **mTLS client certificates**: rejected — high operational overhead for
    onboarding a single manually-configured tenant; revisit only if a compliance
    requirement demands it.

### Credential rotation

- **Decision**: Rotating a credential replaces the stored hash on the existing
  tenant record (new raw key issued once to the operator, old key immediately
  invalid). No overlapping multi-credential window in v1 (per spec Assumptions).
- **Rationale**: Matches FR-012 exactly and keeps the credential model to a
  single column instead of a separate credentials table — simplest thing that
  satisfies the requirement.

### Webhook URL validation at registration

- **Decision**: At registration, the webhook URL is validated for
  well-formedness (valid HTTPS URL) synchronously; reachability (actually
  pinging the endpoint) is NOT required to succeed for registration to complete.
- **Rationale**: Spec's edge case says a malformed/unreachable URL should be
  "rejected or flagged" — treating malformed as a hard reject (FR-002-adjacent)
  and unreachable as accepted-but-flaggable avoids blocking legitimate
  onboarding on transient network issues (e.g., tenant's endpoint not deployed
  yet at registration time), while still catching typos immediately.
- **Alternatives considered**: Synchronous reachability check on registration —
  rejected, couples tenant onboarding to the tenant's own deploy timing, which
  the spec's non-goals (fails-safe posture, BR-5-adjacent) argue against.

### Operator access surface

- **Decision**: v1 operator actions (create tenant, suspend/reactivate, rotate
  credential) are exposed as authenticated internal API endpoints, not a UI.
  `apps/web` is out of scope for this feature.
- **Rationale**: Spec's Assumptions explicitly leave "how the operator performs
  registration" open and note no separate operator product is assumed yet.
  Internal endpoints are the minimum that unblocks every other Crossfade feature
  depending on this one; a UI can be layered on later without changing the data
  model.

## Resolved Technical Context

All Technical Context fields below are resolved by the decisions above — no
outstanding NEEDS CLARIFICATION.
