# Feature Specification: Session Outcome & Callback

**Feature Branch**: `004-session-outcome-callback`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Session Outcome & Callback — when a session
concludes (reaches `ended` or `abandoned`, per feature 003), notify the tenant
via a signed, retried webhook containing the tenant's own reference ID, a
neutral fixed-vocabulary outcome, and any advisor note. Advisor can attach a
short free-text note when ending a session. Full session history (transcript,
context, outcome) stays retrievable after the session ends, scoped to that
session's tenant. This is the boundary back to the tenant — nothing inside
Crossfade depends on this feature. Makes the declining-escalation-rate success
metric measurable."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tenant is notified when a session ends (Priority: P1)

As a tenant, I receive a webhook call when a session I handed off reaches
`ended` or `abandoned`, containing my own reference ID and a neutral outcome, so
I can decide what to do with that information in my own system.

**Why this priority**: This is the entire point of the feature — closing the
loop back to the tenant. Without it, a session concluding inside Crossfade is
invisible to the tenant that started it.

**Independent Test**: Can be fully tested by taking a session through to `ended`
(via feature 003) and confirming the tenant's registered webhook receives
exactly one call containing the reference ID and outcome status — independent of
whether an advisor note was attached.

**Acceptance Scenarios**:

1. **Given** a session reaches `ended`, **When** the transition completes,
   **Then** Crossfade calls the tenant's registered webhook with the tenant's
   own reference ID and the outcome status.
2. **Given** a session reaches `abandoned` (per 003's inactivity sweep),
   **When** the transition completes, **Then** Crossfade calls the tenant's
   registered webhook the same way as for `ended`.
3. **Given** a webhook call is delivered, **When** the tenant inspects it,
   **Then** it is signed such that the tenant can verify it genuinely came from
   Crossfade.

---

### User Story 2 - Webhook delivery survives transient failure (Priority: P1)

As a tenant, if my webhook endpoint is briefly unreachable when a session
concludes, I still eventually receive the outcome notification rather than
silently losing it.

**Why this priority**: Equal priority to US1 — a notification mechanism that
silently drops events on the first failure isn't meaningfully different from
having no notification at all, and undermines the measurability goal
(BR-9/BR-10) this feature exists for.

**Independent Test**: Can be fully tested by pointing a tenant's webhook at an
endpoint that fails on the first N attempts and succeeds after, then confirming
Crossfade retries with backoff until delivery succeeds (or a bounded retry limit
is reached), rather than giving up after one attempt.

**Acceptance Scenarios**:

1. **Given** a session concludes and the tenant's webhook endpoint returns an
   error or times out, **When** the initial delivery attempt fails, **Then**
   Crossfade retries the delivery rather than dropping the event.
2. **Given** repeated delivery failures, **When** retries are attempted,
   **Then** the interval between attempts increases (backoff) rather than
   retrying at a constant, potentially overwhelming rate.
3. **Given** a webhook endpoint that recovers after some failures, **When** a
   subsequent retry reaches it, **Then** the outcome notification is delivered
   exactly once from the tenant's perspective for that session's conclusion.

---

### User Story 3 - Advisor records a brief outcome note (Priority: P2)

As an advisor, when I end a session, I can leave a short free-text note on what
was resolved or discovered, so there's something more than a status flag if
anyone (including future-me) needs to look back at it.

**Why this priority**: Adds valuable context but the core loop (US1/US2)
functions and is independently testable without a note ever being attached —
this enriches the record rather than gating it.

**Independent Test**: Can be fully tested by ending a session with a note
attached and confirming that note appears both in the stored session record and
in the webhook payload delivered to the tenant.

**Acceptance Scenarios**:

1. **Given** an advisor is ending a session, **When** they optionally provide a
   short free-text note, **Then** the note is stored alongside the session's
   outcome.
2. **Given** a session ends without a note, **When** the outcome is recorded,
   **Then** the session still concludes normally — a note is never required.
3. **Given** a note was attached, **When** the webhook is delivered to the
   tenant, **Then** the note is included in the payload.

---

### User Story 4 - A session's full history can be reviewed (Priority: P3)

As the Crossfade operator (currently also the sole advisor), I can look back at
a past session — its context, transcript, and outcome — to trace what a source
app's automation didn't know and confirm whether that gap has since been
addressed.

**Why this priority**: Valuable for the operator's own learning loop, but it's a
read-only retrieval capability that doesn't block the notification flow
(US1/US2) from delivering value on its own.

**Independent Test**: Can be fully tested by retrieving a concluded session's
full record (handoff context, message transcript, outcome, and note) after it
has ended, and confirming it matches what actually occurred, scoped correctly to
the owning tenant.

**Acceptance Scenarios**:

1. **Given** a session has concluded, **When** the operator retrieves its
   record, **Then** the handoff context, full message transcript, final outcome,
   and any advisor note are all present.
2. **Given** two tenants each have concluded sessions, **When** a retrieval is
   scoped to one tenant, **Then** only that tenant's sessions are returned,
   never another tenant's (per 001's isolation guarantee).

---

### Edge Cases

