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
- `plitzi doctor --fix`, moving a folder of an older layout, names the paths the code writes as text
  (`path.join(ROOT, 'data/…')`), which no move follows, and says them again (`path-to-moved-folder`) until they name
  where the folder is; a `data/` the code writes to as it runs is not moved into `src/data/` — it is state, said to
  belong in `state/`.
- `plitzi upgrade packages --write --take script:<name>` replaces a script of the project's with the CLI's — one an
  older CLI wrote before scripts were recorded is the project's otherwise; the doctor's fixes name it.
- `plitzi upgrade --take AGENTS.md` moves the sections the project added to `NOTES.md` before the CLI's replaces it.
- `page check`'s `flush-edge` leaves out a section that ends the page (nothing below it to touch); `plitzi explain`
  knows every code of `page check`.
- `space lint`'s `inline-records` leaves out a table a type is derived from (`typeof KINDS`).

## Authoring (`@plitzi/sdk-authoring`)

- A `hover` step points at an element an endless animation keeps moving where it is now (`hoverElement`), where it
  waited for it to hold still and timed out.
- The plugins reference says `RootElement`'s `tag` (`tag="span"`), and that a plugin's stylesheet is linked only on the
  pages that draw it.
- A whole-page picture unrolls the page's own column, never a list scrolling inside a panel: its rows were drawn over
  what was below it (`page shot`, the visual comparisons).
- `custom-css-class` says how many rules it does not name, and that moving them may leave more (a rule of several
  selectors, an `@media`); `mask` and `-webkit-mask` are refused naming the longhands the vocabulary has, not
  `customCss`.
- `repeated-shape` says it right: copies side by side wired to different sources are controls written alike; copies
  apart that read different sources are one component, each instance handed its own as a bound `json` prop — the
  suggestion says how, and no longer that they "differ only in what they say".

## Server (`@plitzi/sdk-server`)

- `serverOptions.onListening({ url, server })` runs once the project's server answers — a warm-up of its home, now that
  `main.ts` is the CLI's; not awaited, and a failure is said.
- A page's `settings.paintedState` is not drawn from an entry another account wrote than the one the request proved:
  the next account on a browser was drawn the previous one's values, and its providers read them before the page
  could discard them.

## Elements (`@plitzi/sdk-elements`)

- A new element, `focusGroup`: the arrow keys move the focus between the controls inside it — ↑/↓ through them, ←/→ to
  the first of the next or the previous list, Home/End to the ends; ↓ from a text field inside goes down into them and
  ↑ from the first comes back. For a search palette's results, a menu, a set of options.

## Kept state (`@plitzi/sdk-shared`)

- A kept key the page wrote before the restore landed stays when the kept entry holds none of it: a page's own default
  written on load was dropped whenever the visit had started on another page.
