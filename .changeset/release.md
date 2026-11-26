---
'@plitzi/cli': patch
---

A disclosure's summary takes a name, and `page check --state` waits for the flows still on their way.

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
