# SPDD Analysis: Live 1:1 Chat Session

## Original Business Requirement

# Feature Specification: Live 1:1 Chat Session

**Feature Branch**: `003-live-chat-session`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Live 1:1 Chat Session — an advisor picks up a
session that a tenant handed off (from feature 002, which must be in 'waiting'
state) and exchanges real-time messages with the user until the session ends. v1
is deliberately the simplest version: one advisor, one user, no queueing or
routing across multiple advisors — each tenant has exactly one dedicated advisor
pool. Depended on by feature 004 (outcome reporting), which needs a session to
have ended."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Advisor picks up a waiting session (Priority: P1)

As an advisor, I see sessions waiting for my tenant and can pick one up, which
connects me to that user in real time.

**Why this priority**: Nothing else in this feature can happen until a session
moves from `waiting` to being owned by an advisor. This is the entry point that
turns a queued handoff into a live conversation.

**Independent Test**: Can be fully tested by creating a `waiting` session (via
feature 002) and having an advisor pick it up, then verifying the session is now
`active` and assigned to that advisor — independent of whether any messages are
ever exchanged.

**Acceptance Scenarios**:

1. **Given** a session in `waiting` state for the advisor's tenant, **When** the
   advisor picks it up, **Then** the session moves to `active` and is assigned
   to that advisor.
2. **Given** an advisor viewing waiting sessions, **When** they look at the
   list, **Then** they see only sessions belonging to their own tenant, never
   another tenant's.
3. **Given** a session already picked up by an advisor (now `active`), **When**
   a second advisor attempts to pick up the same session, **Then** the attempt
   is rejected — a session has exactly one assigned advisor.

---

### User Story 2 - User and advisor exchange messages (Priority: P1)

As a user who was handed off, I can send and receive messages with the advisor
in real time, seeing the summary/context the source app provided so I don't have
to re-explain myself.

**Why this priority**: This is the core value of the feature — the actual live
conversation. Without it, picking up a session accomplishes nothing.

**Independent Test**: Can be fully tested by having an advisor pick up a
session, then exchanging messages from both the user and advisor sides and
verifying each message is delivered to the other party in real time, and that
the handoff summary/context is visible to the advisor from the start of the
conversation.

**Acceptance Scenarios**:

1. **Given** an `active` session, **When** the user sends a message, **Then**
   the advisor receives it in real time.
2. **Given** an `active` session, **When** the advisor sends a message, **Then**
   the user receives it in real time.
3. **Given** an advisor opening a newly picked-up session, **When** they view
   the conversation, **Then** they see the summary and structured context that
   the tenant provided at handoff (feature 002), without the user needing to
   repeat it.
4. **Given** a session that is not `active` (e.g., `waiting`, `ended`, or
   `abandoned`), **When** either party attempts to send a message, **Then** the
   message is rejected.

---

### User Story 3 - Advisor identity is disclosed (Priority: P2)

As a user, I can see who I'm talking to (for Windwise: disclosed plainly as the
person who built the recommendations) — not an anonymized or misleadingly
generic identity.

**Why this priority**: Important for trust and transparency, but the
conversation itself (US2) can be demonstrated without this being fully wired up
— this refines what the user sees, not whether the exchange works.

**Independent Test**: Can be fully tested by picking up a session as a named
advisor and verifying the user-facing chat view displays that advisor's
configured disclosed identity, not a placeholder or anonymized label.

**Acceptance Scenarios**:

1. **Given** an `active` session assigned to an advisor, **When** the user views
   the chat, **Then** they see that advisor's disclosed identity as configured
   for the tenant.
2. **Given** an advisor's disclosed identity is configured, **When** the session
   is displayed to the user, **Then** no generic or anonymized placeholder
   (e.g., "Support Agent") is shown in its place.

---

### User Story 4 - Advisor ends the session (Priority: P2)

As an advisor, I can mark a session as ended when the conversation concludes,
which stops further messages and triggers outcome reporting (see 004).

