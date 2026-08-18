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
