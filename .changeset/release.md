---
'@plitzi/cli': patch
---

A data table, a row named one way everywhere, a disclosure's summary that takes a name, and `page check --state` that
waits for the flows still on their way.

## Tables

- **`table` and `tableColumn`**: a table of data, fed like a list — `items` written out, a source's name or a typed
  path — its `row` writing its columns, each a `header` and the cell it draws with the row in hand. It draws a
  `<table>`: its `caption`, a head of `<th scope="col">`, a row per item; a column with `rowHeader` names its row
  (`<th scope="row">`). A column's `visible` takes it from the head and every row at once — a table whose columns change
  with the state — and it is read as a table by a screen reader and a search engine, which rows of a grid are not. Its
  rows publish `table_<id>` (`item`, `index`), as a list's do; its slots `caption`, `head`, `row`, a column's `header`.

## A list's row

- **`r.item` and `r.index` are a row's one name**, in a binding, `from` and a template alike: a template's is completed
  to the row's source in full (`list_rows.item`) as the space is authored — a list's, a carousel's or a table's.
- **`visibleIf(source, comparison, value)`**: the condition most visibilities are — `visibleIf('state.step', '>=', 2)` —
  written as the `{ source, template }` it is, `source is defined` included.
- **To redo:** `r.inTemplate` is gone (from a list's row and a typed one): write `r.item` / `r.index` where it said
  `r.inTemplate.item` / `r.inTemplate.index` — the same text in a template, completed.

## Elements and authoring

- **`disclosureSummary({ label })`**: a summary that is an icon alone — a menu's burger — is named with `label`
  (`aria-label` on its `<summary>`), as a button and a link are; its Settings show it as Accessible Name.
- **`control-without-name` reads a disclosure's summary**: one with an icon alone and no `label` warns, as a button or a
  link does — it was authored unnamed, and nothing said so. An `svg` with a `label` names the control it is in.
- **`label` is the one name for a control** whose words do not say what it does — a button, a link, a summary — and
  every message and reference says so (a button's `title` only adds the tooltip).

## Checking a page

- **`page check --state` reads the state once the flows on their way have ended**, up to 3 s, and says a flow still
  running beside it — a page-load flow waiting out a `delay` read `state {}` with nothing said, and a run debugged a
  flow that worked. The dev tools say the flows running now (`window.__plitzi.running()`), and `readDevTools` reports
  them as `running`.

## Skills

- `explain` takes the words themselves, quoted: the authoring skill named a `--search` the CLI has not.
- A site's reading route names `structure` and `colours-and-motion` too; a flow shared by two elements is a
  `StepSpec[]` (flows.md).
