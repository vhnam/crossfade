# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Workspace apps and packages use independent SemVer via Changesets; see each
package `CHANGELOG.md` for version-level notes.

## [Unreleased]

### Added

- Specification-first agent workflow in `AGENTS.md` (Notion → Spec Kit →
  Open-SPDD → Git), with Crossfade package and tenant-isolation boundaries.
- Canonical work items `001`–`005`: tenant onboarding and isolation, handoff
  intake, live chat session, session outcome callback, and availability
  fail-safe (`docs/specs/` plus matching Open-SPDD analysis and prompts).
- `skills-lock.json` for third-party agent skills (Matt Pocock, UI UX Pro Max,
  NestJS best practices).
- Repo-owned GitNexus skills under `.claude/skills/gitnexus/`.
- Tenant onboarding and credential isolation in `@crossfade/api`: operator
  lifecycle routes, Bearer API-key auth, and hashed credentials. Tenant identity
  comes from the credential, not a client-supplied tenant id.
- Operator Better Auth (`/api/auth`), a local operator seed, and password-reset
  URLs logged until a mail provider is configured.
- Operator login, forgot-password, and reset-password in `@crossfade/web`.
- Alert, Field, and Label primitives in `@crossfade/ui`.
- PostgreSQL via Prisma (Client generated to `apps/api/src/generated`) and an
  initial migration.
- Crossfade READMEs for the repo, API, web, UI, and Changesets.
- Package releases: `@crossfade/api@0.0.2`, `@crossfade/web@0.1.0`,
  `@crossfade/ui@0.1.0`.

### Changed

- `CLAUDE.md` is a real pointer file instead of a symlink to `AGENTS.md`, so
  Claude-specific notes no longer overwrite the shared workflow.
- Open-SPDD analysis and prompt filenames use timestamp, sequence, and work-item
  slug instead of a JIRA key prefix.
- `.gitignore` excludes lockfile skill install trees, including Claude skill
  symlinks into `.agents/`, and TypeScript `*.tsbuildinfo` caches.
- Tenant `status` in HTTP JSON is `active` / `suspended`. Operator suspend,
  reactivate, and rotate-key return 200.
- API and web env are validated at startup with T3 Env and Valibot.
- Changesets versions private packages and does not invoke `oxfmt`
  (`format: false`); format with `vp fmt`.
- `@crossfade/ui` no longer exports `./typeset.css` or ships Vite app scripts.

[unreleased]: https://github.com/vhnam/crossfade/compare/main...HEAD