- What happens if a session's transition to `ended`/`abandoned` succeeds but no
  webhook is currently registered or reachable at all (not just transiently
  down)? Retries continue per US2's backoff policy up to its bounded limit; the
  outcome record itself is still stored regardless of delivery status (US4 is
  never blocked by webhook delivery failure).
- What happens if the same session somehow triggers two outcome computations
  (e.g. a race between an advisor ending it and the abandonment sweep firing at
  nearly the same moment)? Exactly one outcome MUST be recorded and exactly one
  webhook call MUST be made for that session's conclusion — this relies on 003's
  guarantee that a session has exactly one terminal transition.
- What happens to a note longer than the "short" expectation? MUST be truncated
  or rejected with a clear length limit rather than stored unbounded — exact
  limit is an implementation detail, not a business requirement here.
- What happens if the tenant's webhook signature secret is rotated (001, FR-012)
  between when a session starts and when it concludes? The webhook MUST be
  signed with the tenant's _current_ secret at delivery time, not whatever was
  active at session start.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: When a session transitions to `ended` or `abandoned`, Crossfade
  MUST call the tenant's registered webhook (per 001) with: the tenant's own
  reference ID for the interaction, the outcome status, and any advisor note (if
  present).
- **FR-002**: Webhook delivery MUST be cryptographically signed using the
  tenant's registered webhook secret, so the tenant can verify the call
  genuinely came from Crossfade.
- **FR-003**: If webhook delivery fails, Crossfade MUST retry with backoff
  rather than silently dropping the event, up to a bounded number of attempts.
- **FR-004**: An advisor MUST be able to attach a short free-text outcome note
  when ending a session; the note MUST be optional.
- **FR-005**: A session's transcript, context, and outcome MUST remain
  retrievable after the session concludes, scoped to that session's owning
  tenant only (per 001's isolation guarantee).
- **FR-006**: The outcome status MUST be selected from a small, fixed vocabulary
  — `resolved`, `not_resolved`, `abandoned` — never a free-form value, so it
  remains meaningful as a metric over time.
- **FR-007**: Exactly one outcome record and exactly one webhook delivery
  attempt sequence MUST result from a single session's conclusion, even under
  concurrent triggering conditions (e.g. simultaneous explicit-end and
  abandonment-sweep signals).
- **FR-008**: A session that concludes as `abandoned` MUST automatically receive
  the `abandoned` outcome value without requiring advisor input; a session that
  concludes as `ended` MUST have its outcome (`resolved` or `not_resolved`)
  selected by the advisor at end time.
- **FR-009**: Webhook payloads MUST be signed using the tenant's current webhook
  secret at delivery time, reflecting any credential rotation that occurred
  after the session began.

### Key Entities _(include if feature involves data)_

- **Outcome**: The conclusion of a session — fixed-vocabulary status (`resolved`
  / `not_resolved` / `abandoned`), optional advisor note, timestamp. One outcome
  per session, created at the same moment the session reaches a terminal state
  (003).
- **Webhook Delivery Attempt**: A record of one attempt to notify the tenant of
  an outcome — target URL, signed payload, response status/error, timestamp,
  retry count. Used to drive the backoff/retry policy (FR-003) and to
  distinguish delivery failure from outcome-record failure (US4 is unaffected by
  delivery status).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of sessions reaching `ended` or `abandoned` result in at
  least one webhook delivery attempt to the tenant's registered endpoint.
- **SC-002**: 100% of delivered webhook payloads carry a signature the tenant
  can verify as genuinely from Crossfade.
- **SC-003**: A webhook endpoint that fails transiently and recovers within the
  retry window still receives exactly one successful outcome notification per
  concluded session (zero missed, zero duplicate successful deliveries).
- **SC-004**: 100% of concluded sessions' transcript, context, and outcome
  remain retrievable by the operator at any time after conclusion, scoped
  correctly to the owning tenant.
- **SC-005**: 0% of outcome values recorded fall outside the fixed vocabulary
  (`resolved`, `not_resolved`, `abandoned`).
- **SC-006**: Every concluded session has exactly one outcome record — 0% of
  sessions ever produce zero or more than one.

## Assumptions

- Outcome vocabulary is fixed at `resolved` / `not_resolved` / `abandoned` for
  v1, per the spec source's own suggested example — this is a starting
  definition, not yet validated against a shared Crossfade/Windwise definition
  of "resolved" (an open question in the main requirements doc); the vocabulary
  itself may be revisited later without requiring a new feature, only a data
  migration.
- A structured (non-free-text) way for an advisor to flag "this is a gap in the
  source app's automation" is explicitly deferred — v1 has only the free-text
  note (FR-004); this matches the source doc's own deferral, since volume is low
  and the advisor is presently the same person who owns the source app.
- Retry backoff policy uses industry-standard exponential backoff with a bounded
  number of attempts (e.g. a handful of attempts over roughly a day) before
  giving up on live delivery — the outcome record itself is never lost even if
  delivery ultimately fails (FR-005 is independent of webhook delivery success).
- "Short" free-text note assumes a reasonable bounded length (e.g. a few hundred
  characters) sufficient for a brief summary, not a full transcript duplicate.
- This feature is the terminal boundary of the Crossfade-internal flow — nothing
  inside Crossfade depends on it; what the tenant does with the outcome is
  entirely out of scope.
