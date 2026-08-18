# SPDD Analysis: Handoff Intake

## Original Business Requirement

# Feature Specification: Handoff Intake

**Feature Branch**: `002-handoff-intake`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Handoff Intake — entry point where a tenant (e.g.
Windwise) hands off a user to a live advisor. Crossfade accepts the handoff
request, stores tenant-supplied context opaquely, and creates a session in a
'waiting' state. Depends on feature 001 (tenant onboarding/authentication).
Feature 003 (chat) depends on this."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tenant requests a handoff (Priority: P1)

As a tenant (e.g. Windwise), when my own logic decides a user needs a human, I
send Crossfade a handoff request with a reference to the interaction, a short
summary, a link back to my own record, and any structured context I want the
advisor to see — so a session is created and ready for an advisor to pick up.

**Why this priority**: This is the entry point of the entire handoff flow.
Without it no session can ever exist, and no downstream feature (chat, routing)
has anything to operate on.

**Independent Test**: Can be fully tested by submitting a handoff request with a
tenant reference ID and summary, and verifying a session is created in `waiting`
state with an identifier returned to the tenant — independent of any chat or
routing behavior.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant with no existing session for a given
   interaction reference, **When** it submits a handoff request with a reference
   ID and summary, **Then** Crossfade creates a new session in `waiting` state
   and returns its session identifier.
2. **Given** an authenticated tenant, **When** it submits a handoff request
   including an optional deep link and structured context, **Then** the session
   is created successfully with those fields stored alongside it.
3. **Given** an authenticated tenant, **When** it submits a handoff request
   omitting the optional deep link and structured context, **Then** the session
   is still created successfully.

---

### User Story 2 - Context is preserved, not interpreted (Priority: P2)

As a tenant, whatever structured context I send is stored and shown to the
advisor as-is; Crossfade does not parse it for meaning or use it to make
decisions on my behalf.

**Why this priority**: Tenants need confidence that their data is passed through
faithfully. This is a trust and data-integrity guarantee, not a blocker for the
basic P1 flow to exist, but it must hold before any tenant can be onboarded in
good faith.

**Independent Test**: Can be fully tested by submitting a handoff request with
arbitrary structured context (including content that resembles but does not
match any schema Crossfade might otherwise expect) and verifying the
stored/returned context is byte-for-byte identical to what was sent, with no
request rejected on the basis of its shape.

**Acceptance Scenarios**:

1. **Given** a tenant sends structured context in an arbitrary shape, **When**
   Crossfade stores the handoff request, **Then** the context is persisted
   unchanged and is retrievable in the same shape.
2. **Given** structured context that does not match any particular schema,
   **When** the handoff request is submitted, **Then** Crossfade does not reject
   it for that reason and does not alter its own behavior based on the context's
   contents.

---

### User Story 3 - Duplicate/repeat handoff for the same interaction (Priority: P2)

As a tenant, if I send another handoff request referencing an interaction that
already has an open session, Crossfade tells me the existing session instead of
silently creating a duplicate.

**Why this priority**: Prevents duplicate sessions and confused advisor queues,
which is important for correctness but only matters once the P1 create path
exists.

**Independent Test**: Can be fully tested by submitting two handoff requests
with the same tenant reference ID while the first session is still open (not
ended), and verifying the second call returns the identifier of the same session
rather than creating a new one.

**Acceptance Scenarios**:

1. **Given** a tenant reference ID with an existing session that is not in an
   ended state, **When** the tenant submits another handoff request for the same
   reference ID, **Then** Crossfade returns the existing session's identifier
   and does not create a new session.
2. **Given** a tenant reference ID whose prior session has already ended,
   **When** the tenant submits a new handoff request for that same reference ID,
   **Then** Crossfade creates a new session rather than returning the ended one.

---

### Edge Cases

- What happens when the handoff request is missing the tenant reference ID or
  summary (the two required fields)? Request MUST be rejected.
- What happens when the same tenant reference ID is submitted concurrently by
  two near-simultaneous requests? Only one session must result — the second
  caller must observe the first's session rather than a race producing two
  `waiting` sessions.
- What happens when a tenant references an interaction ID that belongs to a
  different tenant? Request MUST NOT return or duplicate against another
  tenant's session (reference IDs are scoped per tenant).