**Why this priority**: Necessary for a clean, correct lifecycle and to unblock
004, but a session that never formally ends can still be manually inspected —
this is about closing the loop cleanly, not blocking the core conversation from
happening.

**Independent Test**: Can be fully tested by having an advisor end an active
session and verifying its state becomes `ended`, and that further message
attempts from either party are rejected.

**Acceptance Scenarios**:

1. **Given** an `active` session, **When** the advisor ends it, **Then** the
   session moves to `ended`.
2. **Given** an `ended` session, **When** either party attempts to send a
   message, **Then** the message is rejected.
3. **Given** a session transitions to `ended`, **When** the transition
   completes, **Then** it becomes eligible for outcome reporting (feature 004) —
   this feature only needs to guarantee the state change occurs, not what 004
   does with it.

---

### User Story 5 - User leaves without resolution (Priority: P3)

As a user, if I disconnect or stop responding without the advisor marking the
session ended, the session should eventually be recognized as abandoned rather
than staying open indefinitely.

**Why this priority**: An important cleanup guarantee for correctness and
advisor workload sanity, but it's a background/eventual behavior that doesn't
block the core pickup-and-chat flow from being demonstrated and valued on its
own.

**Independent Test**: Can be fully tested by picking up a session, then having
neither party send any activity for the defined inactivity window, and verifying
the session automatically transitions to `abandoned` without any explicit action
from the advisor.

**Acceptance Scenarios**:

1. **Given** an `active` session with no messages from either party for the
   defined inactivity period, **When** that period elapses, **Then** the session
   automatically transitions to `abandoned`.
2. **Given** a session has transitioned to `abandoned`, **When** either party
   attempts to send a message, **Then** the message is rejected, the same as an
   `ended` session.
3. **Given** an `active` session with recent activity from either party,
   **When** the inactivity period is checked, **Then** the session remains
   `active` (activity resets the inactivity clock).

---

### Edge Cases

- What happens when an advisor tries to pick up a session that is not in
  `waiting` state (e.g., already `active`, `ended`, or `abandoned`)? The pickup
  attempt MUST be rejected.
- What happens when an advisor tries to end a session that is not `active`? The
  end attempt MUST be rejected (nothing to end).
- What happens if the assigned advisor disconnects but the user keeps messaging?
  The session remains `active` until either the advisor returns, explicitly ends
  it, or the inactivity window elapses — v1 has no reassignment to a different
  advisor (FR-7).
- What happens to messages sent in the same moment a session transitions out of
  `active` (a race between "end" and "send message")? The session state at the
  moment the message is processed determines the outcome — if the transition to
  `ended`/`abandoned` completes first, the message is rejected; no message is
  silently delivered into a closed session.
