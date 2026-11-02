---
'@plitzi/cli': patch
---

## The CLI (`@plitzi/cli`)

- `plitzi upgrade` keeps a project's own `.gitignore` and `.prettierignore` and adds the CLI's lines they lack (the
  folder `plitzi feedback` writes to, the test outputs); `plitzi doctor` says when one lacks them
  (`machinery-lines-missing`).
- A file of the project's own is shown beside the CLI's until a `--write`, then in a line until the CLI's version
  changes.
- A project still in an older CLI's layout is told to move with its own `plitzi doctor --fix` when that is this CLI,
  or this version's — not `@latest`.
- `plitzi feedback --check` accepts the links of the earlier reports a report continues (`changed[].url`).
