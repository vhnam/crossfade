# Quickstart: Availability Fail-safe

Validates this feature end-to-end against
[`contracts/handoff-intake-timeout.md`](contracts/handoff-intake-timeout.md) and
[`contracts/chat-disconnect-events.md`](contracts/chat-disconnect-events.md).

## Prerequisites

- `apps/api` running locally (`vp run api#dev`) with migrations applied.
- A tenant registered and active (001), and an advisor provisioned (003).

## Scenario 1 — Handoff-intake fails fast under simulated slowness (US1)

In a local/test environment, introduce an artificial delay in the handoff-intake
handler's downstream call (e.g. a test-only flag that sleeps 10 seconds before
hitting the database) and issue a request:

```bash
time curl -i -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "referenceId": "interaction-timeout-test", "summary": "Timeout test." }'
```

**Expected**: Response returned at or just after the 5-second mark (never at
10s), with `503 Service Unavailable`. `time` confirms it did not hang.

## Scenario 2 — Normal handoff still succeeds quickly (regression check)

```bash
time curl -i -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "referenceId": "interaction-normal", "summary": "Normal request." }'
```

**Expected**: `201 Created` well under 5 seconds — the timeout must not add
latency to the healthy path.

## Scenario 3 — Real-time disconnect surfaces to the other party (US2)

1. Pick up a session and connect both user and advisor WebSocket clients (per
   003's quickstart Scenario 2).
2. Forcibly kill the advisor's connection (close the socket without a clean
   disconnect — e.g. kill the client process, or drop the network interface, to
   simulate a silent partition rather than a graceful close).
3. Watch the user's connection.

**Expected**: Within a few seconds (bounded by Socket.IO's heartbeat timeout),
the user's client receives `party:disconnected` with `{"party":"advisor"}`.

## Scenario 4 — Reconnect clears the indicator

Reconnect the advisor's client to the same session.

**Expected**: The user's client receives `party:reconnected` with
`{"party":"advisor"}`. The session itself remains `active` throughout — confirm
via `GET /advisor/sessions?status=active` (003) that it was never transitioned
to `ended` or `abandoned` by the disconnect alone.

## Scenario 5 — Recovery requires no tenant action (US3)

1. Reproduce Scenario 1's slow/failing state, confirm a handoff request fails
   (`503`).
2. Remove the artificial slowness (service "recovers").
3. Immediately retry the same handoff request shape, same tenant credential, no
   configuration change:

```bash
curl -i -X POST http://localhost:3000/handoffs \
  -H "Authorization: Bearer $TENANT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "referenceId": "interaction-recovery-test", "summary": "Post-outage request." }'
```

**Expected**: `201 Created` — succeeds immediately, no reset/re-auth step
needed.
