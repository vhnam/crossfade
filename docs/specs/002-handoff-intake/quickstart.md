# Quickstart: Handoff Intake

Validates the feature end-to-end against the contract in
[`contracts/handoff-intake-api.md`](contracts/handoff-intake-api.md) and the
data model in [`data-model.md`](data-model.md).

## Prerequisites

- `apps/api` running locally (`vp run api#dev`) against a Postgres instance with
  migrations applied (`vp run -r db:migrate` or project equivalent — see
  `apps/api` scripts once implemented).
- A tenant already registered and active, per 001's quickstart — you need its
  `apiKey` (e.g. `cf_live_...`).

## Scenario 1 — Create a new handoff (US1, P1)

```bash
curl -i -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "referenceId": "interaction-abc123",
    "summary": "User asking about refund on order #4821.",
    "deepLink": "https://windwise.example.com/interactions/abc123",
    "context": { "orderId": "4821" }
  }'
```

**Expected**: `201 Created`, body contains `sessionId`, `status: "waiting"`.

## Scenario 2 — Context preserved as-is (US2, P2)

Repeat the request above with a `context` object containing nested arrays,
unusual keys, or values that resemble (but don't match) any schema:

```bash
curl -s -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "referenceId": "interaction-def456",
    "summary": "Edge-case context shape test.",
    "context": { "nested": { "deep": [1, 2, { "x": null }] }, "weird_key!!": true }
  }'
```

**Expected**: `201 Created`. Fetching the session record afterward (via whatever
read path 003 exposes, or a direct DB check during development) shows `context`
byte-for-byte identical to what was sent.

## Scenario 3 — Duplicate handoff returns existing session (US3, P2)

```bash
# First request
curl -s -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "referenceId": "interaction-repeat1", "summary": "First." }' | tee /tmp/first.json

# Second request, same referenceId
curl -i -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "referenceId": "interaction-repeat1", "summary": "Second, should not create new session." }'
```

**Expected**: Second call returns `200 OK` with the **same** `sessionId` as the
first call's response.

## Scenario 4 — Missing required fields rejected (edge case)

```bash
curl -i -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "summary": "Missing referenceId." }'
```

**Expected**: `400 Bad Request`.

## Scenario 5 — No cross-tenant leakage (isolation, inherited from 001)

Using a second tenant's `apiKey`, submit a handoff with the same `referenceId`
used in Scenario 1. **Expected**: `201 Created` — a _new_ session, not the first
tenant's session (reference IDs are scoped per tenant, FR-006).
