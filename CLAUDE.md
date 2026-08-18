# Claude

Follow [AGENTS.md](./AGENTS.md). That file is the shared operating contract for
Claude and Cursor. Do not duplicate or override it here.

Claude-specific entry points:

- Spec Kit skills: `.claude/skills/speckit-*` (`/speckit-specify`,
  `/speckit-clarify`, `/speckit-plan`) — repo-owned, committed
- GitNexus skills: `.claude/skills/gitnexus/` — repo-owned, committed
- Third-party skills: `skills-lock.json` only. Reinstall with `npx skills`.
  Sources: [mattpocock/skills](https://github.com/mattpocock/skills),
  [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
  Do not commit lockfile install trees (`.agents/`,
  `.claude/skills/<lockfile-skill-name>`). When adding a lockfile skill,
  gitignore its install path. Full rule in [AGENTS.md](./AGENTS.md).
- Open-SPDD commands: `.claude/commands/spdd-*.md` (`/spdd-analysis`,
  `/spdd-reasons-canvas`, `/spdd-generate`, `/spdd-prompt-update`, `/spdd-sync`)

Spec Kit stops after `/speckit-plan` unless the user explicitly asks for
`/speckit-tasks`.

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **crossfade** (877 symbols, 1097
relationships, 14 execution flows). Use the GitNexus MCP tools to understand
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
