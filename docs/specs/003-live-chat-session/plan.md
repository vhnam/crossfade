# Implementation Plan: Live 1:1 Chat Session

**Branch**: `003-live-chat-session` | **Date**: 2026-08-18 | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from
`/docs/specs/003-live-chat-session/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its
definition describes the execution workflow.

## Summary

Let an advisor pick up a `waiting` session (created by 002), exchange real-time
messages with the user until the conversation ends, and have inactive sessions
auto-transition to `abandoned`. Extends 002's `Session` with an assigned advisor
and a `Message` sub-entity; real-time delivery uses WebSockets via NestJS's
`@nestjs/websockets` gateway, reusing 001's tenant-auth guard for the
tenant/user side and a parallel advisor-auth mechanism for the advisor side
(advisor identity is new in this feature — no prior feature registers advisors).

## Technical Context

**Language/Version**: TypeScript, Node.js ≥24.19 (per repo `engines`)

**Primary Dependencies**: NestJS 11 (Express platform) +
`@nestjs/websockets`/`socket.io` for real-time delivery, Prisma (ORM/migrations)
— see `research.md`

**Storage**: PostgreSQL via Prisma, extends 002's `Session` table, adds
`Message` and `Advisor` tables

**Testing**: Vitest (via Vite+ `vp test`), plus a Socket.IO client in e2e tests
for real-time delivery assertions

**Target Platform**: Linux server (`apps/api`)

**Project Type**: web-service (NestJS backend in `apps/api`), plus a background
scheduled check for the abandonment sweep

**Performance Goals**: SC-001 (pickup-to-first-message under 10s is a
UX/workflow target, not a system latency target); SC-002 requires message
delivery "perceived as instantaneous" — target <500ms server-side relay latency
under normal load

**Constraints**: Exactly one advisor per session enforced under concurrent
pickup (FR-003/SC-003); messages must never be accepted outside `active` state
(FR-005/SC-004); inactivity sweep must not require a live client to trigger the
`abandoned` transition (FR-009 says "MUST transition automatically")

**Scale/Scope**: v1 scope is one advisor per tenant (FR-011) — no multi-advisor
concurrency to design around yet, but the real-time transport and data model
should not preclude it later

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
│   └── schema.prisma            # add Advisor, Message models; extend Session (advisorId, status values)
└── src/
    ├── tenants/                  # from 001 — reused, not modified
    ├── handoffs/                 # from 002 — reused, not modified
    └── chat/                      # new module for this feature
        ├── chat.module.ts
        ├── advisors/
        │   ├── advisor-auth.guard.ts     # resolves advisor credential -> tenantId + advisorId
        │   ├── advisor-sessions.controller.ts   # GET waiting sessions, POST pickup, POST end
        │   └── advisor-sessions.service.ts
        ├── chat.gateway.ts        # WebSocket gateway: message send/receive, join session room
        ├── chat.service.ts        # shared message-send/validation logic used by gateway + REST
        ├── abandonment.scheduler.ts   # periodic sweep: active sessions past inactivity window -> abandoned
        └── dto/
            ├── send-message.dto.ts
            └── pickup-session.dto.ts

apps/api/test/
└── chat/
    ├── pickup-and-messaging.e2e-spec.ts
    └── abandonment.e2e-spec.ts
```

**Structure Decision**: Single NestJS service (`apps/api`), new `chat` module
alongside 001's `tenants` and 002's `handoffs`. Real-time delivery is a
WebSocket gateway inside this module rather than a separate service — v1 scale
(one advisor per tenant, FR-011) doesn't justify splitting out a dedicated
real-time service. The abandonment sweep is an in-process scheduled job (NestJS
`@nestjs/schedule`), not a separate worker, for the same reason.

## Complexity Tracking

No constitution gates are defined yet (see Constitution Check), so no violations
require justification.
