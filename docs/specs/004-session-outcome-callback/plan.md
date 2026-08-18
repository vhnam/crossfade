# Implementation Plan: Session Outcome & Callback

**Branch**: `004-session-outcome-callback` | **Date**: 2026-08-18 | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from
`/docs/specs/004-session-outcome-callback/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its
definition describes the execution workflow.

## Summary

When a 003 session reaches `ended` or `abandoned`, record a fixed-vocabulary
`Outcome` (with optional advisor note for `ended` sessions) and deliver a
signed, retried webhook to the tenant's registered endpoint (001) carrying the
tenant's own reference ID and outcome. Session transcript/context/ outcome stay
retrievable per-tenant after conclusion. This is the terminal feature in the
Crossfade chain — nothing downstream depends on it.

## Technical Context

**Language/Version**: TypeScript, Node.js ≥24.19 (per repo `engines`)

**Primary Dependencies**: NestJS 11 (Express platform), Prisma (ORM/migrations),
`@nestjs/schedule` (retry sweep, reusing 003's pattern), Node's built-in
`crypto` (HMAC signing) — no new framework-level dependency

**Storage**: PostgreSQL via Prisma, adds `Outcome` and `WebhookDeliveryAttempt`
tables, referencing 003's `Session`

**Testing**: Vitest (via Vite+ `vp test`), plus an HTTP mock/stub server in e2e
tests to assert webhook payload, signature, and retry behavior

**Target Platform**: Linux server (`apps/api`)

**Project Type**: web-service (NestJS backend in `apps/api`)

**Performance Goals**: SC-001 requires every concluded session to trigger at
least one delivery attempt; no throughput target beyond v1's
single-tenant-at-a-time scale (consistent with 001-003)

**Constraints**: Exactly one `Outcome` per session even under concurrent
terminal-transition triggers (FR-007/SC-006); webhook signed with the tenant's
_current_ secret at delivery time, not whatever was active at session start
(FR-009, edge case); outcome record is never lost even if webhook delivery
ultimately fails after all retries (FR-005 independent of delivery status)

**Scale/Scope**: v1 volume is low (single tenant, single advisor per 002/003) —
a bounded exponential-backoff retry (e.g. 5-6 attempts over roughly a day) is
more than sufficient; no dead-letter queue or delivery dashboard needed yet

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

`.specify/memory/constitution.md` is still the unfilled template (no ratified
principles) — no project-specific gates to evaluate. No violations to record.

## Project Structure

### Documentation (this feature)

```text
docs/specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   └── schema.prisma            # add Outcome, WebhookDeliveryAttempt models
└── src/
    ├── tenants/                  # from 001 — reused (webhook URL/secret lookup)
    ├── handoffs/                 # from 002 — reused, not modified
    ├── chat/                      # from 003 — extended, not modified: emits an
    │                                 internal event on Session -> ended/abandoned
    └── outcomes/                  # new module for this feature
        ├── outcomes.module.ts
        ├── outcomes.service.ts             # records Outcome on session conclusion
        ├── outcomes-webhook.service.ts     # builds/signs payload, delivers, retries
        ├── webhook-retry.scheduler.ts       # periodic sweep of due retry attempts
        ├── session-history.controller.ts   # GET concluded session (transcript+context+outcome)
        └── dto/
            └── end-session-with-outcome.dto.ts   # extends 003's end-session input with outcome+note

apps/api/test/
└── outcomes/
    ├── webhook-delivery.e2e-spec.ts
    └── session-history.e2e-spec.ts
```

**Structure Decision**: Single NestJS service (`apps/api`), new `outcomes`
module. 003's "end session" endpoint is extended (not duplicated) to accept the
outcome/note at the same call, since FR-008 requires an advisor-selected outcome
exactly at end time; the abandonment sweep (003) and this feature's outcome
recording both listen to the same "session concluded" transition to guarantee
FR-007's exactly-once behavior (see `research.md`) rather than each
independently racing to write an `Outcome` row.

## Complexity Tracking

No constitution gates are defined yet (see Constitution Check), so no violations
require justification.
