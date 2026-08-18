# Contract: Outcome Webhook (outbound, Crossfade → Tenant)

Delivered to the tenant's registered `webhookUrl` (001) when a session concludes
(FR-001–FR-003, FR-009).

## Request

```
POST <tenant's registered webhookUrl>
Content-Type: application/json
X-Crossfade-Signature: sha256=<hex-hmac-of-raw-body>
X-Crossfade-Delivery-Attempt: 1
```

**Body**:

```json
{
  "referenceId": "interaction-abc123",
  "outcome": "resolved",
  "note": "Confirmed refund policy and processed manually; no automation gap.",
  "sessionId": "uuid",
  "concludedAt": "2026-08-18T00:12:00Z"
}
```

- `referenceId`: the tenant's own reference ID, unchanged since the original
  handoff request (002, FR-001) — the join key back to the tenant's own record.
- `outcome`: one of `resolved`, `not_resolved`, `abandoned` (FR-006).
- `note`: present only if the advisor supplied one (FR-004); omitted (not
  `null`) when absent, to keep payload shape minimal.
- `sessionId`: Crossfade's own identifier, for the tenant's own logs/support.
- `concludedAt`: timestamp the session reached its terminal state.

## Signature Verification

Tenant computes `HMAC-SHA256(webhookSecret, rawRequestBody)` and compares
(constant-time) against the hex value after `sha256=` in
`X-Crossfade-Signature`. `webhookSecret` is the tenant's _current_ secret at
delivery time — if rotated (001, FR-012) after a session began, the _new_ secret
is what signs this payload (FR-009).

## Delivery Semantics

- A `2xx` response from the tenant's endpoint marks the attempt `succeeded`; any
  other status or a timeout marks it a failure and schedules a retry with
  exponential backoff (FR-003; see `research.md` for the schedule).
- After the bounded attempt limit is exhausted without a `2xx`, no further
  attempts are made for that outcome — this does not affect the `Outcome`
  record's retrievability via `session-history-api.md` (FR-005).
- Exactly one `Outcome`/delivery sequence exists per session conclusion,
  regardless of how the session reached its terminal state (FR-007).