- What happens if two advisors attempt to pick up the same waiting session at
  the same instant? Exactly one MUST succeed; the other MUST be rejected, with
  no session ending up assigned to two advisors.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: An advisor MUST only ever see sessions belonging to their own
  tenant (enforced by feature 001's isolation guarantee).
- **FR-002**: Picking up a session MUST assign that advisor to it and move it
  from `waiting` to `active`; this MUST only succeed for sessions currently in
  `waiting` state.
- **FR-003**: Exactly one advisor MUST ever be assigned to a session at a time;
  concurrent pickup attempts on the same session MUST result in exactly one
  success.
- **FR-004**: Messages MUST be delivered in real time between the assigned
  advisor and the user for the duration of an `active` session.
- **FR-005**: Messages MUST be rejected when the session is not in `active`
  state.
- **FR-006**: The advisor's view of a picked-up session MUST include the summary
  and structured context provided at handoff (feature 002).
- **FR-007**: The user-facing chat MUST display the assigned advisor's disclosed
  identity as configured for that tenant — never an anonymized or generic
  placeholder.
- **FR-008**: The advisor MUST be able to explicitly end an `active` session,
  moving it to `ended`; ending a non-`active` session MUST be rejected.
- **FR-009**: A session with no message activity for a defined inactivity period
  MUST transition automatically to `abandoned`.
- **FR-010**: Activity (a message from either party) MUST reset the inactivity
  clock for a session.
- **FR-011**: v1 MUST NOT implement queueing, multi-advisor routing, or
  reassignment of a session to a different advisor — exactly one advisor per
  tenant is the assumed shape for this feature.

### Key Entities _(include if feature involves data)_

- **Session** (extended from feature 002): Gains an assigned advisor reference
  and transitions through `waiting → active → ended` or
  `waiting → active → abandoned`. This feature owns those transitions; 002 only
  ever creates it in `waiting`.
- **Message**: A single real-time exchange within a session — sender (user or
  advisor), content, timestamp. Only creatable while the parent session is
  `active`.
- **Advisor**: The person assigned to a session, scoped to exactly one tenant,
  with a disclosed identity shown to users. Advisor registration/management
  beyond this scoping is not defined by this feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An advisor can pick up a waiting session and send the first
  message to the user in under 10 seconds from opening it.
- **SC-002**: 100% of messages sent while a session is `active` are delivered to
  the other party in real time (perceived as instantaneous, not requiring a
  manual refresh).
- **SC-003**: 0% of sessions ever have more than one advisor assigned at the
  same time, including under concurrent pickup attempts.
- **SC-004**: 0% of messages are accepted into a session that is not `active`
  (rejected consistently for `waiting`, `ended`, and `abandoned`).
- **SC-005**: 100% of sessions left inactive beyond the defined window are
  transitioned to `abandoned` without requiring any manual advisor action.
- **SC-006**: 100% of users in an active session can identify who they are
  speaking with by name, with zero instances of an anonymized or generic
  placeholder shown.

## Assumptions

- Exactly one advisor pool per tenant in v1 — no queueing, routing, or
  reassignment logic; this may change once the main requirements doc's
  multi-advisor considerations are revisited, but is out of scope here.
- The inactivity window that defines "abandoned" (FR-009) is not yet tuned
  against real usage; a reasonable default of 30 minutes of no message activity
  from either party is assumed for v1, adjustable later without a spec change
  once real session data exists.
- Advisor "online/offline" availability is a simple toggle, not a scheduling
  system; full availability management is out of scope for this feature.
- Real-time delivery is assumed to mean sub-second perceived latency under
  normal network conditions, consistent with standard chat-app expectations — no
  stricter latency target is specified.
- This feature depends on 002 for session creation and 001 for tenant isolation;
  it does not redefine either.
- What happens after a session ends (reporting the outcome back to the tenant)
  is entirely owned by feature 004 and out of scope here.

## Domain Concept Identification

#### Existing Concepts (from codebase)

- None **in code**. `apps/api` remains the unmodified NestJS skeleton — no
  `tenants`, `handoffs`, or `chat` module exists, no Prisma schema exists, and
  `package.json` has no `@nestjs/websockets`, `socket.io`, or `@nestjs/schedule`
  dependency yet. This feature's own plan/research assume 001's
  `Tenant`/`TenantAuthGuard`/`PrismaService` and 002's `Session` model as
  build-on points; none of the three are present in the working tree — only
  their REASONS-Canvas prompts
  (`docs/spdd/prompt/202608181415-[Feat]-001-...md`,
  `docs/spdd/prompt/202608181530-[Feat]-002-...md`).
- **Tenant** and **Session** (conceptually, from features 001/002's designs):
  `Session` in particular is the entity this feature directly extends (adds
  `advisorId`, adds `active`/`ended`/`abandoned` status values) rather than
  creates fresh — its shape is fully specified by 002's data model, just not yet
  built.

#### New Concepts Required

- **Advisor**: the first authenticated _person_-level identity in Crossfade (as
  opposed to `Tenant`, which authenticates a source application). Scoped to
  exactly one tenant, carries a disclosed display name shown to end users, and
  is the actor that picks up and handles sessions. Nothing in 001 or 002 models
  a human actor — this is a genuinely new kind of concept for the system, not
  just a new table.
- **Message**: a single real-time exchange within a `Session`, attributable to
  either the user or an `Advisor`. Only meaningful while its parent `Session` is
  `active`; its timestamps are also the input to a derived concept (session
  activity) rather than existing purely for display.
- **Live Session Room / Real-time Channel**: a conceptual (not persisted)
  concept — the live, bidirectional channel that both the user and the assigned
  advisor join for the duration of an `active` session, over which `Message`s
  and lifecycle events (`session:snapshot`, `session:ended`) flow. This is the
  feature's first real-time concept, layered on top of what has so far been a
  purely request/response system.
- **Session Activity / Inactivity Window**: a derived, non-stored concept — "how
  long since anything happened in this session" — used to decide when an
  `active` session becomes `abandoned` without either party taking explicit
  action. Computed, not persisted, and drives a new kind of concept for the
  system: a background process that changes state without being triggered by an
  inbound request.
- **User Session Identity**: a lightweight, session-scoped identity for the _end
  user_ on the other side of the chat — distinct from both `Tenant` and
  `Advisor`. Not a full account system; conceptually "whatever lets the specific
  browser/client on the other end of a specific session connect to exactly that
  session's real-time channel and nothing else." This concept is referenced by
  this feature's own WebSocket contract but its origin (where/how it's minted)
  is not actually defined by feature 002 — see Risk & Gap Analysis.

#### Key Business Rules

- An advisor may only ever act on (see, pick up, message into, end) sessions
  belonging to their own tenant — governs every `Advisor`-initiated operation on
  `Session`/`Message` (FR-001), and is this feature's own test of whether 001's
  isolation invariant generalizes past the `Tenant` table itself.
- A session has at most one assigned advisor at any moment, and pickup is only
  valid from `waiting` — governs the `Session` → `Advisor` assignment
  relationship and its concurrency behavior (FR-002, FR-003).
- A `Message` may only be created while its parent `Session.status = active` —
  governs `Message` creation, and this check must reflect the session's state
  _at the moment of processing_, not at the moment the client believed the
  session was active (FR-005, race-condition edge case).
- The advisor's disclosed identity, not a generic placeholder, is always what
  the user sees — governs how `Advisor` is surfaced through `Session`/`Message`
  display (FR-007); this is a trust guarantee as much as a display rule.
- Only the specific advisor assigned to a session may end it; an active session
  with no activity for the defined window ends itself (as `abandoned`) without
  anyone acting — governs the terminal transitions of `Session` (FR-008,
  FR-009), and both are irreversible (no un-ending, no un-abandoning, no
  reassignment).
- Message activity from either party resets the inactivity clock — governs the
  relationship between `Message` and the derived `Session Activity` concept
  (FR-010).
- v1 has no concept of a queue, multiple advisors racing for the same pool, or
  reassignment after pickup — governs the boundary of what this feature does
  _not_ need to model (FR-011); a design that quietly introduces
  queueing/routing logic overshoots this feature's actual scope.

## Strategic Approach

#### Solution Direction

- Add a third domain module, `chat`, alongside the (not-yet-built) `tenants`
  (001) and `handoffs` (002) modules, extending 002's `Session` entity in place
  (new `advisorId` field, new status values) rather than creating a parallel
  entity — `Session` remains the single root record threading through 002, this
  feature, and eventually 004.
- Two access surfaces, mirroring the tenant/operator split established in 001: a
  REST surface for advisor session-management actions (list/pickup/end —
  discrete, request/response operations with clear success/failure) and a
  real-time surface (a WebSocket gateway) for the actual message exchange, which
  is inherently a persistent, bidirectional concern that REST doesn't fit
  naturally.
- A new, distinct authentication identity (`Advisor`) is introduced rather than
  overloading either 001's tenant credential or inventing a full user-account
  system — this keeps "the tenant's backend calling Crossfade" (001) cleanly
  separate from "a specific human advisor acting" (this feature), preserving the
  isolation and auth patterns already established rather than special-casing
  them.
- A background, request-independent process (the abandonment sweep) is
  introduced for the first time — a departure from every prior feature's purely
  request-triggered behavior — because FR-009's "automatically" requirement
  cannot be satisfied by anything that depends on a live client connection.

#### Key Design Decisions

- **Real-time transport shape**: WebSocket (persistent, bidirectional) vs.
  Server-Sent Events (one-directional, needs a companion REST path) vs. polling.
  → Recommend a WebSocket-based real-time channel — it's the only option that
  natively satisfies "real-time, bidirectional, for the duration of an active
  session" (FR-004) without stitching together two separate mechanisms; polling
  cannot plausibly meet the "perceived as instantaneous" bar (SC-002).
- **Concurrent pickup safety**: application-level check-then-write vs. an
  atomic, database-guaranteed conditional transition. → Recommend the same
  DB-level-constraint philosophy 002 already established for duplicate-handoff
  prevention (research.md's "the database is the single source of truth for
  races" pattern) — a session's pickup must be a single atomic operation
  conditioned on its current state, not a separate read followed by a write, to
  genuinely guarantee "exactly one success" under concurrent attempts (FR-003,
  SC-003) rather than merely making it unlikely to fail.
- **How abandonment is detected**: a background sweep over `active` sessions vs.
  per-session in-memory timers vs. an externally-maintained "last activity"
  column updated on every message. → Recommend a periodic background sweep that
  derives each session's last-activity moment from its own message history at
  check time, rather than a separately-maintained column — simplest option that
  still satisfies "automatic, no client dependency" (FR-009) without adding a
  second write on every message send or introducing per-instance in-memory state
  that wouldn't survive a restart or a multi-instance deployment. Trade-off:
  introduces the feature's first genuinely new _kind_ of infrastructure (a
  scheduled/background process) rather than purely request-driven code — this is
  a meaningful precedent for whatever comes after this feature, not a cost-free
  choice.
- **Advisor authentication shape**: reuse 001's tenant credential mechanism
  (conflating "the tenant's backend" with "a specific advisor") vs. a distinct,
  parallel advisor-credential mechanism. → Recommend a distinct advisor identity
  and credential, since FR-001 (advisor sees only their tenant's sessions) and
  FR-007 (a _specific_ advisor's disclosed identity) both require identifying an
  individual advisor, not just the calling tenant — reusing the tenant
  credential cannot express "which advisor" at all.
- **Scope discipline on FR-011**: the natural temptation when building "one
  advisor per tenant" is to build a lightweight queue/assignment structure
  "since we're already touching this" in anticipation of multi-advisor support.
  → Recommend resisting this: the data model and real-time transport should not
  structurally _preclude_ multi-advisor support later, but should not build any
  of its machinery now — over-building here creates untested code paths this
  feature's own acceptance criteria don't exercise.

#### Alternatives Considered

- **Server-Sent Events for delivery, REST POST for sending**: rejected — splits
  one conceptually bidirectional real-time concern into two different transport
  mechanisms for no benefit at this feature's scale, adding complexity rather
  than removing it.
- **A denormalized `lastActivityAt` column on `Session`, updated on every
  message send**: rejected for v1 — an extra write on every single message
  purely to avoid a join at sweep time is optimizing for a scale this feature
  doesn't yet have; worth revisiting only if the sweep query itself is later
  measured as a bottleneck.
- **Full user account/login system for the end-user side of the chat**: rejected
  — v1's user identity need is narrowly "let this one browser/client join this
  one session's real-time channel," not a general identity system; building more
  than that here would be scope creep well beyond FR-004–FR-010.
- **Reassignment of a session to a different advisor on disconnect**: rejected —
  FR-011 explicitly excludes this; the spec's own edge case says a disconnected
  advisor simply leaves the session `active` until it's either resumed,
  explicitly ended, or swept to `abandoned`.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **User session identity/token issuance is referenced but never actually
  defined by any feature so far**: this feature's own WebSocket contract
  describes the user side connecting with "a session-scoped token issued when
  the session was created (mechanism owned by 002/this feature's implementation
  phase)" — but feature 002's actual specification and its already-generated
  REASONS-Canvas prompt only return a `sessionId` to the _tenant_, with no
  user-facing token of any kind. This is a genuine gap between what 003 assumes
  exists and what 002 actually produces — it must be resolved (either
  retrofitting 002 to mint a user token at session creation, or having this
  feature define and own that issuance itself) before the WebSocket auth path
  can be designed concretely.
- **Who actually delivers the user-facing token/session-connection details to
  the end user's browser is unstated**: even once a token exists, no feature so
  far describes the path by which the tenant's own frontend (which is the thing
  actually rendering the chat UI to the end user, per the "Windwise" framing)
  obtains and forwards that token to the browser. This is adjacent to, but
  broader than, the token-issuance gap above — it's a hand-off-of-a-hand-off
  that isn't specified anywhere in scope 001–003.
- **"Exactly one advisor pool per tenant"** is stated as a v1 assumption, but
  nothing in the spec defines how _many_ `Advisor` records a tenant may
  register, or whether "pool" here just means "however many advisors a tenant
  has, all can pick up any of that tenant's sessions" (implied by the pickup
  contract, which doesn't scope by anything beyond tenant) vs. "exactly one
  advisor total." The plan/data-model's own wording ("each tenant has exactly
  one dedicated advisor pool") is ambiguous between "one pool (of possibly
  several advisors)" and "one advisor." Needs an explicit decision before
  `Advisor` provisioning (out of this feature's own scope, but its cardinality
  assumption isn't).

#### Edge Cases

- **Concurrent pickup on the same session** (spec's own explicit edge case):
  resolved by the atomic-conditional-update design decision above — the
  highest-stakes correctness requirement in this feature, structurally identical
  in shape to 002's duplicate-handoff race.
- **Message sent in the same instant a session transitions out of `active`**:
  spec explicitly requires the check to reflect state _at the moment of
  processing_, not a client's cached belief — this means the WebSocket gateway's
  message handler must re-check live DB state on every send, not just at
  connection time, which is a subtly different (and stricter) requirement than
  "check once at connect."
- **Advisor disconnects but user keeps messaging**: session stays `active`
  indefinitely (until end, return, or the inactivity sweep) — this means the
  abandonment sweep is the _only_ backstop against an advisor silently
  vanishing, which raises the stakes of getting the sweep's correctness right,
  beyond just its "nice cleanup" framing.
- **Horizontal scaling of the real-time transport**: nothing in this feature's
  research addresses what happens if `apps/api` ever runs more than one instance
  — a typical Socket.IO deployment needs a shared adapter (e.g., a Redis-backed
  adapter) for rooms/broadcasts to work correctly across instances; a
  single-instance in-memory Socket.IO server works today but silently breaks
  message delivery the moment a second instance is introduced, with no explicit
  error, just missed messages between instances. This is not called out anywhere
  in `research.md` despite it being the single technical assumption most likely
  to silently regress on a routine infrastructure change.

#### Technical Risks

- **Three-deep unimplemented dependency chain**: this feature depends on 002's
  `Session` model and 001's `Tenant`/auth/Prisma infrastructure, and _none_ of
  the three exist as code yet — only as REASONS-Canvas prompts. This feature's
  Operations cannot be executed against the current working tree in isolation;
  it needs 001 and 002 generated first (or all three generated together in
  dependency order). This is the largest single risk to buildability, larger
  than any individual technical decision within this feature.
- **Compare-and-swap correctness for pickup is easy to get subtly wrong**: the
  "exactly one advisor" guarantee depends entirely on the pickup operation being
  a single atomic conditional write (e.g., an update guarded by
  `WHERE status = 'waiting'`, checking affected-row count) — if implemented as a
  read followed by a conditional write in application code instead, the race
  reappears exactly as 002's research already diagnosed for duplicate handoffs.
  This must be treated as a hard implementation constraint, not a suggestion.
- **Socket.IO horizontal-scaling gap** (see Edge Cases above): a real risk that
  the codebase, as currently planned, will pass every test at v1's
  single-instance scale and then silently degrade the moment the API is scaled
  to multiple instances — worth flagging explicitly as a known,
  currently-unaddressed limitation rather than letting it surface later as an
  unexplained production bug.
- **Two independent race-sensitive checks compound**: the pickup race (FR-003)
  and the message-during-transition race (FR-005 edge case) are both real-time
  correctness requirements layered on top of a still-new (for this codebase)
  WebSocket transport — the combination (a session ending via the REST `end`
  endpoint while a message is in flight over the WebSocket gateway) means the
  two access surfaces (REST and WS) must agree on the _same_ source of truth
  (live DB state) rather than each maintaining its own view of session status.

#### Acceptance Criteria Coverage

| AC#                                             | Description                                              | Addressable? | Gaps/Notes                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| US1-1                                           | Waiting session picked up → active, assigned to advisor  | Yes          | Blocked on 001+002 actually being implemented (see Technical Risks)                                             |
| US1-2                                           | Advisor sees only own-tenant waiting sessions            | Yes          | Direct extension of 001's isolation invariant to a new query surface                                            |
| US1-3                                           | Second pickup attempt on already-active session rejected | Yes          | Depends on atomic conditional-update correctness (see Technical Risks)                                          |
| US2-1                                           | User message → advisor receives in real time             | Yes          | Depends on WebSocket room/broadcast design; also depends on the user-token gap being resolved first             |
| US2-2                                           | Advisor message → user receives in real time             | Yes          | Same as above                                                                                                   |
| US2-3                                           | Advisor sees handoff summary/context on session open     | Yes          | Directly available from 002's `Session` fields once that model exists                                           |
| US2-4                                           | Message rejected when session not active                 | Yes          | Requires live-DB-state check at send time, not connect time (see Edge Cases)                                    |
| US3-1                                           | User sees advisor's disclosed identity                   | Yes          | Straightforward once `Advisor.displayName` exists and is included in `session:snapshot`                         |
| US3-2                                           | No generic/anonymized placeholder ever shown             | Yes          | Enforced by `displayName` being a required, non-empty field with no fallback value                              |
| US4-1                                           | Advisor ends active session → ended                      | Yes          | Requires the same conditional-update discipline as pickup, guarded on `status = active`                         |
| US4-2                                           | Message rejected after session ended                     | Yes          | Same live-state-check mechanism as US2-4                                                                        |
| US4-3                                           | Ended session becomes eligible for 004                   | Yes          | This feature only needs to guarantee the state change occurs — no coupling to 004's actual behavior required    |
| US5-1                                           | Inactive active session auto-transitions to abandoned    | Yes          | Depends entirely on the background sweep's correctness and the derived-activity computation being accurate      |
| US5-2                                           | Message rejected on abandoned session, same as ended     | Yes          | Same live-state-check mechanism, `abandoned` treated identically to `ended` for this purpose                    |
| US5-3                                           | Recent activity keeps session active (resets clock)      | Yes          | Directly follows from deriving activity from `Message.createdAt` at sweep time rather than a stale stored value |
| Edge: pickup of non-waiting session rejected    | Rejected                                                 | Yes          | Same guard as US1-3                                                                                             |
| Edge: end of non-active session rejected        | Rejected                                                 | Yes          | Same guard as US4-1                                                                                             |
| Edge: advisor disconnects, user keeps messaging | Session stays active until end/return/sweep              | Yes          | No reassignment logic needed (FR-011) — sweep is the only backstop, raising its correctness stakes              |
| Edge: message/transition race                   | Session state at processing time wins                    | Yes          | Requires the message handler to check live state per-send, not per-connection                                   |
| Edge: concurrent pickup by two advisors         | Exactly one succeeds                                     | Yes          | Same atomic conditional-update requirement as US1-3/FR-003                                                      |