- How does the system handle structured context that is very large or deeply
  nested? Out of scope for this spec to bound; treated as an
  implementation/storage concern, not a rejection condition by default.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Crossfade MUST accept a handoff request containing: the tenant's
  own reference ID for the interaction (required), a short human-readable
  summary (required), an optional deep link back to the tenant's own record, and
  optional structured context.
- **FR-002**: Structured context MUST be stored opaquely — not parsed, not
  validated against any schema Crossfade defines, and not used in any
  Crossfade-side branching logic.
- **FR-003**: A successful handoff request MUST create a session in a `waiting`
  state and return a session identifier to the tenant.
- **FR-004**: A repeat handoff request for a reference ID that already has a
  non-ended session MUST return the existing session's identifier instead of
  creating a new session.
- **FR-005**: Crossfade MUST NOT require or accept a decision from the tenant
  about which advisor handles the session — advisor routing (even trivial,
  single-advisor routing) is out of scope for this feature.
- **FR-006**: Tenant reference IDs MUST be scoped per-tenant, so two different
  tenants may use the same reference ID value without collision.
- **FR-007**: Crossfade MUST reject a handoff request that is missing the
  required tenant reference ID or summary.

### Key Entities _(include if feature involves data)_

- **Handoff Request**: The inbound payload from a tenant — tenant reference ID,
  summary, optional deep link, optional structured context. Not stored as its
  own long-lived record beyond what it seeds on the Session.
- **Session**: The record created by a handoff request. Holds the tenant
  reference ID, summary, deep link, structured context (stored opaquely), and a
  status that starts as `waiting`. Owned by a single tenant. Further status
  transitions and advisor assignment are defined by downstream features (003,
  004).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of valid handoff requests result in a session identifier
  being returned to the tenant in the same request/response cycle.
- **SC-002**: 100% of structured context submitted by a tenant is retrievable by
  the advisor exactly as sent, with no loss or alteration.
- **SC-003**: Repeat handoff requests for the same interaction reference never
  result in more than one open (non-ended) session at a time — 0%
  duplicate-session rate under repeated or concurrent submission.
- **SC-004**: Tenants can rely on handoff requests being rejected only for
  missing required fields, never for the shape or content of optional structured
  context.

## Assumptions

- `waiting` is the only session state this feature creates; all other state
  transitions (e.g. assigned, active, ended) are owned by downstream features
  (003, 004).
- Advisor assignment/routing, including trivial single-advisor routing, is
  entirely out of scope here and belongs to feature 003.
- Deciding _when_ a user should be escalated to a human is entirely the tenant's
  own logic; Crossfade has no opinion on escalation triggers.
- No timeout or expiry is enforced on a `waiting` session that no advisor ever
  picks up — this is an open question deferred until real usage volume makes it
  relevant, not a requirement of this feature.
- The session identifier format is an implementation detail opaque to the
  tenant; tenants are only expected to store and pass it back verbatim.
- This feature requires the tenant to already exist and be authenticated, per
  feature 001.

## Domain Concept Identification

#### Existing Concepts (from codebase)

- None yet **in code**. `apps/api` remains the stock, unmodified NestJS 11
  skeleton (`AppModule`/`AppController`/`AppService` only) — no `tenants`
  module, no Prisma schema, no `TenantAuthGuard`, no database connection exist
  in `apps/api/src` or `apps/api/prisma` despite feature 001's REASONS-Canvas
  prompt
  (`docs/spdd/prompt/202608181415-[Feat]-001-api-tenant-onboarding-isolation.md`)
  already specifying them in full. This feature's plan/research/contracts all
  assume 001's `Tenant` model, `PrismaService`, and `TenantAuthGuard` are
  available to import — they are not yet present in the working tree.
