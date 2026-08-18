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
