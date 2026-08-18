# Contract Addendum: Chat Disconnect Detection

Extends 003's
[`contracts/chat-websocket-api.md`](../../003-live-chat-session/contracts/chat-websocket-api.md)
with the new server → client event this feature adds (FR-003).

## New Server → Client Event: `party:disconnected`

Sent to a session's still-connected party when the _other_ party's connection
drops — whether via a clean disconnect or a heartbeat timeout
(silent/network-level drop; see `research.md`).

```json
{ "party": "advisor" | "user" }
```

- `party`: which side disconnected — lets the client show an accurate "advisor
  disconnected" or "user disconnected" indicator rather than a generic error.
- The client SHOULD render a visible disconnected indication in the chat UI upon
  receiving this event (SC-002: within a few seconds of the actual drop, bounded
  by Socket.IO's heartbeat interval/timeout).

## New Server → Client Event: `party:reconnected`

Sent when the previously-disconnected party reconnects to the same session's
room before the session times out or is otherwise concluded.

```json
{ "party": "advisor" | "user" }
```

- The client SHOULD clear the disconnected indication upon receiving this event.

## Relationship to `session:ended`

A disconnect (`party:disconnected`) is **not** the same as the session
concluding (`session:ended`, 003) — a session remains `active` while a party is
disconnected; only an explicit advisor end or 003's inactivity sweep transitions
the session out of `active`. A disconnected party can reconnect and resume
messaging in the same still-`active` session.
