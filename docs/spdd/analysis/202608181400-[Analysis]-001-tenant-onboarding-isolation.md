# SPDD Analysis: Tenant Onboarding & Isolation

## Original Business Requirement

# Feature Specification: Tenant Onboarding & Isolation

**Feature Branch**: `001-tenant-onboarding-isolation`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Tenant Onboarding & Isolation — part of Crossfade.
Before any handoff can happen, a source application ('tenant') must be
registered in Crossfade with its own isolated identity, credentials, and
configuration. Covers registration and isolation guarantee only, not the handoff
flow itself. v1: exactly one tenant (Windwise), set up manually, not self-serve.
Foundational — depended on by handoff request, advisor management, and
session/outcome features."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Operator registers a tenant (Priority: P1)

As the Crossfade operator, I register a new tenant with a name, an API
credential, and a webhook destination, so that tenant can start sending handoff
requests. This is manual/operator-driven in v1, not self-serve.

**Why this priority**: Nothing else in Crossfade can function without at least
one registered tenant. This is the foundation every other feature (handoff
requests, advisor management, sessions) depends on.

**Independent Test**: As an operator, create a tenant record with a name,
credential, and webhook URL+secret; confirm the tenant record exists and the
issued credential is usable, without needing any other feature built.

**Acceptance Scenarios**:

1. **Given** no tenant exists yet, **When** the operator registers a new tenant
   with a name, credential, and webhook URL+secret, **Then** a tenant record is
   created with a unique identifier and the credential is ready to use.
2. **Given** a tenant is being registered, **When** the operator omits the
   webhook URL or secret, **Then** registration is rejected — a tenant cannot
   exist without a configured callback destination.
3. **Given** an existing tenant slug/identifier, **When** the operator tries to
   register another tenant with the same identifier, **Then** registration is
   rejected as a duplicate.

---

### User Story 2 - Tenant authenticates its own requests (Priority: P1)

As a tenant (Windwise), I authenticate every request to Crossfade using my own
credential, so Crossfade knows which tenant is calling without me passing
identifying context manually.

**Why this priority**: Every other Crossfade capability (handoff requests,
session queries) is only usable once a tenant can reliably identify itself. This
is as foundational as registration itself.

**Independent Test**: Using a registered tenant's credential, make a request to
any Crossfade endpoint and confirm it resolves to that exact tenant; make the
same request with an invalid or missing credential and confirm it is rejected.

**Acceptance Scenarios**:

1. **Given** a registered tenant with a valid credential, **When** that tenant
   makes a request using its credential, **Then** the request is resolved to
   exactly that tenant's identity.
2. **Given** an invalid, expired, or missing credential, **When** a request is
   made, **Then** the request is rejected and no tenant identity is resolved.
3. **Given** a valid credential, **When** a request is made, **Then** the tenant
   does not need to separately supply its own identity in the request body — the
   credential alone identifies it.

---

### User Story 3 - Isolation is enforced between tenants (Priority: P2)

As a tenant, I can never see, list, or affect another tenant's advisors,
sessions, or data — even if I somehow knew their identifiers.

**Why this priority**: Critical guarantee for trust and correctness (BR-2), but
it is only meaningfully testable once more than one tenant exists, and v1 ships
with a single tenant — so it is verified but not the blocking path to a working
single-tenant MVP.

**Independent Test**: Register two tenants; using tenant A's credential, attempt
to list, read, or reference any of tenant B's records (by guessing or reusing a
known identifier) and confirm every attempt is rejected or returns nothing.

**Acceptance Scenarios**:

1. **Given** two registered tenants A and B, **When** tenant A queries its own
   data using its credential, **Then** only tenant A's records are returned,
   never tenant B's.
2. **Given** tenant A somehow obtains one of tenant B's record identifiers,
   **When** tenant A requests that record directly, **Then** the request is
   rejected or returns not-found — never tenant B's data.
3. **Given** two tenants, **When** either one operates within the system,
   **Then** no API surface allows one to enumerate, count, or infer the
   existence of the other's advisors, sessions, or data.

---

### User Story 4 - Operator suspends a tenant (Priority: P3)

As the Crossfade operator, I can suspend a tenant so its requests are rejected
going forward, without deleting its historical data.

**Why this priority**: Operationally important (handles offboarding, abuse, or a
paused relationship) but not required for the initial single-tenant launch to
function — v1 launches with one active tenant and no suspension need yet.

