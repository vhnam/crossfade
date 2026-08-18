# SPDD Analysis: Availability Fail-safe

## Original Business Requirement

# Feature Specification: Availability Fail-safe

**Feature Branch**: `005-availability-fail-safe`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Availability Fail-safe — Crossfade must never
become a single point of failure for a tenant's own product. If Crossfade is
down, slow, or otherwise unavailable, the tenant's core flow (e.g. a
recommendation chatbot) must keep working — the live-chat option simply isn't
offered. Cross-cutting: constrains how the handoff-intake (002) and live-chat
(003) endpoints behave under failure, rather than being its own standalone user
flow. Not depended on by anything else — this is a constraint, not a
dependency."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Crossfade is unreachable when a tenant tries to request a handoff (Priority: P1)

As a tenant, if my handoff request to Crossfade fails or times out, my own
product continues to function normally for the user — I just don't offer the
"talk to a person" option for that interaction.

**Why this priority**: This is the core promise of the feature — a tenant
integrating Crossfade must never have their own product's availability degraded
by Crossfade's. Without this, adopting Crossfade carries unacceptable risk for
any tenant.

**Independent Test**: Can be fully tested by simulating an unreachable or slow
Crossfade handoff-intake endpoint and confirming a client request against it
fails fast (within a bounded time) rather than hanging indefinitely —
independent of any other feature's behavior.

**Acceptance Scenarios**:

1. **Given** the handoff-intake endpoint (002) is unreachable, **When** a tenant
   sends a handoff request, **Then** the request fails within a bounded time
   rather than hanging.
2. **Given** the handoff-intake endpoint is reachable but abnormally slow,
   **When** a tenant sends a handoff request, **Then** the request either
   completes or fails within the same bounded time — it does not wait
   indefinitely for a slow response.
3. **Given** a handoff request fails or times out, **When** the tenant's own
   system handles that failure, **Then** the tenant's core flow (e.g. its own
   chatbot) is documented and designed to continue functioning normally, with
   the live-chat option simply not offered for that interaction.

---

### User Story 2 - Crossfade degrades mid-session (Priority: P1)

As a user already in an active chat, if Crossfade becomes unavailable
mid-conversation, I should get a clear indication the connection was lost rather
than silence that looks like the advisor is ignoring me.

**Why this priority**: Equal priority to US1 — a user mid-conversation who gets
silent, unexplained non-responses has a worse experience than one who was simply
never offered chat, and erodes trust in both Crossfade and the tenant's product.

**Independent Test**: Can be fully tested by establishing an active session's
real-time connection (003) and then forcibly interrupting it, then confirming
the affected party's client surfaces a visible disconnected state rather than
appearing to hang or go silent.

**Acceptance Scenarios**:

1. **Given** an active session's real-time connection drops, **When** the drop
   is detected, **Then** the affected party (user or advisor) is shown a visible
   disconnected indication.
2. **Given** a visible disconnected state is shown, **When** the connection is
   restored before the session times out, **Then** the indication clears and the
   conversation can continue.
3. **Given** a connection drop is not silently ignored, **When** it occurs,
   **Then** no message sent by either party during the outage is lost without at
   least one side being made aware something went wrong.

---

### User Story 3 - Crossfade recovers (Priority: P2)

As a tenant, once Crossfade is available again, new handoff requests succeed
again without any manual reset needed on my end.

**Why this priority**: Important for correctness and reducing operational
burden, but the acute failure-handling behavior (US1/US2) is what protects the
tenant during an incident — recovery being automatic is what makes the fail-safe
posture sustainable rather than requiring manual intervention every time, but it
doesn't block the core promise from being demonstrated.

**Independent Test**: Can be fully tested by simulating a Crossfade outage (per
US1), then restoring normal service, and confirming a new handoff request
succeeds without any tenant-side configuration change, credential reset, or
manual re-enablement step.

**Acceptance Scenarios**:

1. **Given** Crossfade was previously unreachable, **When** it becomes available
   again, **Then** a new handoff request from the same tenant succeeds using the
   same integration configuration as before the outage.
