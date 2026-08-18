# Contract: Handoff Intake API

Tenant-facing endpoint for submitting a handoff request (FR-001–FR-007).
Authenticated identically to every other tenant-facing endpoint — see 001's
[tenant-authentication contract](../../001-tenant-onboarding-isolation/contracts/tenant-authentication.md).
No new auth mechanism is introduced here.

## `POST /handoffs`

Create (or resolve to the existing) session for a tenant's interaction.

**Headers**:

```
Authorization: Bearer cf_live_<api-key>
```

**Request body**:

```json
{
  "referenceId": "interaction-abc123",
  "summary": "User asking about refund on order #4821, frustrated after 2 failed attempts.",
  "deepLink": "https://windwise.example.com/interactions/abc123",
  "context": {
    "orderId": "4821",
    "anything": ["the tenant wants to include, in any shape"]
  }
}
```

- `referenceId` (string, required): tenant's own reference ID for the
  interaction (FR-001, FR-007).
- `summary` (string, required): short human-readable summary (FR-001, FR-007).
- `deepLink` (string, optional): URL back to the tenant's own record (FR-001).
- `context` (object, optional): arbitrary structured context, stored opaquely
  (FR-001, FR-002). Any valid JSON object is accepted; Crossfade does not
  validate its shape.

**Responses**:

- `201 Created` — new session created in `waiting` state:
  ```json
  {
    "sessionId": "uuid",
    "status": "waiting",
    "referenceId": "interaction-abc123",
    "createdAt": "2026-08-18T00:00:00Z"
  }
  ```
- `200 OK` — an existing non-ended session already exists for this
  `referenceId`; no new session created (FR-004):
  ```json
  {
    "sessionId": "uuid",
    "status": "waiting",
    "referenceId": "interaction-abc123",
    "createdAt": "2026-08-17T23:58:00Z"
  }
  ```
  Response shape is identical to `201` except the HTTP status and `createdAt`
  reflecting the original session, signaling "this already existed" to a tenant
  that inspects the status code, while remaining trivially easy to handle
  identically to `201` if the tenant doesn't care about the distinction.
- `400 Bad Request` — missing `referenceId` or `summary`, or
  `context`/`deepLink` present but not valid JSON/URL respectively (FR-007):
  ```json
  { "statusCode": 400, "message": "referenceId and summary are required" }
  ```
- `401 Unauthorized` / `403 Forbidden` — per 001's tenant-authentication
  contract (missing/invalid key, or suspended tenant).

## Notes on FR-005 (no advisor routing)

This endpoint accepts no field for selecting or influencing which advisor
handles the session — there is no `advisorId`, `queue`, or priority field. Any
such field sent by a tenant is ignored (not rejected), since silently ignoring
unknown fields is less surprising to integrators than a hard `400` for
forward/backward compatibility — but no such field is ever read or acted upon
(FR-005).
