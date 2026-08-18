# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Changed

- `CLAUDE.md` is a real pointer file instead of a symlink to `AGENTS.md`, so
  Claude-specific notes no longer overwrite the shared workflow.
- Open-SPDD analysis and prompt filenames use timestamp, sequence, and work-item
  slug instead of a JIRA key prefix.
- `.gitignore` excludes lockfile skill install trees, including Claude skill
  symlinks into `.agents/`.

[unreleased]: https://github.com/vhnam/crossfade/compare/main...HEAD
