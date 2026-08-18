# Implementation Plan: Availability Fail-safe

**Branch**: `005-availability-fail-safe` | **Date**: 2026-08-18 | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from
`/docs/specs/005-availability-fail-safe/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its
definition describes the execution workflow.

## Summary

Cross-cutting hardening of 002's handoff-intake endpoint and 003's real-time
chat connection: bound the handoff-intake request/response time so a tenant
integration never hangs (FR-001/FR-002/FR-005), detect and surface dropped
real-time connections to the affected party (FR-003), and guarantee that
recovery after an outage requires no tenant-side action (FR-004). No new module
or persisted entity — this plan modifies request-handling configuration in
`handoffs` (002) and adds heartbeat/disconnect handling to `chat.gateway.ts`
(003).

## Technical Context

**Language/Version**: TypeScript, Node.js ≥24.19 (per repo `engines`)

**Primary Dependencies**: NestJS 11 (Express platform) request-timeout
configuration; Socket.IO's built-in ping/pong heartbeat (already part of 003's
`@nestjs/websockets`/`socket.io` dependency — no new package)

**Storage**: N/A — no schema changes; this feature only affects
request/connection handling, not persisted data

**Testing**: Vitest (via Vite+ `vp test`), plus e2e tests simulating a
slow/unreachable handoff-intake backend and a forcibly-dropped WebSocket
connection

**Target Platform**: Linux server (`apps/api`)

**Project Type**: web-service (NestJS backend in `apps/api`) — cross-cutting
behavior over existing 002/003 endpoints, not a new service surface

**Performance Goals**: SC-001 requires the handoff-intake endpoint to always
respond (success or failure) within the documented bound; SC-002 requires a
visible disconnect indication within a few seconds of a real-time drop

**Constraints**: The bounded timeout must be enforced server-side (FR-001) — a
tenant setting its own client-side timeout is necessary but not sufficient,
since a hung server-side request still ties up resources and gives tenants no
documented number to rely on (FR-005); disconnect detection must work even when
the drop is silent (e.g. network partition, not a clean close) — relies on
heartbeat, not just the `close` event

**Scale/Scope**: Same v1 scale as 001-004 (single tenant, single advisor pool) —
no load-balancing or multi-instance timeout-coordination concerns yet

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
└── src/
    ├── handoffs/                        # from 002 — modified
    │   └── handoffs.controller.ts       # request timeout enforced (FR-001)
    ├── chat/                             # from 003 — modified
    │   ├── chat.gateway.ts              # heartbeat + disconnect event handling (FR-003)
    │   └── connection-state.service.ts  # new: tracks/broadcasts connected/disconnected per party
    └── common/
        └── timeout.interceptor.ts        # new: shared bounded-response-time interceptor (FR-001, reusable beyond handoffs)

apps/api/test/
└── availability/
    ├── handoff-timeout.e2e-spec.ts
    └── chat-disconnect.e2e-spec.ts
```

**Structure Decision**: No new domain module — this feature modifies 002's
`handoffs` and 003's `chat` modules directly, plus adds one small shared
`common/timeout.interceptor.ts` NestJS interceptor so the bounded -response-time
behavior (FR-001) isn't duplicated per-endpoint if a future feature needs the
same guarantee. Consistent with the spec's own framing: this is a constraint on
existing surfaces, not a new user flow.

## Complexity Tracking

No constitution gates are defined yet (see Constitution Check), so no violations
require justification.
