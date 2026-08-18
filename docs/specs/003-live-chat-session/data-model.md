# Phase 1 Data Model: Live 1:1 Chat Session

## Entities

### Session (extends 002's entity)

002 creates this row in `waiting` state with no advisor. This feature adds the
advisor-assignment field and the state values/transitions beyond `waiting`.

| Field                                           | Type                                            | Notes                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                            | UUID (PK)                                       | Unchanged from 002                                                                                                                        |
| `tenantId`                                      | UUID (FK → Tenant.id)                           | Unchanged from 002                                                                                                                        |
| `referenceId`, `summary`, `deepLink`, `context` | —                                               | Unchanged from 002                                                                                                                        |
| `advisorId`                                     | UUID (FK → Advisor.id), nullable                | **New.** Set exactly once, at pickup (FR-002). Null while `waiting`.                                                                      |
| `status`                                        | enum: `waiting`, `active`, `ended`, `abandoned` | **Extends 002's `waiting`-only value.** This feature owns the `waiting → active`, `active → ended`, and `active → abandoned` transitions. |
| `createdAt`, `updatedAt`                        | —                                               | Unchanged from 002                                                                                                                        |

**Validation rules** (new, this feature):

- `advisorId`: MUST belong to a tenant matching `Session.tenantId` (an advisor
  can never be assigned to another tenant's session — FR-001).
- Pickup (`waiting → active` + set `advisorId`) MUST be a single atomic
  conditional update guarding on `status = 'waiting'` (FR-003; see
  `research.md`'s concurrency decision) — never a separate read then write.
- End (`active → ended`) MUST be guarded on `status = 'active'` (FR-008, edge
  case: ending a non-active session is rejected).

**State transitions**:

```
waiting -> active     (advisor pickup, FR-002; sets advisorId)
active  -> ended      (advisor explicitly ends, FR-008)
active  -> abandoned  (inactivity sweep, FR-009)
```

- No transition leaves `ended` or `abandoned` (both terminal).
- No transition returns `active` to `waiting` (no reassignment in v1, FR-011).

### Message

New entity. Represents one real-time exchange within a session.

| Field             | Type                             | Notes                                                                                                                          |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | UUID (PK)                        |                                                                                                                                |
| `sessionId`       | UUID (FK → Session.id)           |                                                                                                                                |
| `senderType`      | enum: `user`, `advisor`          | Which side sent it                                                                                                             |
| `senderAdvisorId` | UUID (FK → Advisor.id), nullable | Set when `senderType = advisor`; null for `user` messages (the user has no Crossfade-level identity beyond the session itself) |
| `content`         | text                             | Message body                                                                                                                   |
| `createdAt`       | timestamp                        | Used to derive session activity (FR-010; see `research.md`)                                                                    |

**Validation rules**:

- A `Message` MUST only be creatable while its parent
  `Session.status = 'active'` (FR-005; enforced at the same layer as the
  WebSocket gateway/REST fallback, checked against current DB state at write
  time to close the race described in the spec's edge cases).
- `content` MUST be non-empty.

### Advisor

New entity. The authenticated actor who picks up and handles sessions.

| Field                    | Type                  | Notes                                                                                                     |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`                     | UUID (PK)             |                                                                                                           |
| `tenantId`               | UUID (FK → Tenant.id) | Scopes the advisor to exactly one tenant (FR-001)                                                         |
| `displayName`            | string                | The disclosed identity shown to users (FR-007) — e.g., "Alex, Windwise recommendations team"              |
| `credentialHash`         | string                | Hash of the advisor's auth credential (parallel to 001's `Tenant.apiKeyHash` pattern — see `research.md`) |
| `isOnline`               | boolean               | Simple online/offline toggle (spec Assumptions — not a scheduling system)                                 |
| `createdAt`, `updatedAt` | timestamp             |                                                                                                           |

**Validation rules**:

- `displayName`: required, non-empty — never rendered as a generic placeholder
  to users (FR-007).
- `tenantId`: immutable after creation (an advisor doesn't move tenants).

## Isolation Invariant (inherited from 001)

Every advisor-facing query (list waiting sessions, pick up, end, send message)
is scoped by the `tenantId` resolved from the advisor's own auth context — never
accepted from a request parameter. An advisor authenticated for tenant A can
never see, pick up, or message into a session belonging to tenant B (FR-001).

## Derived Value: Session Activity (for abandonment)

Not a stored field. Computed at sweep time (see `research.md`) as:

```
lastActivity = max(Session.createdAt, MAX(Message.createdAt) for that session)
```

A session is swept to `abandoned` when `now - lastActivity` exceeds the
30-minute default inactivity window (spec Assumptions, FR-009).

## Out of Scope for This Feature's Data Model

- Outcome/reporting fields on `Session` — added by 004 once a session reaches
  `ended` (or `abandoned`).
- Any multi-advisor routing/queue table — explicitly out of scope (FR-011).
