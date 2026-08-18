# Crossfade — Agent Workflow

This file is the shared operating contract for Cursor and Claude. Follow it for
specification, decomposition, and implementation work in this repository.

## Project Workflow

Crossfade uses a specification-first development workflow.

```text
Notion
  ↓
Spec Kit
  ↓
Open-SPDD
  ↓
Git / Implementation
  ↓
Notion
```

### Responsibility Model

| Tool / System   | Primary Responsibility                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| Notion          | Product knowledge, requirements, decisions, research, roadmap, execution status          |
| Spec Kit        | Specify and clarify product/technical requirements, then produce the implementation plan |
| Open-SPDD       | Decompose an approved plan into executable work items, dependencies, and tickets         |
| Claude / Cursor | Implement approved tickets, maintain code quality, tests, and repository conventions     |
| Git             | Source control and implementation history                                                |

Do not duplicate responsibilities between these systems.

### Artifact Locations

| Kind                    | Path                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| Constitution            | `.specify/memory/constitution.md`                                      |
| Feature specs and plans | `docs/specs/<work_item>/` (`spec.md`, `plan.md`, …)                    |
| Open-SPDD analysis      | `docs/spdd/analysis/<work_item>/`                                      |
| Open-SPDD prompts       | `docs/spdd/prompt/<work_item>/`                                        |
| Spec Kit skills         | `.claude/skills/speckit-*` (repo-owned; committed)                     |
| GitNexus skills         | `.claude/skills/gitnexus/` (repo-owned; committed)                     |
| Third-party skills      | `skills-lock.json` only; install locally, do not commit the skill tree |
| Open-SPDD commands      | `.claude/commands/spdd-*.md`                                           |
| Claude entry            | `CLAUDE.md` (pointer to this file; do not fork the workflow there)     |

Third-party skill sources in this repo:

- [mattpocock/skills](https://github.com/mattpocock/skills)
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- [nestjs-best-practices](https://github.com/kadajett/agent-nestjs-skills)

Record the Crossfade Notion hub, Agent Workflow, and Tasks URLs here when they
exist.

### Agent skills

- **Repo-owned** skills stay in git: Spec Kit (`.claude/skills/speckit-*`),
  GitNexus (`.claude/skills/gitnexus/`), and Open-SPDD commands
  (`.claude/commands/`). These are not listed in `skills-lock.json`.
- **Third-party** skills are recorded only in `skills-lock.json`. Do not commit
  their install trees. Reinstall with the Skills CLI (`npx skills`). Cursor
  copies under `.agents/` are gitignored; lockfile installs under
  `.claude/skills/<name>` must be gitignored too (today: every skill in
  `skills-lock.json`, including `mattpocock/skills`, `ui-ux-pro-max`, and
  `nestjs-best-practices`).
- When adding a skill to `skills-lock.json`, add a matching `.gitignore` path
  for that install. Do not ignore `.claude/skills/` wholesale.

Matt Pocock skills support grilling, TDD, diagnosis, design discipline, and
reviews. They do not replace Spec Kit or Open-SPDD. UI UX Pro Max supports UI
design, implementation, and review. It does not own product requirements.

---

## 1. Notion — Source of Truth

Use Notion for:

- Product requirements
- Domain knowledge
- Research
- Architecture decisions
- ADRs
- Roadmap
- Evaluation cases
- Project status
- Task / ticket tracking

Notion preserves **why the product behaves a certain way** and the decisions
behind the current implementation.

---

## 2. Spec Kit — Specify and Clarify

Typical flow (skills in `.claude/skills/`):

```text
/speckit-specify
/speckit-clarify
/speckit-plan
```

Spec Kit answers:

- What are we building?
- Why are we building it?
- What is in scope?
- What is out of scope?
- What behavior is expected?
- What constraints apply?
- What are the acceptance criteria?
- What technical architecture or implementation approach is required?

### Handoff Boundary

For work items handled by Open-SPDD, Spec Kit stops after `/speckit-plan`.

Do **not** run `/speckit-tasks` unless the user explicitly asks for it.

The handoff inputs are:

```text
spec.md
clarifications
plan.md
```

---

## 3. Open-SPDD — Decompose and Plan Execution

Open-SPDD owns decomposition of an approved specification and plan into
executable work.

Typical commands (in `.claude/commands/`):

```text
/spdd-analysis
/spdd-reasons-canvas
/spdd-generate
/spdd-prompt-update
/spdd-sync
```

It may:

- Create epics
- Create features
- Create implementation tasks
- Define dependencies
- Sequence work
- Map tasks to requirements and acceptance criteria
- Create or update tickets
- Produce REASONS Canvas prompt files under `docs/spdd/prompt/<work_item>/`

### Do Not Invent Product Requirements

Open-SPDD must not silently introduce:

- New product behavior
- New user-facing requirements
- New scope
- New architecture decisions
- New business rules

When a requirement is missing or ambiguous, mark it as:

```text
SPEC GAP / OPEN QUESTION
```

and request clarification rather than inventing the answer.

---

## 4. Handoff: Spec Kit → Open-SPDD

Expected flow:

```text
/speckit-specify
    ↓
/speckit-clarify
    ↓
/speckit-plan
    ↓
Human review / approval
    ↓
Open-SPDD (/spdd-analysis → /spdd-reasons-canvas → tickets/prompts)
    ↓
Epics / Features / Tasks / Dependencies
```

The approved specification and plan are the contract.

Every meaningful task should be traceable to:

```text
Requirement
  ↓
Acceptance Criteria
  ↓
Implementation Task
```

---

## 5. Open-SPDD → Notion Task Sync

After Open-SPDD has finished decomposing an approved specification into
executable work, review the generated task set before syncing it to Notion.

The workflow is:

```text
Spec Kit
  ↓
Open-SPDD
  ↓
Review / approve task set
  ↓
Sync tasks to Notion Tasks database
  ↓
Claude / Cursor implementation
  ↓
Update task status in Notion
```

### Responsibility Boundary

- **Open-SPDD** owns task decomposition.
- **Notion** owns task persistence and execution status.
- **Claude / Cursor** consume approved tasks and implement them.
- **Git** records implementation history.

Do not sync incomplete or unreviewed Open-SPDD output into the Notion task
database.

Do **not** treat `/speckit-tasks` as the default path into Notion. Spec Kit
stops after `/speckit-plan`; Open-SPDD produces the executable work that is then
mirrored to Notion.

Do **not** use Matt Pocock `/to-tickets` as a parallel default for Spec Kit work
items.

### Notion Task Fields

When the Crossfade Tasks database exists, map fields as follows:

| Contract field        | Notion property                                       |
| --------------------- | ----------------------------------------------------- |
| Task ID               | `Task ID`                                             |
| Title                 | `Name`                                                |
| Type                  | `Type` (`Epic` / `Feature` / `Task`)                  |
| Status                | `Status` (`Todo` / `In Progress` / `Review` / `Done`) |
| Priority              | `Priority` (`P0` / `P1` / `P2`)                       |
| Spec ID / work item   | `Spec ID` (canonical `<sequence>-<slug>`)             |
| Requirement reference | `Product Requirement` (relation)                      |
| Acceptance criteria   | `Acceptance criteria`                                 |
| Dependencies          | `Depends on` (relation to other Tasks)                |
| Milestone / Sprint    | `Milestone` (relation to Roadmap)                     |
| Git branch            | `Git branch`                                          |

Also available on the same database: `Area`, `Owner`.

The task should reference the canonical `work_item` (`Spec ID`) and Product
Requirement rather than copying the entire specification into the task record.

Keep the relationship explicit:

```text
Work Item
  ↓
Requirement
  ↓
Notion Task
  ↓
Git Branch / Implementation
```

When implementation is completed, update the corresponding Notion task status
rather than creating a duplicate task.

---

## 6. Work Item Naming and Cross-System Identity

Spec Kit, Open-SPDD, Notion, and Git use different naming conventions, but every
non-trivial work item should share one canonical identity. Claude and Cursor
must not invent a second project/feature identifier.

### Canonical Work Item ID

Use:

```text
<sequence>-<slug>
```

Examples:

```text
001-tenant-onboarding-isolation
002-handoff-intake
003-live-chat-session
004-session-outcome-callback
005-availability-fail-safe
```

The canonical `work_item` value is reused across specification, Open-SPDD, and
Notion. In this repo it is the Spec Kit directory name under `docs/specs/`.

When creating a new Spec Kit feature, prefer sequential numbering and
`--short-name`. Do **not** use timestamp prefixes as the work-item identity.

### Artifact Convention

Keep related artifacts grouped under the same work-item name:

```text
docs/specs/001-tenant-onboarding-isolation/
├── spec.md
├── plan.md
└── …

docs/spdd/analysis/001-tenant-onboarding-isolation/
└── analysis.md

docs/spdd/prompt/001-tenant-onboarding-isolation/
└── feat-api-tenant-onboarding-isolation.md
```

Open-SPDD may still use a tool-local filename (for example a REASONS Canvas
prompt name). That filename is **not** a second identity. Put the file under the
`work_item` directory and declare `work_item` in the artifact metadata.

Existing files that do not yet follow this layout should still name the same
`work_item` in metadata rather than introducing a new ID.

### Metadata

Prefer explicit metadata such as:

```yaml
work_item: 001-tenant-onboarding-isolation
sequence: 001
slug: tenant-onboarding-isolation
```

`work_item` is the canonical cross-system identifier.

### Git Branches Are Separate

Do not force Git branch names to match the work-item ID.

Example:

```text
Work item:
001-tenant-onboarding-isolation

Git branch:
feat/tenant-onboarding-isolation
```

The Git branch follows the repository's branch naming convention (see the next
section) while the work item remains the stable identity. Record the branch on
the Notion task (`Git branch`) so the link stays explicit.

### Notion References

Notion tasks should store the canonical work item in `Spec ID`:

```text
Spec ID: 001-tenant-onboarding-isolation
```

`Task ID` is allowed as the ticket-level identifier (for example `T012`). Do not
create a second independent _feature_ identifier for the same work item.

The relationship should remain:

```text
Work Item
   │
   ├── Spec Kit artifacts
   ├── Open-SPDD analysis / prompts
   ├── Notion tasks
   └── Git branch / PR
```

### Naming Rule

Do not allow each tool to independently generate an unrelated project/feature
identifier.

When creating a new non-trivial work item:

1. Establish the canonical `work_item`.
2. Use it in Spec Kit artifacts (`docs/specs/<work_item>/`).
3. Use it in Open-SPDD artifacts (`docs/spdd/.../<work_item>/`).
4. Reference it from Notion (`Spec ID`).
5. Use a separately formatted Git branch that still points back to the same work
   item.

---

## 7. Git Branch Naming

Spec identifiers and Git branch names are different concepts.

Example:

```text
Work item:
001-tenant-onboarding-isolation

Git branch:
feat/tenant-onboarding-isolation
```

Do not force Spec Kit identifiers to match Git branch names.

Use `work_item` to identify work items.

Use Git branch names according to repository conventions.

Preferred prefixes:

```text
feat/      New functionality
fix/       Bug fixes
chore/     Tooling, setup, maintenance
refactor/  Internal refactoring
docs/      Documentation
test/      Test-only work
```

Examples:

```text
feat/tenant-onboarding-isolation
feat/handoff-intake
feat/live-chat-session
fix/session-outcome-callback
chore/agent-workflow
```

### Commit messages

Claude and Cursor must not add `Co-authored-by`, `Co-authored By`, or similar
co-author trailers to commit messages.

The commit is authored by the human who requested it. Do not credit the agent in
the message body or trailer.

### Package versions (Changesets)

Workspace apps and shared packages use independent SemVer via
[Changesets](https://github.com/changesets/changesets). They are `private` and
consumed with `workspace:*`. Do not publish to npm. Do not run
`changeset publish`. Do not bump versions in pre-commit.

| Identity        | Tool                                                            |
| --------------- | --------------------------------------------------------------- |
| Work item       | Spec Kit / Notion `Spec ID` (`001-tenant-onboarding-isolation`) |
| Git branch      | `feat/` `fix/` `chore/` …                                       |
| Package version | Changesets (`@crossfade/ui@0.0.1`)                              |

Add a `.changeset/*.md` file when a package’s API or shipped behavior changes.
Skip changesets for docs, specs, formatting, and agent-workflow files.

Impact examples:

- `patch`: fix CSS in `@crossfade/ui` that does not add API; fix a crash in
  `@crossfade/api` with no contract change.
- `minor`: add Button/Input primitives to `@crossfade/ui`; add a new public
  NestJS module export in `@crossfade/api`.
- `major`: remove or rename a public export from `@crossfade/ui` or
  `@crossfade/api`. During `0.y.z`, major is reserved for an incompatible API
  change. Jumping to `1.0.0` is a product decision, not the default for every
  breaking change in initial development — follow SemVer `0.y.z` by bumping
  `minor` for subsequent development releases unless the changeset explicitly
  records `major`.

Multiple pending records for the same package: highest impact wins (`major` >
`minor` > `patch`).

A new workspace member MUST ship a `"version"` and `"private": true` in its
`package.json` at creation; Changesets does not invent the field.

To exclude a package from versioning, add its name to `.changeset/config.json`
`ignore` and document why in the PR. Currently `ignore` is empty.

```bash
vp run changeset
vp run changeset:version
```

`changeset version` is a release step: it consumes changeset files, updates each
listed `package.json`, and writes `CHANGELOG.md`. Conventional Commits still
describe the git history; they do not bump versions by themselves.

---

## 8. Claude and Cursor — Implementation Agents

Claude and Cursor operate primarily at the implementation layer.

Before coding:

1. Read the approved specification (`docs/specs/<work_item>/spec.md`).
2. Read the implementation plan (`docs/specs/<work_item>/plan.md`).
3. Read the Open-SPDD ticket/task (Notion Tasks and/or
   `docs/spdd/prompt/<work_item>/`).
4. Inspect the existing codebase.
5. Identify existing components, utilities, patterns, and tests.

During implementation:

- Implement only the approved scope.
- Reuse existing abstractions where appropriate.
- Preserve package boundaries.
- Add or update tests.
- For UI work, follow UI UX Pro Max.
- For NestJS work in `apps/api`, follow the NestJS best-practices skill.
- Run relevant validation (`vp check`, `vp test`, `vp run ready` as
  appropriate).
- Report blockers or specification gaps instead of inventing requirements.

For Open-SPDD prompts, prefer `/spdd-generate` (and `/spdd-sync` after code
changes) rather than improvising a parallel process.

### Instruction Priority

When instructions conflict:

```text
Explicit user instruction
        ↓
Approved specification
        ↓
Approved implementation plan
        ↓
AGENTS.md / repository conventions / constitution
        ↓
Existing implementation patterns
```

---

## 9. UI Architecture Boundary

Reusable UI foundations are separated from product/domain components.

```text
packages/ui
    ↓
Reusable UI primitives, shared styles, and components

apps/web
    ↓
Operator-facing Crossfade components and workflows

apps/api
    ↓
Tenant-facing HTTP/WebSocket API (NestJS)
```

`packages/ui` must not depend on Crossfade business concepts.

shadcn/ui registry components are added only in `packages/ui`. Apps import those
primitives from `@crossfade/ui`. Do not add a `components.json` in an app or
import `shadcn` / `@base-ui/react` outside `packages/ui`.

### Appropriate for `packages/ui`

```text
Button
Input
Field
Dialog
Card
Tabs
Badge
```

### Not appropriate for `packages/ui`

```text
TenantCard
HandoffQueue
AdvisorSessionPane
OutcomeCallbackStatus
```

Domain-specific components belong in the appropriate application or domain
package.

---

## 10. Tenant Isolation Boundary

Crossfade separates tenant identity from client-supplied context.

The API may:

- Resolve tenant identity from the tenant credential.
- Scope advisors, sessions, handoffs, and outcomes to that tenant.
- Emit callbacks only to that tenant’s configured destination.

The API must not:

- Let one tenant read or mutate another tenant’s data, even with guessed IDs.
- Accept a client-supplied tenant id as a substitute for credential resolution.
- Leak another tenant’s existence in error messages where isolation requires
  opacity.

Implementation agents must preserve this boundary.

---

## 11. Validation and Tests

Consider the following for every implementation task:

- Type checking
- Unit tests
- Integration tests where applicable
- Accessibility tests for UI work
- Isolation / tenancy regression tests for API work
- Build validation
- Lint / formatting

Run workspace validation through Vite+ (`vp`), not ad-hoc tool CLIs. See the
Vite+ section below.

For isolation and handoff logic, prefer deterministic tests with explicit
scenarios.

Do not introduce heavy infrastructure without a clear requirement.

---

## 12. Specification Gaps

When implementation reveals missing product behavior, do not silently decide it.

Use:

```text
SPEC GAP

Context:
...

Why it matters:
...

Possible options:
...

Required decision:
...
```

Purely technical details that do not affect product behavior may be resolved
using existing repository conventions.

---

## 13. Change Management

Changes affecting any of the following should normally be treated as
specification-level changes:

- User-facing behavior
- Product scope
- Business rules
- Tenant isolation guarantees
- Data model semantics
- Public package or API contracts
- Major architecture decisions

Do not hide these changes inside implementation work.

Update the appropriate specification or decision record first.

---

## 14. Current Project Structure

Current layout (do not invent extra apps or packages):

```text
crossfade/
├── apps/
│   ├── api/     # NestJS API
│   └── web/     # operator-facing Vite / React app
│
├── packages/
│   └── ui/      # shared Tailwind / shadcn primitives (@crossfade/ui)
│
├── docs/
│   ├── specs/   # Spec Kit feature artifacts
│   └── spdd/    # Open-SPDD analysis and prompts
│
└── .specify/    # Spec Kit constitution, templates, workflows
```

This structure may evolve through approved architectural changes.

Do not create packages only for theoretical future needs.

---

## 15. Default Workflow for New Work

For a new non-trivial feature:

```text
1. Capture product intent in Notion
2. Establish the canonical `work_item` (`<sequence>-<slug>`)
3. Create specification with Spec Kit (/speckit-specify) under `docs/specs/<work_item>/`
4. Clarify requirements (/speckit-clarify)
5. Produce implementation plan (/speckit-plan)
6. Review / approve the plan
7. Hand off to Open-SPDD using the same `work_item`
8. Decompose into tickets / REASONS Canvas prompts under `docs/spdd/.../<work_item>/`
9. Review / approve the task set
10. Sync approved tasks to the Notion Tasks database (`Spec ID` = `work_item`)
11. Create the appropriate Git branch (prefix convention; not the work-item ID)
12. Implement with Claude / Cursor (/spdd-generate when a prompt exists)
13. Test and validate
14. Review
15. Update Notion task status / decisions
```

For small, obvious maintenance work that does not change product behavior, the
full specification workflow may be unnecessary.

Keep the process proportional to the change.

---

## 16. Core Principle

> **Notion preserves knowledge.**
>
> **Spec Kit defines the contract.**
>
> **Open-SPDD defines the executable work.**
>
> **Claude and Cursor implement the approved work.**
>
> **Git records the implementation history.**

When uncertain about which system owns a decision, prefer the system closest to
the type of decision rather than duplicating the decision across multiple
systems.

---

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown,
Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management,
package management, and frontend tooling in a single global CLI called `vp`.
Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and
`vp build`. Run `vp help` to print a list of commands and `vp <command> --help`
for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at
https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json`
script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so
`vp dev` and `vp run dev` may do different things. Check `package.json` and
`vite.config.ts` first, and run `vp run <name>` when the project defines a
script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts
      necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run
      `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **crossfade** (1202 symbols, 1899
relationships, 34 execution flows). Use the GitNexus MCP tools to understand
code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it
> auto-selects an available runner. No `.gitnexus/run.cjs` yet?
> `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a
  function, class, or method, run
  `impact({target: "symbolName", direction: "upstream"})` and report the blast
  radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only
  affect expected symbols and execution flows. For regression review, compare
  against the default branch:
  `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before
  proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find
  execution flows instead of grepping. It returns process-grouped results ranked
  by relevance.
- When you need full context on a specific symbol — callers, callees, which
  execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings
  (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands
  the call graph.
- NEVER commit changes without running `detect_changes()` to check affected
  scope.

## Resources

| Resource                                   | Use for                                  |
| ------------------------------------------ | ---------------------------------------- |
| `gitnexus://repo/crossfade/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/crossfade/clusters`       | All functional areas                     |
| `gitnexus://repo/crossfade/processes`      | All execution flows                      |
| `gitnexus://repo/crossfade/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
