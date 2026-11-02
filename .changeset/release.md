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
- `page outline --within <part> --click <el>` lists apart what the click opened outside the part (a sheet or a dialog in
  a portal); what a page play finds drawn over an element is named by a selector, never its tag alone; a play that fails
  says the pictures its steps took before it.
- `page shot --within` pictures what the part paints past its box (a shadow, an outline, a blur); `--steps` that scroll
  picture the screen, not the whole page; `task look --before` hands each differing section of a tall page cut apart.
- `task show` says the project's checks apart from the task's acceptance.

## Authoring (`@plitzi/sdk-authoring`)

- A `hover` step points at an element an endless animation keeps moving where it is now (`hoverElement`), where it
  waited for it to hold still and timed out.
- The plugins reference says `RootElement`'s `tag` (`tag="span"`), and that a plugin's stylesheet is linked only on the
  pages that draw it.

## Elements (`@plitzi/sdk-elements`)

- A new element, `focusGroup`: the arrow keys move the focus between the controls inside it — ↑/↓ through them, ←/→ to
  the first of the next or the previous list, Home/End to the ends; ↓ from a text field inside goes down into them and
  ↑ from the first comes back. For a search palette's results, a menu, a set of options.
