# Contract: Chat WebSocket API

Real-time message delivery for an `active` session (FR-004, FR-005, FR-006,
FR-010). Both the user side and the advisor side connect to the same gateway;
server-side auth differs by which credential is presented (see below).

## Connection

```
wss://<host>/chat?sessionId=<uuid>
Authorization: Bearer <tenant-scoped user token | advisor credential>
```

- **User connection**: authenticated with a session-scoped token issued when the
  session was created (mechanism owned by 002/this feature's implementation
  phase — not a full user account system, matching v1's scope). Resolves to
  exactly that one `sessionId`.
- **Advisor connection**: authenticated with the advisor credential (see
  `contracts/advisor-sessions-api.md`). Only the advisor currently assigned to
  `sessionId` (`Session.advisorId`) may join.
- Connection to a session that is not `active` is rejected at connect time —
  `4001` close code, reason `"session not active"` (FR-005).
- On successful connect, the client joins that session's room and immediately
  receives the session's summary/context and message history (FR-006) via the
  `session:snapshot` event (below).

## Server → Client Events

### `session:snapshot` (sent once, on connect)

```json
{
  "sessionId": "uuid",
  "status": "active",
  "summary": "User asking about refund on order #4821.",
  "context": { "orderId": "4821" },
  "advisor": { "displayName": "Alex, Windwise recommendations team" },
  "messages": [
    {
      "id": "uuid",
      "senderType": "user",
      "content": "Hi, I need help...",
      "createdAt": "..."
    }
  ]
}
```

`advisor.displayName` is always the disclosed identity, never a placeholder
(FR-007).

### `message:new`

```json
{ "id": "uuid", "senderType": "user", "content": "...", "createdAt": "..." }
```

Broadcast to the other party in the room in real time (FR-004).

### `session:ended`

```json
{ "sessionId": "uuid", "status": "ended" | "abandoned" }
```

Sent to both parties when the session transitions out of `active` (via advisor
end or the abandonment sweep). No further `message:send` is accepted after this
event.

## Client → Server Events

### `message:send`

```json
{ "content": "..." }
```

- Rejected (emits `message:rejected`) if the session is not currently `active`
  (FR-005) — checked against live DB state, not just the connection's cached
  status, to close the race window described in the spec's edge cases.
- On success, persists the `Message` and broadcasts `message:new` to the room,
  and resets the session's derived activity clock (FR-010; no explicit client
  action needed beyond sending the message).

### `message:rejected`

```json
{ "reason": "session_not_active" }
```

Server → client, in response to a `message:send` that failed validation.
