# Phase 1 Data Model: Availability Fail-safe

## No New Persisted Entities

This feature is cross-cutting behavior over 002's handoff-intake endpoint and
003's real-time chat connection — it does not add or modify any Prisma model.
`Session`, `Message`, `Advisor`, `Outcome`, and `WebhookDeliveryAttempt`
(001–004) are unchanged.

## In-Memory Connection State (not persisted)

`connection-state.service.ts` (see `plan.md`) tracks, per active session's
Socket.IO room, which of the two parties (user/advisor) is currently connected —
an in-memory map, not a database table. This is intentionally ephemeral:

| Concept                                                              | Notes                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionId -> { userConnected: boolean, advisorConnected: boolean }` | Held in server memory for the lifetime of the process; rebuilt from live socket connections on restart. Never queried historically — FR-003 only cares about _current_ connection state, not an audit trail of drops. |

**Why not persisted**: A disconnect/reconnect event is a live-session UX concern
(FR-003/SC-002), not part of the durable record 004 already owns (transcript,
outcome). Persisting connection-state history would be scope creep beyond what
any functional requirement in this feature or its dependents asks for.

## Isolation Invariant (inherited from 001)

`party:disconnected` broadcasts are scoped to the specific session's room (003)
— never broadcast beyond the two parties already authenticated into that
session, consistent with 001's isolation guarantee.
