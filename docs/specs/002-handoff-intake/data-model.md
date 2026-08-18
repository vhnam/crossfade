# Phase 1 Data Model: Handoff Intake

## Entities

### Session

Created by a handoff request. Root record that 003 (chat) and 004 will extend
with further status transitions and advisor assignment.

| Field         | Type                     | Notes                                                                                                                                                                                                                                    |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID (PK)                | Internal identifier, returned to tenant as the session identifier (FR-003)                                                                                                                                                               |
| `tenantId`    | UUID (FK → Tenant.id)    | Owning tenant, resolved from auth context — never from request body (isolation invariant, inherited from 001)                                                                                                                            |
| `referenceId` | string                   | Tenant's own reference ID for the interaction (FR-001). Unique per tenant among non-ended sessions (FR-004)                                                                                                                              |
| `summary`     | string                   | Short human-readable summary (FR-001), required                                                                                                                                                                                          |
| `deepLink`    | string (URL), nullable   | Optional link back to tenant's own record (FR-001)                                                                                                                                                                                       |
| `context`     | JSON (`jsonb`), nullable | Optional structured context, stored opaquely (FR-002) — never parsed or validated beyond "is valid JSON"                                                                                                                                 |
| `status`      | enum: `waiting`, ...     | This feature only ever writes `waiting` on creation (FR-003). Further values (`assigned`, `active`, `ended`, etc.) are introduced by 003/004; this feature only needs to know `ended` as a terminal value for FR-004's "non-ended" check |
| `createdAt`   | timestamp                |                                                                                                                                                                                                                                          |
| `updatedAt`   | timestamp                |                                                                                                                                                                                                                                          |

**Validation rules**:

- `referenceId`: required, non-empty (FR-007).
- `summary`: required, non-empty (FR-007).
- `deepLink`: optional; if present, must be a well-formed URL
  (implementation-level input hygiene, not content interpretation — no FR
  requires format validation, but a malformed URL is not usably "a link").
- `context`: optional; if present, must be syntactically valid JSON. No further
  validation, schema check, or interpretation (FR-002).

**Uniqueness constraint**:

- `(tenantId, referenceId)` unique **among rows where `status != 'ended'`**
  (partial unique index — see `research.md`). Enforces FR-004: a tenant may have
  many _ended_ sessions for the same reference ID over time (edge case in spec),
  but at most one open one.

**State transitions** (only the portion owned by this feature):

```
(created) -> waiting
```

- Every session created by this feature starts in `waiting`.
- Transitions out of `waiting` (e.g., to `assigned`, `active`, `ended`) are
  entirely owned by downstream features (003, 004) and out of scope here.

## Isolation Invariant (inherited from 001)

`tenantId` on every `Session` row is resolved from the authenticated request's
credential, never accepted from the request body — consistent with 001's
isolation guarantee. A handoff request can never create or return a session
belonging to another tenant.

## Out of Scope for This Feature's Data Model

- Advisor assignment, chat transcript, or outcome-event fields — added by
  003/004 as new columns/tables referencing `Session.id`.
- Any `status` values beyond `waiting` and the `ended` terminal check needed for
  the uniqueness constraint.