**Independent Test**: Suspend a registered tenant, confirm its subsequent
requests are rejected, and confirm its previously stored records remain intact
and retrievable by the operator.

**Acceptance Scenarios**:

1. **Given** an active tenant, **When** the operator suspends it, **Then** all
   subsequent requests authenticated with that tenant's credential are rejected.
2. **Given** a suspended tenant, **When** the operator inspects its historical
   records, **Then** all previously stored data remains intact and unchanged.
3. **Given** a suspended tenant, **When** the operator reactivates it, **Then**
   its requests are accepted again using the same credential.

---

### Edge Cases

- What happens when an operator tries to register a tenant with a malformed or
  unreachable webhook URL? Registration should be rejected or flagged, since a
  tenant without a working callback destination can't receive outcome events
  (dependency for downstream features).
- What happens when a tenant's credential is compromised? The operator must be
  able to rotate/reissue a tenant's credential without deleting or recreating
  the tenant record itself.
- What happens when a suspended tenant's webhook is still configured but the
  tenant tries to make a request? The request is rejected before any processing;
  no data is created or exposed on behalf of the suspended tenant.
- What happens if two registration requests for the same tenant identifier
  arrive concurrently? Only one must succeed; the other must be rejected as a
  duplicate, with no partial/duplicate tenant record left behind.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow an operator to create a tenant record with: a
  name, a unique identifier/slug, an API credential, and a registered webhook
  URL and secret.
- **FR-002**: System MUST reject tenant registration that is missing a webhook
  URL or secret — a tenant cannot exist without a configured callback
  destination.
- **FR-003**: System MUST reject tenant registration that reuses an existing
  tenant identifier/slug.
- **FR-004**: System MUST resolve every authenticated request to exactly one
  tenant; no request may span multiple tenants or be processed without a
  resolved tenant.
- **FR-005**: System MUST reject any request with an invalid, expired, or
  missing tenant credential, without resolving any tenant identity.
- **FR-006**: System MUST NOT require a tenant to pass its own identity in a
  request body or parameters — the credential alone determines tenant identity.
- **FR-007**: System MUST require a tenant's webhook destination to be
  configured at registration time, not supplied per-request.
- **FR-008**: System MUST prevent any tenant, under any API surface, from
  listing, reading, enumerating, or inferring the existence of another tenant's
  advisors, sessions, or data.
- **FR-009**: System MUST allow an operator to suspend a tenant such that all
  subsequent requests authenticated with that tenant's credential are rejected.
- **FR-010**: System MUST preserve a suspended tenant's historical data
  unchanged and retrievable by the operator.
- **FR-011**: System MUST allow an operator to reactivate a suspended tenant,
  after which its existing credential resumes working.
- **FR-012**: System MUST allow an operator to rotate/reissue a tenant's
  credential without deleting or recreating the tenant record.
- **FR-013**: System MUST NOT provide self-serve tenant signup, billing/plan
  tiers, or multi-advisor assignment logic in v1 (explicitly out of scope for
  this feature).

### Key Entities _(include if feature involves data)_

- **Tenant**: A registered source application. Attributes: name, unique
  identifier/slug, API credential, registered webhook URL, webhook secret,
  status (active/suspended). Fully isolated from every other tenant's data.
- **Tenant Credential**: The secret used by a tenant to authenticate its
  requests. One active credential per tenant at a time in v1; rotatable by the
  operator without affecting the tenant record itself.
- **Webhook Configuration**: The registered destination (URL + secret) a tenant
  receives callback events at; fixed at registration time, not overridable
  per-request.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An operator can register a new tenant, end to end, in under 5
  minutes.
- **SC-002**: 100% of requests with an invalid or missing credential are
  rejected before any tenant data is accessed or created.
- **SC-003**: Zero instances, across all testing and operation, of one tenant's
  data being visible, listable, or inferable by another tenant.
- **SC-004**: 100% of a suspended tenant's historical data remains intact and
  accessible to the operator after suspension.
- **SC-005**: A tenant's credential can be rotated with zero loss of the
  tenant's historical data or configuration.

## Assumptions

- v1 has exactly one tenant (Windwise), onboarded manually by the operator;
  self-serve signup is out of scope (per source doc).
