# Contract: Advisor Sessions API (REST)

Advisor-facing endpoints for listing, picking up, and ending sessions
(FR-001–FR-003, FR-008). Authenticated by a new advisor credential — see
`advisor-auth` in `research.md` — distinct from 001's tenant API key.

## Headers

```
Authorization: Bearer adv_live_<advisor-credential>
```

Resolves to exactly one `(tenantId, advisorId)` pair. Missing/invalid →
`401 Unauthorized`.

## `GET /advisor/sessions?status=waiting`

List sessions for the advisor's own tenant (FR-001). Query param `status`
filters (`waiting`, `active`, `ended`, `abandoned`); defaults to `waiting` if
omitted.

**Response**: `200 OK`

```json
[
  {
    "sessionId": "uuid",
    "referenceId": "interaction-abc123",
    "summary": "User asking about refund on order #4821.",
    "deepLink": "https://windwise.example.com/interactions/abc123",
    "context": { "orderId": "4821" },
    "status": "waiting",
    "advisorId": null,
    "createdAt": "2026-08-18T00:00:00Z"
  }
]
```

Never includes sessions from another tenant (FR-001).

## `POST /advisor/sessions/{sessionId}/pickup`

Pick up a `waiting` session (FR-002, FR-003).

**Responses**:

- `200 OK` — session now `active`, assigned to the calling advisor:
  ```json
  { "sessionId": "uuid", "status": "active", "advisorId": "uuid" }
  ```
- `409 Conflict` — session was not in `waiting` state (already picked up by this
  or another advisor, already `ended`/`abandoned`). Body indicates no change was
  made:
  ```json
  { "statusCode": 409, "message": "Session is not available for pickup" }
  ```
- `404 Not Found` — session doesn't exist, or belongs to another tenant
  (indistinguishable, per 001's isolation pattern).

Concurrency: two simultaneous pickup calls on the same session — exactly one
returns `200`, the other `409` (SC-003; see `research.md`'s atomic
conditional-update decision).

## `POST /advisor/sessions/{sessionId}/end`

End an `active` session (FR-008).

**Responses**:

- `200 OK` — session now `ended`:
  ```json
  { "sessionId": "uuid", "status": "ended" }
  ```
- `409 Conflict` — session was not `active` (edge case: nothing to end):
  ```json
  { "statusCode": 409, "message": "Session is not active" }
  ```
- `404 Not Found` — doesn't exist / wrong tenant.
- Only the advisor assigned to the session may end it — another advisor in the
  same tenant attempting to end a session assigned to a colleague returns
  `403 Forbidden`.