- **Tenant** (conceptually, from feature 001's design): the owning party every
  `Session` will belong to, resolved via bearer-credential auth. Not present as
  code yet, but this feature's `Session.tenantId` foreign key and reused
  `TenantAuthGuard` both depend on it existing.

#### New Concepts Required

- **Session**: the core new persisted entity this feature introduces — created
  by a handoff request, starts in `waiting` status, owned by exactly one tenant.
  Root record that features 003 (chat) and 004 (session/outcome) extend with
  further status transitions, advisor assignment, and transcript data.
- **Handoff Request**: a transient inbound shape, not a persisted entity in its
  own right — it exists only as the payload that seeds a `Session` row.
  Distinguishing this from `Session` matters conceptually: there's no "Handoff
  Request" table, only its effect on `Session`.
- **Structured Context**: an opaque, tenant-owned data blob attached to a
  `Session` — conceptually "pass-through data," not a Crossfade-modeled entity.
  Its defining property is that Crossfade must treat it as inert cargo, never as
  input to its own logic.
- **Session Reference Scope**: a conceptual uniqueness boundary — the tenant's
  own reference ID for an interaction is meaningful only within that tenant
  (`(tenantId, referenceId)` pair), not globally. This directly extends feature
  001's isolation boundary into this feature's own entity.
- **Non-ended Session**: a conceptual status class (not a literal enum value) —
  "any `Session.status` other than `ended`" is the boundary this feature's
  duplicate-detection logic operates against, even though this feature only ever
  writes `waiting` and does not otherwise manage the `status` state machine
  (owned by 003/004).

#### Key Business Rules

- A handoff request is only valid if it includes a tenant reference ID and a
  summary; both are mandatory, everything else is optional — governs
  `Handoff Request` acceptance (FR-001, FR-007).
- Structured context, if present, must be treated as inert: never parsed for
  meaning, never validated against a Crossfade-defined shape, never used to
  drive Crossfade's own logic — governs `Structured Context` handling end-to-end
  (FR-002), and is a trust guarantee, not just a storage detail.
- A tenant may have at most one non-ended `Session` per reference ID at any
  moment; a repeat request for the same reference ID while one is still open
  resolves to the existing session rather than creating a new one — governs
  `Session` creation (FR-004) and directly extends 001's per-tenant isolation
  into a per-tenant _uniqueness_ rule.
- Reference IDs are meaningful only within their owning tenant's scope — two
  tenants may reuse the identical reference ID value with zero collision or
  cross-visibility — governs `Session Reference Scope` (FR-006), a direct
  consequence of 001's isolation invariant applied to this feature's own
  uniqueness key.
- This feature never accepts or acts on any signal about which advisor should
  handle a session — no such concept exists in its scope at all, not even as an
  ignored-but-accepted field with special meaning — governs the boundary between
  `Session` (this feature) and advisor assignment (feature 003) (FR-005).

## Strategic Approach

#### Solution Direction

- Add a second domain module, `handoffs`, alongside the (not-yet-built)
  `tenants` module from feature 001, following the same Controller → Service →
  Prisma layering 001 established. One new tenant-facing endpoint
  (`POST /handoffs`) accepts the handoff payload, guarded by 001's
  `TenantAuthGuard` (reused unmodified, not reimplemented), and either creates a
  new `Session` row in `waiting` state or resolves to an already-open one for
  the same `(tenantId, referenceId)` pair.
- Data flow: tenant-facing endpoint → DTO validation of only the two required
  scalar fields (+ format-level checks on the optional `deepLink`/`context`,
  never their content) → service-layer insert attempt against `Session` → on a
  uniqueness conflict, re-read and return the existing row instead of the new
  one → response distinguishes "created" (`201`) from "already existed" (`200`)
  using an otherwise-identical body.
- This feature is a direct extension of 001's precedents rather than a new
  architectural decision point: same stack (NestJS/Prisma/Postgres), same auth
  guard, same isolation invariant (`tenantId` only ever from the resolved
  credential, never from the request body) — its only genuinely new strategic
  question is how to make the create-or-return-existing behavior race-safe.

#### Key Design Decisions

- **How to guarantee at most one non-ended session per (tenant, reference ID)
  under concurrent requests**: application-level check-then-insert vs.
  database-level constraint. → Recommend a database-level partial unique
  constraint (unique on `(tenantId, referenceId)` scoped to non-ended rows),
  with the service attempting an insert and treating a uniqueness violation as
  "someone else already created it — fetch and return that one." A
  check-then-insert has an unavoidable race window between the read and the
  write; a DB constraint is atomic regardless of how many API instances are
  running concurrently, which matters since this is exactly the "duplicate under
  concurrency" edge case the spec calls out. Trade-off: the service must handle
  a constraint-violation error as an expected, non-exceptional-looking
  control-flow path rather than a hard failure — this needs to be designed
  deliberately, not bolted on.
- **How to store opaque structured context**: a native JSON/`jsonb` column vs.
  an opaque pre-serialized string. → Recommend a native JSON column, since the
  "opacity" the spec requires is about _meaning_ (Crossfade must not interpret
  the contents), not about _storage format_ — validating that the payload is
  syntactically valid JSON (so it can be stored and returned faithfully) is not
  the same as validating its shape or content, and does not violate the
  pass-through guarantee (FR-002, SC-002).
- **How the response signals "this session already existed" vs. "newly
  created"**: a dedicated response field vs. relying purely on HTTP status code.
  → Recommend the HTTP status code alone (`201` vs `200`) carrying that signal,
  with an otherwise identical response body — simplest option that still lets an
  integrator who cares check the status code, while one who doesn't care can
  treat both identically. This is a minor tactical call but affects the DTO
  shape, so it's flagged here rather than left implicit.
- **Sequencing relative to feature 001**: since 001's `tenants` module,
  `PrismaService`, and `TenantAuthGuard` do not yet exist in the working tree
  (only 001's own REASONS-Canvas prompt does), this feature's Operations cannot
  be executed in isolation — it structurally depends on 001's implementation
  landing first (or landing together in the same generation pass). This is not a
  design trade-off so much as a hard prerequisite that must be surfaced before
  code generation begins.

#### Alternatives Considered

- **Read-then-conditionally-insert in application code** (check for an existing
  non-ended session, insert only if absent): rejected — the check and the insert
  are two separate round-trips with a race window between them; under
  near-simultaneous requests (the spec's explicit edge case), this can produce
  two `waiting` sessions for the same reference ID, violating SC-003's
  0%-duplicate requirement.
- **Storing structured context as an opaque pre-serialized string** (tenant
  sends already-JSON-encoded text, Crossfade never parses it at all, not even
  for syntax): rejected — pushes serialization/escaping burden onto every tenant
  integration for no real gain, since `jsonb` already guarantees Crossfade
  doesn't interpret the _meaning_ of the content while still storing it as
  genuine structured data (queryable later if ever needed, without violating
  FR-002).
- **Rejecting handoff requests above a size/nesting threshold for structured
  context**: rejected — spec's edge case explicitly treats large/deeply-nested
  context as "an implementation/storage concern, not a rejection condition by
  default," so introducing a size-based `400` would contradict the spec's own
  stated intent, even though it might seem like reasonable defensive
  engineering.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Malformed `deepLink` rejection vs. the "never reject on optional-field
  shape" guarantee**: the contract (`contracts/handoff-intake-api.md`) specifies
  `400` for a `deepLink` that isn't a valid URL, but SC-004 promises tenants
  that requests are "rejected only for missing required fields, never for the
  shape or content of optional structured context." `deepLink` is optional but
  not "structured context" — the spec's own wording only extends the
  no-shape-rejection guarantee to `context`, not to `deepLink`, so this is
  likely not a real conflict, but it is close enough to the guarantee's spirit
  that it should be explicitly confirmed, not assumed, before implementation.
- **What counts as "valid JSON" for `context` when the tenant sends a non-object
  JSON value** (e.g. a bare string, number, or array instead of a JSON object):
  the contract's example always shows an object, and FR-002/data-model describe
  "structured context" generally, but neither explicitly states whether a
  non-object top-level JSON value must be accepted or rejected. Needs a concrete
  decision — most consistent with FR-002's "don't validate shape" spirit is to
  accept any syntactically valid JSON value, not just objects, but this should
  be an explicit decision, not an inferred one.
- **Idempotency window for the "repeat handoff" behavior**: the spec defines
  "repeat while non-ended" clearly, but doesn't state whether the _entire_
  payload (summary, deepLink, context) of a repeat request is expected to update
  the existing session, or whether the repeat's payload is silently discarded in
  favor of the original. The contract's `200` response only returns the original
  session's fields, implying "discarded," but this is inferred, not explicit —
  worth confirming since it affects whether the service does an update-or-return
  vs. a pure return.

#### Edge Cases

- **Concurrent identical-referenceId requests from the same tenant** (spec's own
  explicit edge case): must resolve to exactly one `Session`, handled by the
  DB-level partial unique constraint design decision above — this is the central
  technical risk of the feature, not a peripheral one.
- **Cross-tenant reference ID reuse**: two tenants using the identical
  `referenceId` string must never collide or cross-reference — directly
  exercises 001's isolation invariant in a second entity's uniqueness key, which
  is a good early test of whether that invariant generalizes correctly beyond
  the `Tenant` table itself.
- **Repeat handoff after the prior session for the same reference ID has
  ended**: must create a _new_ session rather than resolving to the ended one —
  this depends on `status` semantics that this feature doesn't otherwise own
  (ended is set by feature 004), so this feature must correctly special-case
  "ended doesn't count as existing" even though it has no other reason to
  inspect `status` values beyond `waiting`.
- **Very large or deeply nested `context` payloads**: spec explicitly defers any
  bound to "an implementation/storage concern," meaning no application-level
  rejection should be introduced casually — if a database or request-size limit
  is hit, that failure mode has not been specified by this feature and needs at
  least a documented (if not solved) boundary.

#### Technical Risks

- **Hard sequencing dependency on feature 001's actual implementation, not just
  its spec**: this feature's Operations (guard reuse, `Tenant` foreign key,
  shared `PrismaService`) cannot be executed against the current working tree,
  since 001 exists only as a REASONS-Canvas prompt, not as code. This is the
  single largest risk to this feature's buildability and should be resolved
  (either "001 is generated first" or "001 and 002 are generated together in the
  same pass") before `/spdd-reasons-canvas` commits to a concrete Operations
  sequence.
- **Constraint-violation-as-control-flow requires careful implementation**:
  treating a DB uniqueness violation as an expected "return the existing
  session" path (rather than a genuine error) is a slightly unusual pattern — if
  implemented sloppily (e.g., broad catch-and-swallow), it risks masking
  _other_, real constraint violations as false "session already exists"
  responses. This needs explicit, narrow exception-type matching in the eventual
  implementation.
- **Opaque JSON storage still needs _some_ boundary to be operable**: "no schema
  validation" is a hard requirement, but the feature still needs to decide what
  happens on genuinely malformed JSON syntax (not shape) — this is a low-risk
  technical gap but should be explicit rather than assumed identical to
  shape-validation (it isn't; syntax validity is a parsing concern, not an
  interpretation concern).
- **No expiry/timeout on `waiting` sessions (explicitly deferred by the spec's
  own Assumptions)**: not a defect of this feature, but worth carrying forward
  as a known, intentionally-unaddressed gap so it isn't rediscovered as a "bug"
  later — a `waiting` session with no advisor ever picking it up simply sits
  forever under this feature's scope alone.

#### Acceptance Criteria Coverage

| AC#                                                | Description                                                                              | Addressable? | Gaps/Notes                                                                                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1-1                                              | New handoff with referenceId + summary → session created in `waiting`, id returned       | Yes          | Blocked on feature 001's actual implementation existing (see Technical Risks)                                                                                                                                                            |
| US1-2                                              | Handoff with optional deepLink + context → session created with those fields stored      | Yes          | Depends on resolving the deepLink/context validation ambiguity above                                                                                                                                                                     |
| US1-3                                              | Handoff omitting optional fields → session still created                                 | Yes          | Straightforward once DTO marks deepLink/context optional                                                                                                                                                                                 |
| US2-1                                              | Arbitrary structured context → stored and retrievable byte-for-byte identical            | Yes          | Depends on non-object-JSON-value decision above; otherwise directly satisfied by `jsonb` storage                                                                                                                                         |
| US2-2                                              | Context not matching any schema → not rejected, doesn't alter Crossfade behavior         | Yes          | Directly satisfied by "no schema validation" design; must be enforced as a hard rule, not a best-effort one                                                                                                                              |
| US3-1                                              | Repeat request for non-ended reference ID → returns existing session, no new one created | Yes          | Central risk — depends on the DB-level uniqueness + conflict-handling design being implemented correctly (see Technical Risks)                                                                                                           |
| US3-2                                              | Repeat request after prior session ended → creates a new session                         | Yes          | Requires the partial index to correctly exclude `ended` rows; needs a positive test, not just the non-ended case                                                                                                                         |
| Edge: missing required fields                      | Rejected with 400                                                                        | Yes          | Straightforward DTO-level validation                                                                                                                                                                                                     |
| Edge: concurrent same-referenceId requests         | Exactly one session results                                                              | Yes          | Same DB-constraint risk as US3-1 — this is the feature's highest-stakes correctness requirement                                                                                                                                          |
| Edge: reference ID belonging to a different tenant | No cross-tenant duplication or leakage                                                   | Yes          | Directly inherits 001's isolation invariant, applied to the `(tenantId, referenceId)` composite key                                                                                                                                      |
| Edge: very large/deeply nested context             | Not a rejection condition by default                                                     | Partial      | Spec defers the actual bound; this feature can commit to "no application-level rejection" but cannot fully guarantee behavior at arbitrary size without a stated infrastructure-level limit, which is out of this feature's stated scope |
