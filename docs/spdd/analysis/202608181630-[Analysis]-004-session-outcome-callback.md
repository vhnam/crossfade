# SPDD Analysis: Session Outcome & Callback

## Original Business Requirement

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

## Domain Concept Identification

#### Existing Concepts (from codebase)

- None **in code**. `apps/api` remains the unmodified NestJS skeleton — no
  `tenants`, `handoffs`, or `chat` module exists, no Prisma schema exists. All
  four features (001–004) so far exist only as REASONS-Canvas prompts
  (`docs/spdd/prompt/202608181415-...001-...md` through `...003-...md`), not as
  working code.
- **Tenant** (001, conceptual): the source of the `webhookUrl`/`webhookSecret`
  this feature delivers to and signs with — this feature reads that row fresh at
  delivery time rather than caching it, per FR-009.
- **Session** (002/003, conceptual): the entity whose `status` transitioning to
  `ended`/`abandoned` (003) is this feature's entire trigger condition. This
  feature does not modify `Session`'s own schema, but its correctness depends
  entirely on 003's terminal-transition guarantee (exactly one terminal
  transition per session) — a dependency on _behavior_, not just shape.
- **Message** (003, conceptual): composed, read-only, into this feature's
  session-history view (transcript) — not owned or written by this feature.
- **Advisor** (003, conceptual): the actor who supplies the outcome/note at
  explicit end time; this feature does not extend or modify the `Advisor` entity
  itself.

#### New Concepts Required

