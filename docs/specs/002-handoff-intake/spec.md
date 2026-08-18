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
