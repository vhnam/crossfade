# Quickstart: Session Outcome & Callback

Validates this feature end-to-end against
[`contracts/outcome-webhook.md`](contracts/outcome-webhook.md) and
[`contracts/session-history-api.md`](contracts/session-history-api.md).

## Prerequisites

- `apps/api` running locally (`vp run api#dev`) with migrations applied.
- A tenant registered (001) with `webhookUrl` pointed at a local catcher (e.g.
  `webhook.site`, or a local HTTP echo server logging headers+body) and its
  `webhookSecret` known.
- A session picked up and `active` (002 + 003 quickstarts).

## Scenario 1 — Explicit end delivers a signed webhook (US1, US2)

```bash
curl -i -X POST http://localhost:3000/advisor/sessions/$SESSION_ID/end \
  -H "Authorization: Bearer $ADVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "outcome": "resolved", "note": "Confirmed refund policy, processed manually." }'
```

**Expected**: `200 OK`, `status: "ended"`, `outcome: "resolved"`. Within a few
seconds, the webhook catcher receives a `POST` with `referenceId`, `outcome`,
`note`, `sessionId`, `concludedAt`, and an `X-Crossfade-Signature` header.

**Verify signature** (pseudocode, any language):

```
computed = hex(hmac_sha256(webhookSecret, rawBody))
assert computed == signatureHeaderValue.replace("sha256=", "")
```

## Scenario 2 — Retry on transient failure (US2)

1. Point the tenant's `webhookUrl` at an endpoint that returns `500` for the
   first 2 requests, then `200`.
2. End another session as in Scenario 1.
3. Watch the webhook catcher / endpoint logs.

**Expected**: 3 delivery attempts total, with increasing delay between each
(exponential backoff — see `research.md`), and exactly one successful (`2xx`)
delivery recorded once the endpoint starts succeeding.

## Scenario 3 — Missing outcome is rejected (edge case, FR-008)

```bash
curl -i -X POST http://localhost:3000/advisor/sessions/$SESSION_ID/end \
  -H "Authorization: Bearer $ADVISOR_TOKEN" -H "Content-Type: application/json" \
  -d '{}'
```

**Expected**: `400 Bad Request` — `outcome` is required for an explicit end.

## Scenario 4 — Abandoned session gets automatic outcome (US1, FR-008)

Follow 003's quickstart Scenario 5 (abandonment sweep) on a fresh session, then
check the webhook catcher.

**Expected**: A webhook is delivered with `outcome: "abandoned"` and no `note`
field, without any advisor action.

## Scenario 5 — Session history retrieval (US4)

```bash
curl -s http://localhost:3000/advisor/sessions/$SESSION_ID/history \
  -H "Authorization: Bearer $ADVISOR_TOKEN"
```

**Expected**: `200 OK` with full `summary`, `context`, `messages` transcript,
and `outcome` (status + note) all present. Repeating with a different tenant's
advisor token against the same `sessionId` returns `404`.
