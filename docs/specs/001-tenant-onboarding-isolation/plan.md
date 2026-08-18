# Implementation Plan: Tenant Onboarding & Isolation

**Branch**: `001-tenant-onboarding-isolation` | **Date**: 2026-08-18 | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from
`/docs/specs/001-tenant-onboarding-isolation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its
definition describes the execution workflow.

## Summary

Give the Crossfade operator a way to manually register a tenant (name, unique
slug, webhook URL+secret) and issue it an API credential; every subsequent
tenant-facing request authenticates via that credential alone, resolving to
exactly one tenant with no cross-tenant visibility. Operator can
suspend/reactivate a tenant and rotate its credential without losing history.
Built as a NestJS module (`tenants`) backed by PostgreSQL via Prisma,
establishing the auth guard and isolation pattern every later Crossfade feature
(002+) will reuse.

## Technical Context

**Language/Version**: TypeScript, Node.js ≥24.19 (per repo `engines`)

**Primary Dependencies**: NestJS 11 (Express platform), Prisma (ORM/migrations)
— see `research.md`

**Storage**: PostgreSQL via Prisma

**Testing**: Vitest (via Vite+ `vp test`), per repo toolchain

**Target Platform**: Linux server (`apps/api`)

**Project Type**: web-service (NestJS backend in `apps/api`, part of existing
pnpm workspace)

**Performance Goals**: SC-001 requires end-to-end tenant registration in under 5
minutes (operator workflow, not a throughput target); no other explicit
performance goals for v1's single-tenant scale

**Constraints**: Credential must never be stored or logged in plaintext after
issuance (only a hash persists); tenant identity must never be accepted from
request body/params, only from the resolved credential (FR-006); isolation must
hold even when another tenant's identifier is guessed (FR-008)

**Scale/Scope**: v1 ships with exactly one tenant (Windwise); schema and
isolation invariant must still hold for N tenants since it's the foundation for
every later feature

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
│   └── schema.prisma        # Tenant model + status enum (see data-model.md)
└── src/
    └── tenants/
        ├── tenants.module.ts
        ├── tenant-auth.guard.ts       # resolves Authorization: Bearer key -> tenantId
        ├── operator/
        │   ├── operator-tenants.controller.ts   # POST /operator/tenants, suspend, reactivate, rotate-key
        │   └── operator-tenants.service.ts
        ├── dto/
        │   └── create-tenant.dto.ts
        └── tenants.controller.spec.ts

apps/api/test/
└── tenants/
    └── tenant-onboarding-isolation.e2e-spec.ts
```

**Structure Decision**: Single NestJS service (`apps/api`), no separate operator
UI (`apps/web` untouched — spec's Assumptions leave the operator's own interface
open, and internal authenticated endpoints are the minimum that unblocks every
dependent feature). `tenants` module is the first domain module in the service
and establishes the pattern (module + guard + operator-only controller) that
002+ builds next to.

## Complexity Tracking

No constitution gates are defined yet (see Constitution Check), so no violations
require justification.
