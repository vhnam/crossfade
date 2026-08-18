# Changesets

Workspace apps and shared packages use independent SemVer via
[Changesets](https://github.com/changesets/changesets). Packages are `private`
and consumed with `workspace:*`. Do **not** publish to npm. Do **not** run
`changeset publish`.

## Commands

From the repo root:

```bash
vp run changeset           # add a changeset
vp run changeset:version   # consume changesets, bump package.json, write CHANGELOG.md
```

`changeset version` is a release step. Conventional Commits describe git
history; they do not bump versions by themselves.

## When to add a changeset

Add a `.changeset/*.md` file when a package’s API or shipped behavior changes.

Skip changesets for docs, specs, formatting, and agent-workflow files.

| Impact  | Example                                                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patch` | Crash fix with no contract change; CSS fix in `@crossfade/ui`                                                                                                                       |
| `minor` | New public NestJS export; new Button/Input primitive                                                                                                                                |
| `major` | Remove or rename a public export. During `0.y.z`, reserve `major` for an incompatible API change; bump `minor` for later development releases unless the changeset records `major`. |

Multiple pending records for the same package: highest impact wins.

A new workspace member must ship `"version"` and `"private": true` in
`package.json`. To exclude a package from versioning, add its name to
`config.json` `ignore` and document why in the PR.

Full convention: [`AGENTS.md`](../AGENTS.md) §7.