2. **Given** service has resumed, **When** the tenant checks whether any action
   is required on their end, **Then** none is needed — no reset,
   re-registration, or credential change.

---

### Edge Cases

- What happens if Crossfade responds successfully but far slower than the
  bounded response time the tenant is designed to wait for? The tenant's
  integration pattern (informed by FR-2's bounded-time contract) treats this the
  same as a failure — the live-chat option is not offered for that interaction,
  even though Crossfade eventually would have responded.
- What happens if a session is mid-conversation and Crossfade's real-time layer
  degrades for only one of the two parties (e.g. the advisor's connection drops
  but the user's stays up)? Each party's client independently detects and
  surfaces its own connection state — one party seeing a disconnected indicator
  does not require or imply the other party sees one.
- What happens during a partial outage (e.g. handoff-intake works but real-time
  chat doesn't, or vice versa)? Each surface's failure mode is independent — a
  working handoff-intake endpoint during a real-time outage still returns a
  session identifier; whether that session can ever become useful to the user
  depends on the real-time layer recovering separately.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The handoff-intake endpoint (002) MUST respond within a bounded,
  documented time or fail fast — a tenant's request MUST never hang waiting on
  Crossfade indefinitely.
- **FR-002**: A tenant's integration pattern MUST treat a failed or timed-out
  handoff request as non-fatal to the tenant's own flow — this is a requirement
  on the expected integration contract, which Crossfade's API MUST make easy to
  honor via FR-001's bounded-time behavior.
- **FR-003**: If a session's real-time connection drops mid-conversation (003),
  the affected party (user or advisor) MUST see a visible disconnected state
  rather than silent message loss or apparent non-response.
- **FR-004**: No tenant-side action MUST be required to resume normal
  handoff-request integration after a Crossfade outage — service recovery MUST
  be automatic from the tenant's perspective, using the same credentials and
  configuration as before the outage.
- **FR-005**: Crossfade's documented API contract for the handoff-intake
  endpoint MUST state the bounded response time tenants can rely on, so tenant
  integrations can set matching client-side timeouts.

### Key Entities _(include if feature involves data)_

This feature is cross-cutting behavior over 002's and 003's existing entities
(`Session`, real-time connections) — it introduces no new persisted entities of
its own.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of handoff-intake requests either succeed or fail within the
  documented bounded response time — none hang beyond it.
- **SC-002**: 100% of real-time connection drops during an active session result
  in a visible disconnected indication to the affected party within a few
  seconds of the drop being detected.
- **SC-003**: 100% of handoff requests made after a Crossfade outage ends
  succeed on the first attempt, with zero manual tenant-side intervention
  required.
- **SC-004**: A tenant's own core product flow shows zero measurable degradation
  in its own response time or availability that is attributable to a Crossfade
  outage, when the tenant's integration follows the documented bounded-timeout
  pattern (FR-002/FR-005).

## Assumptions

- The bounded response time for handoff-intake (FR-001/FR-005) is a short, fixed
  value appropriate for a synchronous request in a user flow — assumed to be a
  few seconds (e.g. under 5 seconds), consistent with 002's own success criteria
  (SC-001 there requires the identifier returned in the same request/response
  cycle); the exact figure is an implementation/contract detail to finalize
  during planning, not a business decision requiring stakeholder input.
- "Visible disconnected state" (FR-003) means a clear UI-level indication in the
  tenant-facing or advisor-facing chat surface — the precise visual treatment is
  a UI implementation detail, not specified here.
- This feature does not introduce redundancy, multi-region failover, or a formal
  uptime SLA — explicitly out of scope at current single-tenant, single-advisor
  scale.
- Automatic retry of a _failed handoff request_ is the tenant's own integration
  responsibility, not something Crossfade performs on the tenant's behalf (out
  of scope, per source doc).
- This feature constrains 002 (handoff-intake) and 003 (live chat) but does not
  alter their functional scope — it specifies failure-mode behavior for
  endpoints/connections those features already define.

## Domain Concept Identification

#### Existing Concepts (from codebase)

- None **in code**. `apps/api` remains the unmodified NestJS skeleton — no
  `handoffs` or `chat` module exists yet; all of 001–004 exist only as
  REASONS-Canvas prompts, not working code. This feature's own plan describes
  itself as modifying `handoffs.controller.ts` (002) and `chat.gateway.ts` (003)
  directly — files that do not yet exist in the working tree.
- **Handoff-intake endpoint** (002, conceptual): `POST /handoffs` — this feature
  wraps its existing request-handling with a bounded-time guarantee; it does not
  change what the endpoint does, only how long it's allowed to take before
  failing.
- **Real-time chat connection / `ChatGateway`** (003, conceptual): the WebSocket
  gateway whose connection lifecycle this feature adds detection logic to; it
  does not change message-delivery semantics, only adds visibility into
  connection health.

#### New Concepts Required

- **Bounded Response Time (request timeout enforcement)**: a cross-cutting
  mechanism, not a stored entity — a hard, server-enforced ceiling on how long
  the handoff-intake endpoint may take before the server itself gives up and
  responds with a failure, rather than trusting the client's own patience or a
  downstream dependency's speed. Its defining property is that it must be
  _server-side and real_, not just documented, since only server-side
  enforcement can make FR-001's "MUST respond within a bounded time" actually
  true when Crossfade itself (not the network) is what's slow.
- **Connection State (per session, in-memory)**: an ephemeral, non-persisted
  concept — "which of the two parties in an active session's real-time room is
  currently connected." Distinct from anything 003 stores durably
  (`Session.status`, `Message` history) — this is live-process state, rebuilt
  from actual socket connections, never queried historically.
- **Disconnect/Reconnect Notification**: a new real-time event pair
  (`party:disconnected`, `party:reconnected`) — the mechanism by which the
  _still-connected_ party in a session learns that the _other_ party's
  connection dropped or was restored. Conceptually distinct from the session's
  own lifecycle (`session:ended`) — a disconnect never, by itself, concludes a
  session.
- **Availability Recovery (implicit, not a mechanism to build)**: the concept
  that "Crossfade becoming healthy again" requires no special handling at all —
  recovery is simply the absence of continued failure, not a state transition
  anything needs to detect or act on. This is the one "new concept" in this
  feature that resolves to _not building anything_, which is itself a decision
  worth naming explicitly rather than leaving implicit.

#### Key Business Rules

- The handoff-intake endpoint must never let a request hang past a documented
  bound, and that bound must be enforced by Crossfade's own server, not merely
  assumed from a tenant's client-side timeout — governs `Bounded Response Time`
  (FR-001, FR-005).
- A tenant's own product must be designed to treat any handoff-request failure
  (timeout, error, or unexpectedly slow-but-eventually-successful response) as
  simply "live chat isn't offered for this interaction" — this is a rule about
  the _expected integration contract_, not something Crossfade's code can
  enforce on the tenant's side, only make easy to honor (FR-002).
- When one party's real-time connection drops — whether via a clean disconnect
  or a silent network-level failure — the _other_, still-connected party must be
  told, not left to infer abandonment from silence — governs
  `Disconnect/Reconnect Notification` (FR-003), and critically must cover silent
  drops, not just clean ones, since a clean-close-only detector would miss the
  exact failure mode (network partition) the spec cares most about.
- A disconnect is never itself a session-concluding event — the session stays
  `active` (003's state machine, unmodified by this feature) while a party is
  disconnected, and reconnection resumes the same session with no data lost —
  governs the relationship between `Connection State` and `Session.status`
  (003).
- Nothing about recovering from a Crossfade-side outage may require any
  tenant-side action (credential reset, re-registration, manual re-enablement) —
  governs `Availability Recovery`, and is best satisfied by _not_ introducing
  any new stateful "outage flag" that would need resetting in the first place
  (FR-004).

## Strategic Approach

#### Solution Direction

- This is the first cross-cutting feature in the chain — it introduces no new
  domain module and no new persisted entity. Instead, it directly hardens two
  existing surfaces this codebase's other features already own: 002's
  handoff-intake request handling gains a server-enforced response-time ceiling,
  and 003's `ChatGateway` connection lifecycle gains disconnect/reconnect
  detection and notification. Both changes are additive constraints on existing
  behavior, not new behavior in their own right.
- Because this feature touches 002's and 003's own files directly (unlike 004,
  which only needed two small additive call-outs from 003), its solution
  direction should favor the smallest, most isolated change at each touch point
  — a shared, reusable timeout mechanism for the request-handling side (since
  any future synchronous tenant-facing endpoint might need the same bound, not
  just this one), and connection-state tracking that lives entirely inside 003's
  real-time module rather than spreading into a new domain concept.
- Data/event flow: for the request side, an enforcement layer wraps the existing
  handoff-intake request pipeline, imposing a hard ceiling independent of what
  the handler itself is doing. For the real-time side, the existing Socket.IO
  transport's own liveness mechanism (already implicitly present the moment
  003's WebSocket gateway exists) is what actually detects a silent drop; this
  feature's job is to _react_ to that detection (notify the other party) rather
  than build new liveness-detection machinery from scratch.

#### Key Design Decisions

- **Where the bounded-response-time guarantee is actually enforced**:
  documenting a target number for tenants to trust vs. having Crossfade's own
  server actively enforce it. → Recommend server-side enforcement — a documented
  number that isn't actually guaranteed by the server itself is not a guarantee
  at all; it's only real when a slow downstream dependency (e.g., an overloaded
  database) is forcibly cut off by Crossfade's own request-handling layer, not
  left to the tenant's patience. This also protects Crossfade's own resources
  from an indefinitely-hanging request, a secondary but real benefit.
- **How aggressive the bound should be**: a longer, more forgiving timeout
  (reduces false-positive failures under normal transient slowness) vs. a tight
  bound consistent with the endpoint's actual expected work. → Recommend a tight
  bound in the low single-digit seconds — handoff-intake (002) is fundamentally
  a simple create-or-return-existing operation with no legitimate reason to
  approach even a few seconds under normal operation, so a tight bound catches
  genuine degradation quickly without meaningfully risking false positives on
  the healthy path. The exact number is a REASONS-Canvas-level decision, not a
  business one (per the spec's own Assumptions).
- **How to detect a dropped real-time connection**: rely only on a clean
  `disconnect` event vs. also detecting silent, network-level drops via the
  transport's own heartbeat/liveness mechanism. → Recommend heartbeat-based
  detection — the spec's own most important failure mode (Scenario 2: a user
  seeing silence and assuming they're being ignored) is exactly the
  silent-partition case a clean-disconnect-only detector would miss entirely;
  the real-time transport already has liveness-checking built into its protocol,
  so this is a matter of wiring existing behavior to a notification, not
  inventing new infrastructure.
- **Who gets notified when a connection drops**: only the disconnected party
  sees their own local error (client-side self-detection) vs. the _other_,
  still-connected party is explicitly told via a server-pushed event. →
  Recommend explicitly notifying the other party — the disconnected party's own
  client may not even be capable of receiving a notification (their connection
  is the one that's down); the actual harm the spec describes happens to the
  _still-connected_ party, who needs a server-side signal since they have no way
  to locally infer that the silence they're experiencing is a connection problem
  rather than a person problem.
- **How "recovery requires no tenant action" is achieved**: an explicit
  circuit-breaker/outage-tracking mechanism (with either manual or automatic
  reset) vs. simply not introducing any stateful "Crossfade is down" flag in the
  first place. → Recommend the latter — since every tenant-facing request in
  this codebase already authenticates independently and statelessly (001's
  per-request credential resolution), the simplest way to guarantee automatic
  recovery is to add nothing that would need resetting; a circuit breaker would
  be solving a scaling/cascading-failure problem this system doesn't have yet at
  v1's volume, at the cost of directly contradicting FR-004's "no tenant-side
  action" requirement if it ever required manual reset.

#### Alternatives Considered

- **Circuit breaker with manual reset**: rejected outright — directly
  contradicts FR-004's core requirement that recovery needs zero tenant-side
  action.
- **Circuit breaker with automatic half-open recovery** (standard resilience
  pattern): considered but rejected for v1 — protects against cascading failure
  under load, which isn't a real risk at current single-tenant, single-advisor
  scale; the bounded-timeout mechanism alone already caps worst-case behavior
  without needing breaker-state tracking, and adding one would be complexity
  without a corresponding problem to solve yet.
- **Custom application-level ping/pong for disconnect detection**: rejected —
  the real-time transport already performs heartbeat-based liveness checking as
  part of its own protocol; building a parallel mechanism would duplicate
  existing capability for no benefit.
- **Client-side-only connectivity indication (no server-pushed notification to
  the other party)**: rejected as insufficient — doesn't address the spec's
  central concern (the _other_ party's experience of unexplained silence), only
  the disconnected party's own (often unreachable) client.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **The exact bounded-response-time value is explicitly left as a
  to-be-finalized implementation detail**: the spec's own Assumptions frame this
  as "a few seconds (e.g. under 5 seconds)," not a fixed contractual number —
  this is fine as a spec-level deferral, but a REASONS-Canvas-level
  implementation absolutely needs a concrete, single number (documented in the
  API contract, per FR-005) rather than a range, since tenants need one specific
  figure to set their own client-side timeouts against.
- **Whether the timeout must also stop in-flight downstream work, or merely stop
  waiting for it**: the spec requires the _response_ to be bounded ("respond
  within a bounded time or fail fast"), but doesn't address whether an in-flight
  downstream call (e.g., a slow database query) that caused the timeout should
  also be actively cancelled, or left to complete in the background after the
  client has already received a `503`. This matters for resource cleanliness
  under sustained degradation but isn't called out as a requirement — worth an
  explicit decision rather than an assumed default.
- **What "a few seconds" means precisely for real-time disconnect detection
  (SC-002)** is not tied to any concrete number in the spec, and relying on the
  real-time transport's _default_ heartbeat/liveness configuration may not
  actually satisfy that bound — see Technical Risks below, this is closer to a
  genuine gap than a simple ambiguity.

#### Edge Cases

- **A response that is technically successful but arrives slower than the
  bounded time**: the spec's own edge case treats this identically to an
  outright failure from the tenant's integration-pattern perspective — this
  feature's server-side enforcement must actually _cut off_ a
  slow-but-would-have-succeeded request at the bound, not just document that
  tenants should treat slow responses as failures on their own. If the server
  itself doesn't enforce the cutoff, a "successful but slow" response could
  still arrive after the tenant's own client has already given up and moved on —
  wasted work, not a correctness bug, but worth naming.
- **A partial outage where one surface (handoff-intake) works but the other
  (real-time chat) doesn't, or vice versa**: the spec explicitly treats these as
  fully independent failure modes — this feature's two touch points (002's
  timeout, 003's disconnect handling) must genuinely be independent
  implementations with no shared failure state, or a partial-outage scenario
  could incorrectly couple the two surfaces' behavior.
- **Both parties disconnecting simultaneously (not explicitly covered)**: the
  spec covers one party disconnecting while the other stays connected, but
  doesn't address what happens if both drop at once (e.g., a broader network
  event affecting both) — presumably each side simply doesn't receive a
  `party:disconnected` notification (no one is there to receive it), and the
  session remains `active` until either side reconnects or the abandonment sweep
  (003) eventually catches the resulting inactivity — this is a reasonable
  inferred behavior, but not explicitly stated by the spec, worth confirming
  rather than assuming silently.

#### Technical Risks

- **Real-time transport's default heartbeat timing is likely far longer than "a
  few seconds"**: common WebSocket/Socket.IO-style transports default their
  ping-interval/ping-timeout values to tens of seconds, not a handful — relying
  on "the transport's built-in heartbeat" without also explicitly tuning those
  interval/timeout values down risks silently failing SC-002's "within a few
  seconds" bound. This is the most concrete, easy-to-miss technical gap in this
  feature: the spec's own research treats "use the built-in heartbeat" as
  sufficient, but doesn't address that the _default_ configuration of that
  heartbeat may not meet the stated success criterion at all — this needs an
  explicit, tuned value, not just "the default is already there."
- **Enforcing a request timeout without also cancelling the underlying
  downstream work risks a resource leak under sustained degradation**: if the
  server responds `503` at the bound but the original database query (or
  whatever caused the slowness) keeps running in the background, repeated
  timeouts during a real outage could pile up abandoned in-flight work rather
  than actually shedding load — the opposite of what a fail-safe mechanism
  should do under sustained stress. This should be an explicit design
  consideration, not an assumed side effect of "just add a timeout wrapper."
- **In-memory connection-state tracking inherits the same horizontal-scaling
  limitation already flagged for 003's real-time transport**: a per-process,
  in-memory `sessionId -> { userConnected, advisorConnected }` map (as this
  feature's own data model describes) is correct at v1's single-instance scale
  but would not stay correct if `apps/api` is ever run as multiple instances
  without additional coordination — this is consistent with (not a new instance
  of) the scaling caveat already surfaced in 003's own analysis, worth carrying
  forward rather than treating as a fresh risk unique to this feature.
- **This feature modifies existing 002/003 files directly, unlike 004's
  narrowly-additive touch points**: because the timeout wrapper and
  connection-state/disconnect logic are woven directly into 002's
  request-handling pipeline and 003's `ChatGateway` connection lifecycle (rather
  than being called out to from a small number of clearly-bounded call sites),
  there is more surface area for this feature's changes to unintentionally alter
  002's/003's existing, already-specified behavior (e.g., accidentally changing
  response timing on the healthy path, or interfering with the existing
  `message:send` live-state-check logic). This warrants explicit regression
  verification against 002's and 003's own acceptance criteria, not just this
  feature's own.

#### Acceptance Criteria Coverage

| AC#                                                                                         | Description                                                                              | Addressable? | Gaps/Notes                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1-1                                                                                       | Unreachable handoff-intake → request fails within bounded time                           | Yes          | Requires 002 to exist first; server-side enforcement, not documentation alone                                                                                                                                                            |
| US1-2                                                                                       | Slow-but-reachable handoff-intake → completes or fails within same bound                 | Yes          | Requires the timeout to genuinely cut off a slow-but-would-succeed request, not just document intent                                                                                                                                     |
| US1-3                                                                                       | Tenant's own core flow continues despite handoff failure                                 | Partial      | This is a requirement on the _tenant's own integration_, not something Crossfade's code can directly verify — addressable only via documentation/contract guidance (FR-002/FR-005), not a testable server-side behavior                  |
| US2-1                                                                                       | Real-time connection drop → affected... other party sees visible disconnected indication | Yes          | Depends on heartbeat timing actually being tuned to "a few seconds" — see Technical Risks                                                                                                                                                |
| US2-2                                                                                       | Reconnect before session timeout → indication clears, conversation continues             | Yes          | Requires `party:reconnected` wired correctly and confirmation the session itself was never affected (`status` unchanged)                                                                                                                 |
| US2-3                                                                                       | No message lost silently during an outage without at least one side being informed       | Yes          | Follows from `party:disconnected` notification design; depends on 003's own message-send live-state-check (already specified) continuing to reject sends against a session whose party is gone, without silently dropping them unnoticed |
| US3-1                                                                                       | Post-outage handoff request succeeds with same config/credentials                        | Yes          | Directly follows from the "add nothing stateful" recovery design — no new logic to build, only to _not_ build something that would break this                                                                                            |
| US3-2                                                                                       | No tenant-side action required after recovery                                            | Yes          | Same as above — verified by absence of any new outage-tracking state, not by new code                                                                                                                                                    |
| Edge: slow-but-eventually-successful response treated as failure by tenant                  | Non-fatal to tenant flow, live chat not offered                                          | Partial      | This is again a tenant-integration-pattern requirement, only indirectly enforceable by Crossfade documenting and structurally supporting (via the hard server-side cutoff) the exact bound tenants are told to rely on                   |
| Edge: one party disconnects, other party's client independently detects/shows its own state | Each party's client is independent                                                       | Yes          | Directly follows from per-connection heartbeat detection scoped to each socket individually                                                                                                                                              |
| Edge: partial outage (one surface down, other up)                                           | Each surface's failure mode is fully independent                                         | Yes          | Requires the two touch points (002's timeout, 003's disconnect handling) to share no failure state or coupling — an explicit implementation discipline, not automatic                                                                    |