- "Operator" refers to whoever administers Crossfade directly (e.g., via an
  internal tool or direct database/admin action) — no separate operator-facing
  product is assumed to exist yet; how the operator performs registration is
  left open for the planning phase.
- Each tenant holds exactly one active API credential at a time in v1; multiple
  concurrent credentials per tenant (e.g., for zero-downtime rotation) are not
  required until volume justifies it.
- Suspension is binary (active/suspended) in v1; more granular states (e.g.,
  rate-limited, trial-expired) are not needed until a second tenant exists.
- This feature does not cover the handoff request flow, advisor management, or
  session/outcome handling — those are separate, dependent features.

## Domain Concept Identification

#### Existing Concepts (from codebase)

- None. `apps/api` is a stock, unmodified NestJS 11 (Express platform) skeleton
  — only `AppModule`/`AppController`/`AppService` scaffolding exist. No ORM, no
  database connection, no auth guard, no domain module of any kind is present
  yet. This feature introduces the first domain concept in the service.

#### New Concepts Required

- **Tenant**: the root domain concept this feature introduces — a registered
  source application (e.g., Windwise) with its own identity, credential, and
  callback configuration. Every later Crossfade feature (handoff requests,
  advisor management, sessions/outcomes) will attach to a `Tenant` via a foreign
  key, so its shape and isolation behavior become the load-bearing pattern for
  the rest of the system.
- **Tenant Credential (API key)**: the authentication mechanism a `Tenant` uses
  to identify itself on every request. Conceptually distinct from the `Tenant`
  record itself (it can be rotated independently), but modeled as an attribute
  of `Tenant` rather than a separate entity in v1 (one active credential per
  tenant).
- **Webhook Configuration**: the callback destination (URL + secret) a `Tenant`
  is registered with, used by later features (outcome/session callbacks) to
  notify the tenant asynchronously. Fixed at registration, owned by the
  `Tenant`.
- **Operator**: not a data entity, but a distinct actor/access-level concept —
  the party permitted to create, suspend, reactivate, and rotate tenants. No
  operator-authentication mechanism exists in the codebase yet; this feature is
  also the first to need an "internal/privileged" access surface distinct from
  tenant-facing access.
- **Tenant Isolation Boundary**: a cross-cutting invariant rather than a stored
  entity — every tenant-scoped query, in this feature and every feature layered
  on top of it, must be implicitly scoped to the credential-resolved `tenantId`.
  This is the guarantee the rest of Crossfade is built to trust.

#### Key Business Rules

- A `Tenant` cannot exist without a webhook URL and secret configured at
  registration — governs `Tenant` creation (FR-002, FR-007).
- A `Tenant`'s identifying slug must be unique and is checked before creation
  succeeds — governs `Tenant` creation (FR-003).
- Tenant identity is derived exclusively from the authenticated credential,
  never from caller-supplied identifiers — governs every tenant-facing request
  across `Tenant`, and by extension every dependent feature's data (FR-004,
  FR-005, FR-006).
- A suspended `Tenant`'s credential stops authenticating new requests, but its
  historical data is immutable and untouched — governs `Tenant` status
  transitions and everything already attached to it (FR-009, FR-010).
- Credential rotation replaces the tenant's active credential in place; it never
  creates or deletes a `Tenant` record — governs `Tenant Credential` lifecycle
  (FR-012).
- No API surface may confirm the existence of another tenant's data, even
  indirectly (e.g., via a 403 vs. 404 distinction) — governs the Tenant
  Isolation Boundary across all present and future tenant-facing endpoints
  (FR-008).

## Strategic Approach

#### Solution Direction

- Introduce the first domain module (`tenants`) into the existing `apps/api`
  NestJS skeleton, along with the first persistence layer and first
  authentication mechanism the service will have — none currently exist. General
  flow: operator-facing endpoints perform tenant lifecycle writes
  (create/suspend/reactivate/rotate) directly against a relational store; a
  request-authentication layer resolves every tenant-facing request's credential
  to a `tenantId` before any handler logic runs, and that resolved `tenantId`
  becomes the mandatory scope for all data access — both in this feature and in
  every feature layered on top of it later.
- Because there is no existing architecture to conform to, this feature is
  establishing conventions rather than following them: the persistence choice,
  the credential/auth pattern, and the operator-vs-tenant access-surface split
  all become precedents that features 002+ (handoff requests, advisor
  management, sessions) will reuse rather than re-decide.

#### Key Design Decisions

