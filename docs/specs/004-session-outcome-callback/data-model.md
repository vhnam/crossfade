# Phase 1 Data Model: Session Outcome & Callback

## Entities

### Outcome

New entity, one-to-one with 003's `Session`, created the moment a session
reaches a terminal state (`ended` or `abandoned`).

| Field       | Type                                          | Notes                                                                                                                                                      |
| ----------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | UUID (PK)                                     |                                                                                                                                                            |
| `sessionId` | UUID (FK → Session.id), unique                | Enforces exactly-one-outcome-per-session (FR-007/SC-006; see `research.md`)                                                                                |
| `status`    | enum: `resolved`, `not_resolved`, `abandoned` | Fixed vocabulary (FR-006). `abandoned` is set automatically by the sweep (FR-008); `resolved`/`not_resolved` is chosen by the advisor at explicit end time |
| `note`      | string, nullable, max 500 chars               | Advisor's optional free-text note (FR-004). Always null when `status = abandoned` (no advisor present at that transition)                                  |
| `createdAt` | timestamp                                     | Moment the session concluded                                                                                                                               |

**Validation rules**:

- `status`: MUST be one of the three fixed values — never free-form (FR-006,
  SC-005).
- `status = abandoned` MUST only be set by the automated sweep path, never
  advisor-selected (FR-008).
- `status ∈ {resolved, not_resolved}` MUST only be set via the explicit advisor
  end-session action (FR-008).
- `note`: optional; if present, ≤500 characters (see `research.md`), rejected
  (not truncated) if longer.
- Insert MUST be idempotent under the unique `sessionId` constraint — a losing
  concurrent writer observes the conflict and does not error the caller
  (FR-007).

### WebhookDeliveryAttempt

New entity. One or more rows per `Outcome`, tracking delivery/retry state.

| Field                    | Type                                   | Notes                                           |
| ------------------------ | -------------------------------------- | ----------------------------------------------- |
| `id`                     | UUID (PK)                              |                                                 |
| `outcomeId`              | UUID (FK → Outcome.id)                 |                                                 |
| `attemptCount`           | integer                                | Number of attempts made so far                  |
| `status`                 | enum: `pending`, `succeeded`, `failed` | `failed` = retries exhausted without a `2xx`    |
| `nextAttemptAt`          | timestamp, nullable                    | Null once `succeeded` or `failed`               |
| `lastResponseStatus`     | integer, nullable                      | HTTP status of the most recent attempt, if any  |
| `lastError`              | string, nullable                       | Error message of the most recent failed attempt |
| `createdAt`, `updatedAt` | timestamp                              |                                                 |

**Validation rules**:

- Created immediately when the `Outcome` is recorded, `status: pending`,
  `nextAttemptAt: now` (FR-001, SC-001).
- Backoff schedule and attempt cap are implementation constants (see
  `research.md`), not user-configurable in v1.
- Delivery failure (even exhausted retries) MUST NOT affect `Outcome`
  retrievability (FR-005) — these are independent records.

## Relationship to 003's Session

`Session.status` transitioning to `ended` or `abandoned` (003) is the trigger
for this feature's `Outcome` creation. This feature does not modify `Session`'s
schema or transition logic — it only listens for the conclusion and attaches its
own records via `sessionId`.

## Session History Retrieval (FR-005)

No new entity — retrieval composes existing rows scoped by `tenantId`: `Session`
(002/003) + its `Message` list (003) + its `Outcome` (this feature), joined and
returned together for a concluded session. See
`contracts/session-history-api.md`.

## Isolation Invariant (inherited from 001)

Every read in this feature (session history, outcome data) is scoped by the
`tenantId` resolved from the authenticated (advisor/operator) context —
consistent with 001/002/003. Webhook delivery targets the
`webhookUrl`/`webhookSecret` on the `Session`'s own `Tenant` row only.

## Out of Scope for This Feature's Data Model

- Any tenant-side processing of the outcome — entirely external.
- Structured "automation gap" flags — deferred per spec Assumptions.
