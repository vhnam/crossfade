# Implementation Plan: Handoff Intake

**Branch**: `002-handoff-intake` | **Date**: 2026-08-18 | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from `/docs/specs/002-handoff-intake/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its
definition describes the execution workflow.

## Summary

Add a tenant-facing endpoint that accepts a handoff request (tenant reference
ID, summary, optional deep link, optional structured context), stores the
structured context opaquely, and creates a `Session` in `waiting` state — or
returns the existing session if a non-ended one already exists for that
reference ID. Builds directly on 001's tenant authentication (resolved
`tenantId` from the bearer key) and its NestJS + PostgreSQL/Prisma stack; no new
technology choices are required.

## Technical Context

**Language/Version**: TypeScript, Node.js ≥24.19 (per repo `engines`)

**Primary Dependencies**: NestJS 11 (Express platform), Prisma (ORM/migrations)
— both established in 001

**Storage**: PostgreSQL via Prisma, same database/instance as 001's `Tenant`
table

**Testing**: Vitest (via Vite+ `vp test`), per repo toolchain

**Target Platform**: Linux server (`apps/api`)

**Project Type**: web-service (NestJS backend in `apps/api`, part of existing
pnpm workspace)

**Performance Goals**: No new goals beyond standard API responsiveness; SC-001
requires the session identifier to be returned within the same request/response
cycle (no async/queued creation)

**Constraints**: Structured context stored opaquely — no schema validation, no
interpretation, no size-based rejection by default (FR-002); must reuse 001's
tenant-authentication guard rather than introducing a second auth mechanism

**Scale/Scope**: Single new endpoint + one new table (`Session`, seeded by this
feature; further columns/states added by 003/004)

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
│   └── schema.prisma        # add Session model (extends 001's Tenant)
└── src/
    ├── tenants/              # from 001 — reused, not modified
    │   └── tenant-auth.guard.ts
    └── handoffs/              # new module for this feature
        ├── handoffs.module.ts
        ├── handoffs.controller.ts
        ├── handoffs.service.ts
        ├── dto/
        │   └── create-handoff-request.dto.ts
        └── handoffs.controller.spec.ts

apps/api/test/
└── handoffs/
    └── handoff-intake.e2e-spec.ts
```

**Structure Decision**: Single NestJS service (`apps/api`), consistent with 001.
This feature adds a `handoffs` module alongside 001's `tenants` module, reusing
its `tenant-auth.guard.ts` for authentication rather than duplicating auth
logic. No frontend (`apps/web`) work in scope — the handoff request is
tenant-to-Crossfade, not user-facing UI.

## Complexity Tracking

No constitution gates are defined yet (see Constitution Check), so no violations
require justification.