- **Where to enforce isolation**: application-layer scoping (every query
  manually filtered by resolved `tenantId`) vs. database-layer scoping (e.g.,
  row-level security). → Recommend application-layer scoping via a single shared
  mechanism (e.g., a guard that attaches `tenantId` to request context, consumed
  uniformly by every downstream query) — simplest to implement and audit for a
  single-service NestJS app, and avoids introducing DB-level policy complexity
  before a second tenant exists to justify it. Trade-off: correctness depends on
  every future query author remembering to scope by `tenantId` — this is a
  discipline risk, not a technical one, and should be flagged as a standing
  constraint for every dependent feature.
- **How much isolation to prove now vs. defer**: v1 ships with exactly one
  tenant, so cross-tenant isolation (User Story 3) is not naturally exercised by
  production traffic. → Recommend the isolation guarantee still be built and
  tested as if multiple tenants exist today (per spec's explicit ask), since
  retrofitting isolation discipline after dependent features (002+) are already
  built against an unscoped pattern is materially more expensive than building
  it correctly once, here, first.
- **Operator access surface shape**: no operator authentication mechanism exists
  yet, and the spec explicitly leaves "how the operator performs registration"
  open. → Recommend keeping the operator surface as a distinct,
  separately-secured set of endpoints (not reusing tenant credential auth),
  since operator actions (create/suspend/rotate) are privileged relative to any
  tenant and must not be reachable via a tenant's own credential. The specific
  operator-authentication mechanism itself is a tactical decision for REASONS
  Canvas, not resolved here.
- **Response behavior for cross-tenant reference attempts**: returning
  `403 Forbidden` (confirms the record exists but is not accessible) vs.
  `404 Not Found` (indistinguishable from non-existence). → Recommend `404`
  uniformly for any cross-tenant reference attempt, since FR-008 explicitly
  requires that existence of another tenant's data must not be inferable — a
  `403` would leak that signal.

#### Alternatives Considered

- **JWT-based tenant authentication**: rejected for v1 — adds signing-key
  management and expiry/refresh complexity that doesn't serve a single,
  long-lived, manually-onboarded tenant relationship; opaque bearer credential
  is the simplest mechanism that still satisfies "one credential resolves to
  exactly one tenant."
- **Database-enforced row-level isolation (e.g., Postgres RLS)** as the primary
  isolation mechanism: rejected for v1 — real safety net, but adds operational
  complexity (session-variable wiring, policy maintenance) disproportionate to a
  single-tenant launch; worth revisiting once a second tenant exists and the
  isolation guarantee needs defense-in-depth beyond application-layer scoping.
- **Synchronous webhook reachability check blocking registration**: rejected —
  couples tenant onboarding to the tenant's own deployment timing; malformed
  URLs are rejected outright, but unreachable-but-well-formed URLs should not
  block an otherwise-valid registration.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Operator authentication mechanism is undefined**: the spec explicitly defers
  "how the operator performs registration" to planning, and no operator-auth
  pattern exists in the codebase. This must be resolved concretely before
  REASONS Canvas can design the operator controller's guard.
- **Credential format/strength is unspecified**: the requirement says "an API
  credential" without specifying entropy, prefix convention, or expiry policy —
  needs a concrete decision (a `cf_live_<token>`-style convention is implied by
  contract examples but not mandated by the spec itself).
- **"Malformed or unreachable webhook URL" edge case is only partially
  resolved**: the source requirement says registration "should be rejected or
  flagged" for both cases, but treats them differently only in supporting docs
  (research.md), not in the spec's own FRs — the spec itself doesn't distinguish
  malformed (hard reject) from unreachable (accept-but-flag). This distinction
  needs to be explicit and testable, not just implied.

#### Edge Cases

- **Concurrent duplicate registration** (same slug, simultaneous requests): spec
  requires exactly one to succeed with no partial/duplicate record — this is a
  database-level uniqueness/transaction concern, not just an application-level
  check-then-create, since a naive check-then-insert has a race window.
- **Suspend/reactivate idempotency**: not explicitly stated in the spec's FRs
  (though implied as reasonable operator behavior) — suspending an
  already-suspended tenant, or reactivating an already-active one, needs defined
  behavior (no-op vs. error) to avoid ambiguous operator-facing responses.
- **Credential rotation mid-flight**: if a tenant has in-flight requests
  authenticated with the old credential at the moment of rotation, behavior is
  unspecified — likely acceptable to let in-flight requests complete, but not
  stated.
- **Webhook secret rotation**: the spec covers API credential rotation (FR-012)
  explicitly, but says nothing about whether `webhookSecret` can be rotated
  independently — currently implied to be fixed at registration only, which may
  or may not be intentional.

#### Technical Risks

- **No persistence or auth infrastructure exists yet** in `apps/api` — this
  feature bears the full cost of first-time setup (ORM/migration tooling,
  database connectivity, guard/interceptor pattern), which is more setup risk
  than a typical feature layered onto existing infrastructure. Any missteps here
  (e.g., a weak isolation-scoping pattern) become the template every dependent
  feature inherits.
- **Isolation is a discipline-dependent guarantee, not a structural one**, under
  the recommended application-layer-scoping approach — a single query written
  without the `tenantId` filter in this feature or any dependent feature
  silently breaks FR-008/SC-003. This risk should be explicitly carried forward
  into REASONS Canvas as a safeguard requirement (e.g., a lint rule, a required
  base-repository pattern, or a code-review checklist item), not left to
  convention alone.
- **Credential storage discipline**: the requirement to "never store or log in
  plaintext after issuance" (from plan.md's constraints) is a security-critical
  constraint with no existing precedent in the codebase to follow — must be
  explicitly designed and enforced, including in logging/error-reporting paths
  that could inadvertently capture the raw key.
- **Single-tenant-only testing of a multi-tenant guarantee**: since v1 only has
  one production tenant, isolation (User Story 3) can only be validated through
  deliberately-constructed test scenarios (a second tenant created purely for
  test purposes) — there is a real risk this coverage gets treated as
  lower-priority than it should be, since it's not exercised by "real" usage.

#### Acceptance Criteria Coverage

| AC#   | Description                                                                        | Addressable? | Gaps/Notes                                                                                                                                                                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1-1 | Register tenant with name, credential, webhook → unique tenant + usable credential | Yes          | Requires new persistence layer (none exists yet)                                                                                                                                                                                                                                                                        |
| US1-2 | Missing webhook URL/secret → registration rejected                                 | Yes          | Validation rule, straightforward once persistence exists                                                                                                                                                                                                                                                                |
| US1-3 | Duplicate slug → registration rejected                                             | Yes          | Needs DB-level uniqueness constraint, not just app-level check, to close the concurrent-registration edge case                                                                                                                                                                                                          |
| US2-1 | Valid credential → resolves to exactly that tenant                                 | Yes          | Requires new auth guard (none exists yet)                                                                                                                                                                                                                                                                               |
| US2-2 | Invalid/expired/missing credential → rejected, no tenant resolved                  | Partial      | "Expired" credential is mentioned in the story but there is no credential-expiry concept anywhere in the spec's FRs, data model, or assumptions (credentials are described as valid until rotated) — needs clarification on whether expiry is in scope for v1 or the wording is aspirational                            |
| US2-3 | Tenant doesn't need to self-supply identity in body                                | Yes          | Direct consequence of credential-only resolution design                                                                                                                                                                                                                                                                 |
| US3-1 | Tenant A's queries return only A's records                                         | Yes          | Depends on isolation-scoping pattern being applied uniformly — see Technical Risks                                                                                                                                                                                                                                      |
| US3-2 | Tenant A referencing B's known ID → rejected/not-found                             | Yes          | Requires consistent 404-not-403 convention across all tenant-facing endpoints                                                                                                                                                                                                                                           |
| US3-3 | No API surface allows enumerating/inferring another tenant's existence             | Partial      | This feature's own endpoints (e.g., `GET /tenants/me`) can satisfy this, but the guarantee must also bind every _future_ feature's endpoints — this feature can only establish the pattern/contract, not enforce it on code that doesn't exist yet; worth flagging as an ongoing constraint, not a one-time deliverable |
| US4-1 | Suspend → subsequent requests rejected                                             | Yes          | Requires status check in the auth-resolution path                                                                                                                                                                                                                                                                       |
| US4-2 | Suspended tenant's historical data intact                                          | Yes          | Natural consequence of suspension being a status flag, not a delete                                                                                                                                                                                                                                                     |
| US4-3 | Reactivate → same credential works again                                           | Yes          | Straightforward status flip                                                                                                                                                                                                                                                                                             |
