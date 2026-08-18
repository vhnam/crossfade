# Quickstart: Live 1:1 Chat Session

Validates this feature end-to-end against
[`contracts/advisor-sessions-api.md`](contracts/advisor-sessions-api.md) and
[`contracts/chat-websocket-api.md`](contracts/chat-websocket-api.md).

## Prerequisites

- `apps/api` running locally (`vp run api#dev`) with migrations applied.
- A tenant registered and active (001's quickstart), with a `waiting` session
  already created (002's quickstart, Scenario 1) — note its `sessionId`.
- An advisor registered for that tenant with its own credential (v1:
  operator-provisioned, same pattern as tenant onboarding — see `research.md`).

## Scenario 1 — Advisor picks up a waiting session (US1, P1)

```bash
curl -s http://localhost:3000/advisor/sessions?status=waiting \
  -H "Authorization: Bearer $ADVISOR_TOKEN"
# confirm the target sessionId appears

curl -i -X POST http://localhost:3000/advisor/sessions/$SESSION_ID/pickup \
  -H "Authorization: Bearer $ADVISOR_TOKEN"
```

**Expected**: `200 OK`, `status: "active"`, `advisorId` set. A second pickup
call on the same session (simulate concurrency) returns `409`.

## Scenario 2 — Real-time message exchange with context (US2, P1)

Using a WebSocket client (e.g. `wscat` or `socket.io-client`), connect both
sides and confirm delivery:

```bash
# Advisor side
wscat -c "ws://localhost:3000/chat?sessionId=$SESSION_ID" \
  -H "Authorization: Bearer $ADVISOR_TOKEN"
# Expect a session:snapshot event immediately containing summary/context

# User side (separate terminal, separate token)
wscat -c "ws://localhost:3000/chat?sessionId=$SESSION_ID" \
  -H "Authorization: Bearer $USER_SESSION_TOKEN"

# From either side, send:
# {"event":"message:send","data":{"content":"Hello!"}}
```

**Expected**: The other party's connection receives a `message:new` event with
the same content, in real time. The advisor's initial `session:snapshot` shows
the handoff `summary`/`context` from 002 without the user repeating anything.

## Scenario 3 — Advisor identity disclosed (US3, P2)

Inspect the `session:snapshot` event from Scenario 2.

**Expected**: `advisor.displayName` is the configured disclosed name (e.g.,
"Alex, Windwise recommendations team") — never a placeholder like "Support
Agent".

## Scenario 4 — Advisor ends the session (US4, P2)

```bash
curl -i -X POST http://localhost:3000/advisor/sessions/$SESSION_ID/end \
  -H "Authorization: Bearer $ADVISOR_TOKEN"
```

**Expected**: `200 OK`, `status: "ended"`. Both open WebSocket connections
receive `session:ended`. Any subsequent `message:send` on either connection is
rejected via `message:rejected`. A second `end` call returns `409`.

## Scenario 5 — Abandonment sweep (US5, P3)

Requires either waiting out the 30-minute default inactivity window on a
picked-up, message-free `active` session, or (in a test environment) configuring
a shorter window to validate the mechanism:

1. Pick up a session, send no messages.
2. Wait past the configured inactivity window.
3. Re-check the session's status.

**Expected**: `status: "abandoned"` without any advisor action, and both sides'
WebSocket connections (if still open) receive `session:ended` with
`status: "abandoned"`.