- **Outcome**: the terminal, one-time verdict on a concluded session — a
  fixed-vocabulary status plus an optional note, existing in exactly a 1:1
  relationship with a concluded `Session`. Its defining property is that it must
  be created _exactly once_ per session, regardless of which of two different
  triggers (explicit advisor end, or 003's automated sweep) causes the session
  to conclude.
- **Webhook Delivery Attempt**: the record of one try at notifying the tenant —
  distinct from `Outcome` itself so that delivery _reliability_ (retries,
  failures, eventual success or exhaustion) is tracked independently of the
  _fact_ that a session concluded. This separation is what lets US4 (history
  review) stay unaffected by webhook delivery trouble.
- **Signed Webhook Delivery**: a cross-cutting mechanism (not a stored entity) —
  the act of computing a cryptographic signature over the outbound payload using
  the tenant's _current_ secret and attaching it as a verifiable header, giving
  the tenant a way to trust the call's origin.
- **Retry/Backoff Policy**: a cross-cutting, time-driven mechanism (not a stored
  entity, though its state lives on `WebhookDeliveryAttempt`) — governs when a
  failed delivery is retried and when retrying stops. This is the feature's
  second background/scheduled process (after 003's abandonment sweep),
  continuing that precedent rather than introducing a new kind of
  infrastructure.
- **Session History (composed view)**: not a new entity — a read that joins
  existing `Session` + `Message` (003) with this feature's own `Outcome`, scoped
  by tenant. Its only new-ness is that it's the first read this deep across
  three features' data, and the first data made available specifically _because_
  a session has concluded (unavailable before that point, per the contract).

#### Key Business Rules

- Exactly one `Outcome` exists per session, no matter which of two independent
  triggers (advisor end, abandonment sweep) causes the session to conclude, and
  no matter how close together those triggers might race — governs `Outcome`
  creation (FR-007, SC-006), and is the single hardest correctness requirement
  in this feature.
- A session concluding as `abandoned` gets its outcome set automatically to
  `abandoned`, with no note (no advisor was present at that transition); a
  session concluding as `ended` requires the advisor to have explicitly chosen
  `resolved` or `not_resolved` at the moment of ending — the outcome
  vocabulary's cardinality is coupled to _how_ the session concluded, not chosen
  independently of it — governs the relationship between `Session.status` and
  `Outcome.status` (FR-008).
- Webhook payloads are always signed with the tenant's secret _as it is at
  delivery time_, not as it was when the session began — governs
  `Signed Webhook Delivery`, and is a direct, explicit continuation of 001's
  credential-rotation guarantee into this feature's own concern (FR-009).
- A failed webhook delivery is retried with increasing backoff up to a bounded
  limit, and giving up on live delivery never deletes or hides the underlying
  `Outcome` record — governs the relationship between `Webhook Delivery Attempt`
  and `Outcome` (FR-003, FR-005): delivery reliability and record retrievability
  are two independent guarantees, not one.
- The advisor's note, if present, is optional, bounded in length, and — once
  attached — appears both in the stored record and in the outbound webhook
  payload verbatim (never summarized or altered) — governs `Outcome.note`
  (FR-004).
- Session history (context, transcript, outcome) becomes retrievable only once a
  session has concluded, and only to the owning tenant's own advisor/operator —
  governs the composed history view's availability window and its isolation
  scope (FR-005), extending 001's isolation invariant into a new, cross-entity
  read for the first time.

## Strategic Approach

#### Solution Direction

- Add a fourth and terminal domain module, `outcomes`, alongside 001's
  `tenants`, 002's `handoffs`, and 003's `chat`. This feature does not introduce
  a new top-level trigger of its own — it exists entirely as a reaction to 003's
  `Session` reaching a terminal state, so its core shape is "listen for a
  conclusion, record exactly one outcome, deliver exactly one notification
  sequence, expose exactly one composed read."
- Data flow has two independent branches from the same trigger: (1)
  synchronous-ish outcome recording at the moment of conclusion (fast, in the
  same request for explicit-end; part of the sweep's own transaction for
  abandonment), and (2) asynchronous, retried webhook delivery (decoupled from
  the conclusion moment itself, since a slow/unreachable tenant endpoint must
  never block or fail the session's own conclusion).
- This feature reuses every concurrency and scheduling pattern already
  established by 002/003 rather than inventing new ones: the "database is the
  single source of truth for a race" pattern (002's duplicate-handoff
  prevention, 003's atomic pickup) extends naturally to "exactly one outcome per
  session," and 003's in-process scheduled-sweep pattern extends naturally to
  "retry due webhook deliveries." Consistency with prior features' precedents is
  itself a design goal here, not just a convenience.

#### Key Design Decisions

- **How to guarantee exactly one `Outcome` per session under two independent,
  possibly-racing triggers** (advisor's explicit end vs. 003's abandonment
  sweep): an application-level "only one code path is allowed to create
  outcomes" rule vs. a database-level uniqueness guarantee with both paths
  attempting the write and the loser silently no-opping. → Recommend the
  database-level approach (unique constraint on `sessionId`, both triggers
  attempt an insert, the losing attempt observes the conflict and proceeds
  without erroring its caller) — this is the same reasoning already validated
  twice in this codebase's own design history (002, 003): a DB constraint is
  atomic regardless of which process or request thread gets there first, while
  any application-level "only path X may do this" rule is only as reliable as
  the discipline of never adding a second path later, which this feature's own
  two-trigger requirement immediately violates.
- **Where the coupling between 003 (session conclusion) and this feature
  (outcome recording) actually lives**: both of this feature's own supporting
  documents (`plan.md`, `research.md`) describe 003 as "reused, not modified"
  while simultaneously requiring that _both_ of 003's terminal-transition code
  paths (explicit end, abandonment sweep) now also create an `Outcome` row. →
  This is a real design decision this analysis surfaces rather than resolves:
  either 003's end-session and sweep logic must be extended in place to also
  write the `Outcome` (meaning 003's files ARE touched by this feature,
  contradicting the "not modified" framing), or 003 must be given a narrow
  extension point (e.g., an internal event emitted on terminal transition) that
  this feature listens to without 003 needing to know `outcomes` exists.
  Recommend the event/hook approach — it preserves 003's module boundary (003
  emits "a session concluded," it doesn't need to know who's listening or why),
  and avoids a circular-feeling dependency where the "terminal, nothing depends
  on me" feature (004) is nonetheless reached into by 003's own core transition
  logic.
- **Webhook signature scheme**: symmetric HMAC (tenant already holds a shared
  secret from 001) vs. asymmetric signing (would require a whole new
  key-distribution concept). → Recommend HMAC-SHA256 over the raw payload — 001
  already established the tenant/Crossfade relationship as one where the tenant
  holds a shared secret (`webhookSecret`), so symmetric signing is the natural
  continuation of a trust model 001 already committed to, not a new one.
- **Retry mechanism**: synchronous delivery attempt inline with outcome
  recording (simplest, but blocks/couples the two independent guarantees) vs. a
  decoupled, scheduled retry sweep (consistent with 003's own scheduler
  precedent) vs. a third-party delivery service/queue. → Recommend the
  scheduled-sweep approach, for the same restart-safety and "don't introduce
  Redis/BullMQ at v1's volume" reasoning 003 already used for its own
  abandonment sweep — and critically, decoupling delivery from recording means a
  slow or hostile tenant endpoint can never affect whether the session's own
  conclusion (and outcome recording) succeeds.
- **Note length handling**: silent truncation vs. explicit rejection with a
  stated limit. → Recommend explicit rejection (a clear `400` on over-length
  input) — silently losing part of an advisor's note without telling them is
  worse than an immediate, honest validation error; this also keeps
  `Outcome.note` a faithful, complete record rather than a
  possibly-silently-clipped one, which matters for US4's "trace what the
  automation didn't know" use case.

#### Alternatives Considered

- **Application-level mutex/lock to serialize outcome creation per session**:
  rejected — doesn't hold across multiple API instances, the same reasoning
  already used to reject this approach in 002 and 003; introducing it here for
  the first time would be an inconsistent one-off.
- **Merging the abandonment-sweep and explicit-end code paths into a single
  function 004 calls into directly, to guarantee exactly-once by construction
  rather than by DB constraint**: rejected — this would require 004 to own or
  heavily reach into 003's state-transition logic, coupling the two modules far
  more tightly than a shared unique-constraint contract (or an emitted event)
  does; the DB constraint achieves the same guarantee without that coupling
  cost.
- **Synchronous webhook delivery inline with the end-session/sweep request**:
  rejected — a slow or unreachable tenant endpoint would then directly threaten
  the reliability of session conclusion itself (the one thing this feature must
  never put at risk), and cannot satisfy FR-003's retry requirement without
  still needing a background component anyway.
- **A third-party webhook-delivery service (e.g., a managed queue/relay)**:
  rejected as unjustified infrastructure at v1's single-tenant delivery volume —
  revisit only if delivery reliability or volume requirements grow beyond what
  an in-process scheduled sweep can handle.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **The "003 reused, not modified" framing conflicts with this feature's own
  exactly-once requirement**: as surfaced in Strategic Approach above, FR-007's
  guarantee genuinely requires _something_ in 003's own terminal-transition code
  paths (explicit end, abandonment sweep) to trigger this feature's
  outcome-recording logic — whether via direct extension or an emitted event,
  003 cannot remain entirely untouched/unaware and still produce this guarantee.
  This needs an explicit decision (extension point vs. direct modification)
  before Operations can specify concrete tasks, since it determines whether
  003's own already-authored REASONS-Canvas prompt needs a follow-up amendment.
- **What "the operator" means for US4/session-history access is left implicit**:
  the spec frames US4 around "the Crossfade operator (currently also the sole
  advisor)," and the contract (`session-history-api.md`) exposes history via the
  _advisor_-authenticated surface (`GET /advisor/sessions/{sessionId}/history`),
  not any separate operator-authenticated surface (001's `OperatorAuthGuard`).
  This is likely intentional (v1 has no separate operator UI, per 001's own
  Assumptions) but should be confirmed as a deliberate choice — reusing advisor
  auth for what the spec calls "operator" access — rather than an accidental
  conflation of two access levels that 001 otherwise keeps distinct.
- **Outcome vocabulary's long-term meaning is explicitly unsettled**: the spec's
  own Assumptions flag that `resolved`/`not_resolved` isn't yet validated
  against a shared cross-org definition of "resolved" — this feature can and
  should implement the fixed three-value vocabulary as specified, but should not
  treat the _labels themselves_ as stable business meaning, only as a stable
  _shape_ (a data migration, not a new feature, is explicitly anticipated if the
  definition changes).

#### Edge Cases

- **Concurrent explicit-end and abandonment-sweep triggers for the same
  session** (spec's own explicit edge case): resolved by the
  DB-unique-constraint design decision above — the highest-stakes correctness
  requirement in this feature, and structurally the same shape as 002's and
  003's own race-prevention designs.
- **No webhook registered/reachable at all, not just transiently down**: retries
  proceed and eventually exhaust per the bounded backoff policy; the `Outcome`
  record's own retrievability (US4) is completely unaffected — this must be
  implemented as genuinely independent record-keeping, not "best effort unless
  delivery also worked."
- **Webhook secret rotated between session start and conclusion**: resolved by
  reading `Tenant.webhookSecret` fresh at delivery time (not cached from
  session/handoff creation) — this is a direct continuation of 001's rotation
  guarantee and must not regress if `Tenant` data is cached anywhere in the
  request/delivery path for performance reasons later.
- **Advisor note exceeding the length limit**: rejected outright (not truncated)
  per the recommended design decision — needs a concrete limit value decided at
  REASONS-Canvas time (research.md suggests 500 characters as a reasonable
  default, not yet a binding requirement from the spec itself).

#### Technical Risks

- **Four-deep unimplemented dependency chain**: this feature depends on 001
  (`Tenant`/webhook config), 002 (`Session` creation), and 003 (`Session`
  terminal transitions, `Message`, `Advisor`) — none of which exist as code yet,
  only as REASONS-Canvas prompts. This feature's Operations cannot be executed
  against the current working tree in isolation; it needs 001 → 002 → 003
  generated first (or all four generated together in dependency order). This
  risk compounds with each feature in the chain and is now the largest single
  risk to this feature's buildability.
- **The exactly-once outcome guarantee depends on getting the
  DB-conflict-handling code right in _two separate call sites_** (the extended
  end-session path and 003's sweep): unlike 002/003's single-call-site races,
  this feature's race involves two genuinely different code paths (one
  request-triggered, one scheduler-triggered) both needing to attempt the same
  conflict-safe insert and both needing to treat "someone else already won" as
  success, not failure — a subtly larger surface for a mistake than a
  single-call-site compare-and-swap.
- **Retry sweep and abandonment sweep are two independent scheduled jobs with
  different queries and windows** (003's every-1-minute inactivity sweep vs.
  this feature's own delivery-retry sweep) — both are legitimate, but their
  coexistence should be verified not to interfere (e.g., ensure the retry
  sweep's query is scoped to `WebhookDeliveryAttempt`, not accidentally touching
  `Session` rows the abandonment sweep also targets) and both should follow the
  same "single aggregate query per run, not N+1" discipline 003 established.
- **Signature verification is only as trustworthy as the raw-body handling on
  both sides**: HMAC-SHA256 over "the raw request body" requires that Crossfade
  signs the _exact bytes_ it sends and that no serialization difference (e.g.,
  key ordering, whitespace) creates a mismatch — this is a common,
  easy-to-get-subtly-wrong implementation detail (e.g., signing a JS object then
  re-serializing it differently than what's actually transmitted) worth flagging
  explicitly before implementation, even though the spec/contract don't call it
  out.

#### Acceptance Criteria Coverage

| AC#                                               | Description                                                                      | Addressable? | Gaps/Notes                                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1-1                                             | Session reaches `ended` → webhook called with referenceId + outcome              | Yes          | Blocked on 001–003 actually being implemented; also depends on resolving the 003-coupling ambiguity above                                         |
| US1-2                                             | Session reaches `abandoned` → webhook called the same way                        | Yes          | Requires the abandonment sweep (003) to also trigger outcome recording — same coupling dependency as US1-1                                        |
| US1-3                                             | Webhook call is signed, tenant can verify origin                                 | Yes          | Straightforward HMAC-SHA256 given `Tenant.webhookSecret` exists (001)                                                                             |
| US2-1                                             | Delivery failure → retried, not dropped                                          | Yes          | Requires the scheduled retry sweep; must not block session conclusion itself                                                                      |
| US2-2                                             | Repeated failures → increasing backoff interval                                  | Yes          | Backoff schedule is an implementation constant, not spec-mandated exact values                                                                    |
| US2-3                                             | Recovered endpoint → exactly one successful notification                         | Yes          | Depends on `WebhookDeliveryAttempt.status` transitioning correctly to `succeeded` and the sweep not double-firing on an already-succeeded attempt |
| US3-1                                             | Advisor provides optional note at end → stored with outcome                      | Yes          | Straightforward once the end-session endpoint is extended with outcome/note fields                                                                |
| US3-2                                             | Session ends without note → still concludes normally                             | Yes          | Directly follows from `note` being nullable/optional at the schema level                                                                          |
| US3-3                                             | Note attached → included in webhook payload                                      | Yes          | Direct payload-building requirement, no gap                                                                                                       |
| US4-1                                             | Concluded session's full record (context, transcript, outcome, note) retrievable | Yes          | Composed read across `Session`+`Message`(003)+`Outcome`(004) — no gap once all three exist                                                        |
| US4-2                                             | Retrieval scoped per-tenant, never cross-tenant                                  | Yes          | Direct extension of 001's isolation invariant to a new composed read                                                                              |
| Edge: no webhook registered/reachable at all      | Retries proceed, outcome still stored                                            | Yes          | Requires outcome recording and delivery to be genuinely independent, not coupled success paths                                                    |
| Edge: concurrent end + sweep triggers             | Exactly one outcome, one webhook sequence                                        | Yes          | Central risk — same DB-constraint discipline as US1-1/US1-2, highest-stakes requirement in the feature                                            |
| Edge: over-length note                            | Rejected (or truncated) with a clear limit                                       | Partial      | Spec allows either rejection or truncation; recommended direction (reject) is a REASONS-Canvas-level decision, not yet spec-mandated              |
| Edge: webhook secret rotated mid-session-lifetime | Signed with _current_ secret at delivery time                                    | Yes          | Requires reading `Tenant.webhookSecret` fresh at delivery, never cached from session start                                                        |
