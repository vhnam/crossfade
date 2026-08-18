# Phase 0 Research: Availability Fail-safe

## Context

Fifth feature, but cross-cutting rather than a new module — it hardens 002's
handoff-intake endpoint and 003's WebSocket chat gateway against Crossfade-side
failure, on the same NestJS + Prisma + PostgreSQL stack established in 001. The
open questions are about _how_ to bound response time and detect disconnects,
not about technology choice.

## Decisions

### Bounded handoff-intake response time: 5-second server-side request timeout

- **Decision**: Enforce a 5-second hard timeout on the handoff-intake endpoint
  via a NestJS interceptor (`common/timeout.interceptor.ts`) wrapping the
  request pipeline — if the handler hasn't responded within 5 seconds, the
  request is aborted server-side and a `503 Service Unavailable` is returned.
- **Rationale**: FR-001/FR-005 require a documented bound tenants can rely on
  for their own client-side timeout. 5 seconds is consistent with 002's own
  SC-001 (session identifier returned in the same request/response cycle) and
  standard synchronous-request UX expectations (spec Assumptions). Enforcing it
  server-side (not just documenting a number and hoping) is what makes FR-001's
  "MUST respond within a bounded time" actually true under Crossfade-side
  degradation (e.g. a slow database query) — the tenant's own client-side
  timeout alone can't protect Crossfade's resources or guarantee the number is
  real.
- **Alternatives considered**:
  - **Document a target without server-side enforcement**: rejected — doesn't
    satisfy "MUST respond within a bounded time," only "typically does," which
    isn't testable (fails the spec's own SC-001 framing).
  - **Longer timeout (e.g. 30s)**: rejected — handoff-intake is a simple
    create-or-return-existing operation (002); no legitimate execution path
    should approach even 5s, so a tight bound catches real degradation faster
    without false-positive risk.

### Real-time disconnect detection: Socket.IO's built-in heartbeat (ping/pong)

- **Decision**: Rely on Socket.IO's existing ping/pong heartbeat (already active
  by default once 003's `@nestjs/websockets`/`socket.io` gateway is in place) to
  detect a silent connection drop (e.g. network partition), not just the clean
  `disconnect` event. On heartbeat timeout or `disconnect`, the gateway emits a
  `party:disconnected` event to the _other_ party in the session's room and
  updates connection state via a new `connection-state.service.ts`.
- **Rationale**: FR-003 requires the affected party to see a visible
  disconnected state — critically, this must work for silent drops (network
  partition), not just a clean disconnect, per the plan's constraint. Socket.IO
  already performs heartbeat-based liveness checking as part of its protocol (no
  new dependency, 003 already depends on `socket.io`), so this is
  enabling/consuming existing behavior rather than building new liveness
  infrastructure.
- **Alternatives considered**:
  - **Rely only on the `disconnect` event**: rejected — a network partition (the
    case FR-003 cares most about) doesn't fire a clean `disconnect`; without
    heartbeat-based detection, the still-connected party would see silence
    indistinguishable from the advisor simply not responding, which is exactly
    what FR-003 exists to prevent.
  - **Custom application-level ping/pong**: rejected — duplicates functionality
    Socket.IO already provides.

### "Other party" notification, not just self-detection

- **Decision**: When party A's connection drops (detected via heartbeat timeout
  or `disconnect`), the gateway broadcasts `party:disconnected` to party B's
  socket (if still connected) in the same session room — not only a local error
  shown to A (who, by definition, may not be able to receive anything).
- **Rationale**: FR-003's actual failure mode described in the spec is the
  _other_ party seeing silence and assuming they're being ignored (Scenario 2).
  The disconnected party often can't be shown anything (their connection is the
  one that's down) — the value is in informing the _still-connected_ party,
  which requires an explicit server-side broadcast, not client-side
  self-detection alone.
- **Alternatives considered**:
  - **Client-side-only detection (each client shows its own connectivity
    state)**: rejected as insufficient alone — doesn't address the case central
    to the spec's Scenario 2, where the _other_ party needs to know.

### Recovery requires no tenant action: statelessness of the timeout/auth path

- **Decision**: No change needed beyond what 001/002 already do — since
  handoff-intake requests are stateless (each request independently
  authenticates via the tenant's existing API key, per 001) and this feature
  adds no new tenant-facing configuration or handshake step, a request made
  after an outage ends is indistinguishable from any other request and succeeds
  automatically (FR-004). This is validated by a quickstart scenario rather than
  requiring new application logic.
- **Rationale**: FR-004 is satisfied by _not_ introducing new outage-related
  state (e.g. no circuit-breaker flag requiring manual reset, no per-tenant
  "paused" status) — the simplest way to guarantee automatic recovery is to
  ensure there's nothing that needs resetting in the first place.
- **Alternatives considered**:
  - **Circuit breaker with manual reset**: rejected — directly contradicts
    FR-004's "no tenant-side action required to resume."
  - **Circuit breaker with automatic half-open recovery (e.g. standard
    circuit-breaker pattern)**: considered but rejected as unneeded complexity
    at v1 scale — a circuit breaker protects Crossfade from cascading failure
    under high load, which isn't a concern yet (single tenant, low volume); the
    timeout interceptor alone already bounds worst-case behavior without needing
    breaker-state tracking.

## Resolved Technical Context

All Technical Context fields in `plan.md` are resolved by the decisions above —
no outstanding NEEDS CLARIFICATION.
