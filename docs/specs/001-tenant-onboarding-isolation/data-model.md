# Phase 1 Data Model: Tenant Onboarding & Isolation

## Entities

### Tenant

Represents a registered source application (e.g., Windwise). Root of all tenant
isolation — every other Crossfade entity (advisors, sessions, later features)
will carry a `tenantId` foreign key back to this table.

| Field           | Type                        | Notes                                                             |
| --------------- | --------------------------- | ----------------------------------------------------------------- |
| `id`            | UUID (PK)                   | Internal identifier, never guessable/sequential                   |
| `slug`          | string, unique              | Human-chosen unique identifier (FR-003), immutable after creation |
| `name`          | string                      | Display name                                                      |
| `apiKeyHash`    | string                      | Hash of the current active API credential (never store raw key)   |
| `webhookUrl`    | string (URL)                | Registered callback destination (FR-007); required, HTTPS         |
| `webhookSecret` | string                      | Shared secret used to sign/verify outbound webhook payloads       |
| `status`        | enum: `active`, `suspended` | Binary status per spec Assumptions (FR-009/FR-011)                |
| `createdAt`     | timestamp                   |                                                                   |
| `updatedAt`     | timestamp                   | Bumped on credential rotation, status change, webhook update      |

**Validation rules**:

- `slug`: required, unique, URL-safe (lowercase alphanumeric + hyphen),
  immutable once set (FR-003).
- `webhookUrl`: required at creation, must be a well-formed HTTPS URL (FR-002,
  FR-007). Registration rejected if missing or malformed.
- `webhookSecret`: required at creation, generated if not supplied, never
  returned in plaintext after initial issuance.
- `apiKeyHash`: set on creation and on every rotation (FR-012); raw key returned
  to operator exactly once at issuance/rotation time, never persisted or
  retrievable afterward.

**State transitions**:

```
(created) -> active -> suspended -> active -> suspended -> ...
```

- `active → suspended`: operator suspends (FR-009). All subsequent requests
  using this tenant's key are rejected (FR-009), historical data untouched
  (FR-010).
- `suspended → active`: operator reactivates (FR-011). Existing (non-rotated)
  key resumes working.
- No deletion path in v1 — suspension is the only offboarding mechanism
  (historical data must be preserved per FR-010).

## Isolation Invariant

Every query that reads or writes any tenant-scoped data (this feature's `Tenant`
row itself, and every table added by later features) MUST be scoped by the
`tenantId` resolved from the authenticated request's credential — never accepted
from a request parameter or body (FR-006, FR-008). No query path may join or
filter across two different `tenantId` values in a single tenant-facing request.

## Out of Scope for This Feature's Data Model

- Advisor, Session, Handoff Request, Outcome Event entities — defined in their
  own dependent features; this feature only guarantees the `Tenant` row and
  isolation invariant they will build on.
