# Contract: Session History API

Retrieval of a concluded session's full record (FR-005, US4). Extends 003's
advisor-facing surface; also extends 003's end-session endpoint to accept the
outcome at the same call (FR-008).

## `POST /advisor/sessions/{sessionId}/end` (extended from 003)

003 already defines this endpoint to move `active → ended`. This feature adds
required outcome fields to the request body.

**Request body**:

```json
{
  "outcome": "resolved",
  "note": "Confirmed refund policy and processed manually."
}
```

- `outcome`: required, one of `resolved`, `not_resolved` (FR-008 — `abandoned`
  is never advisor-selectable here).
- `note`: optional, ≤500 characters (`research.md`).

**Responses**:

- `200 OK` — session `ended`, `Outcome` recorded, webhook delivery attempt
  scheduled:
  ```json
  { "sessionId": "uuid", "status": "ended", "outcome": "resolved" }
  ```
- `400 Bad Request` — missing/invalid `outcome`, or `note` over the length
  limit.
- `409 Conflict` — session was not `active` (unchanged from 003).

## `GET /advisor/sessions/{sessionId}/history`

Retrieve a concluded session's full record (US4). Available once the session has
reached `ended` or `abandoned`.

**Response**: `200 OK`

```json
{
  "sessionId": "uuid",
  "referenceId": "interaction-abc123",
  "summary": "User asking about refund on order #4821.",
  "context": { "orderId": "4821" },
  "status": "ended",
  "advisor": { "displayName": "Alex, Windwise recommendations team" },
  "messages": [
    {
      "id": "uuid",
      "senderType": "user",
      "content": "...",
      "createdAt": "..."
    },
    {
      "id": "uuid",
      "senderType": "advisor",
      "content": "...",
      "createdAt": "..."
    }
  ],
  "outcome": {
    "status": "resolved",
    "note": "Confirmed refund policy and processed manually.",
    "createdAt": "2026-08-18T00:12:00Z"
  }
}
```

- `404 Not Found` — session doesn't exist, belongs to another tenant, or hasn't
  concluded yet (history is only exposed for terminal-state sessions in v1).
- Scoped to the requesting advisor's own tenant only (FR-005; 001's isolation
  guarantee).
- `outcome` is always present once returned by this endpoint — a concluded
  session with no `Outcome` row would indicate a bug in FR-007's exactly-once
  guarantee, not a valid empty state.
