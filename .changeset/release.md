---
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
---

## CLI

- **Several agents on one project: `plitzi run` and `plitzi task`** (`@plitzi/cli`) — RFC 0028. One plan and one run at
  a time per project, with as many agents at once as it opens with (`--agents`, 3 by default). The lead's plan of tasks
  over disjoint files, held to the rules (`run plan`: no file in two tasks, no cycle, ownership read off the imports, an
  estimate) and opened with a backup of every file it touches (`run open`). Each task is taken with a token and works in
  its own copy of the project under `tmp/plitzi-runs/`; `task complete` refuses what it changed in another working
  task's files, takes by turns the free ones it changed outside its own (or requests them when held), and runs the
  project's checks in the copy. Tasks agree with each other (`task propose`, `task answer`). Before anything is written,
  each file is checked against what the agent found: a change made meanwhile stops the approval, and the lead decides
  (`--overwrite`, said and the other version kept, or `--changes`). Approved work merges into the run's, never into the
  project, which receives one merge a person confirms (`run finish --apply`) once the lead closed the run with its
  report (`run report --summary`). The run then goes, backups included (`--keep-backup` keeps the files it overwrote);
  its report stays in `tmp/plitzi-reports/`. Turns and integration on shared files, reconciliation, stop, forced stop,
  reassign and attach after a cut from the last reviewed version, and a distinct exit code per refusal. With `space
  overview` and `space impact`, and the skill's `reference/runs.md`. A team: the lead and roles per task (`task next
  --role`, which hands an agent back its own unblocked task first), the lead and the agents talking (`task ask`, `task
  message` to a task, all, or an agent by name, `task inbox`, `task tell` (for the lead to know, no answer waited for),
  `task unblock --answer`, and `run watch --until lead`, which wakes the lead once for each thing that needs it), shared
  files connected as each task is approved (taken by turns when free, merged line by line), `run preview` of the run's
  work as it goes (`--task`: a task in review, before approving it), `task show` (a task as its lead reviews it, each
  file's diff and what to run next), `task review --approve --merge` and `run resolve --take merge` (a person's change
  and the run's, line by line), `task revert --reason`, a plan's `touches` (the files a task will change outside its
  own, which `run plan` warns about when two would at once), an agent limit that counts agents, and `--known-failure` as
  the only way to review with failing checks — but a check that fails without the task too is marked `preexisting`, not
  the task's.
- **`plitzi explain` knows the template filters** (`@plitzi/cli`, `@plitzi/sdk-authoring`): `explain currency`, `--list
  filters`, from a catalogue beside the filters that a test holds whole. **`'now'|date(…)`** is the moment the page is
  rendered, and **`<`, `>`, `<=`, `>=` order strings as text** — `r.date >= '2026-10-20'` was false for every row, as
  both sides were turned into numbers; numbers and numeric strings still by value; **`replace({' ': ''})`**, Twig's map
  form, replaces each key by its value instead of leaving the text as it was (`@plitzi/sdk-shared`). A field read off a
  list row with no types is refused `source-name-missing`, saying how a row gets its types, instead of a TypeError.
  `page shot --width 1440,390` takes a picture at each width; `page check` reports written-out lists too.
- **`plitzi upgrade --write` waits for an open run** (`@plitzi/cli`): the run pinned the Plitzi its copies were made
  with. `--with-open-runs` upgrades anyway, and a person attaches to the run after.
- **A form's textarea is written in the page's font** (`@plitzi/sdk-elements`): it is its own box, with no field inside
  to inherit through, and showed the browser's monospace until a class set `font-family`.
- **A required select is required** (`@plitzi/sdk-elements`): the `<select>` of a form control never carried
  `required`, so the browser's own check skipped it and an empty submit stopped at the next field; it now does, and
  takes the focus when shown, as an input does. A textarea is optional unless it says so.
- **A link to a path no page answers is warned** (`@plitzi/sdk-authoring`, `page-path-unknown`): a page not made yet, or
  a typo, followed in-app to the 404 page. Files, the platform's own paths (`/_…`), the space's functions and a bound
  `href` (where it starts, not where it leads) are not checked.
- **A run's task completes with no authoring suggestions** (`@plitzi/cli`): a suggestion fails the author step at
  `complete`, as a warning does — one that was there before the task is `preexisting`, not its.
- **`list.put` refuses a value written as JSON that does not read** (`@plitzi/sdk-server`): one put together by a
  template with a value outside quotes left empty (`"amount": }`) was kept as a string, and the list's readers failed
  on it later. The step now fails, saying how to write it.
- **`page check --element` says what the element shows** (`@plitzi/sdk-dev-tools`, `@plitzi/cli`): its text as a
  visitor reads it, its bindings resolved — so a count that follows a filter is read after a `--click`, not worked out
  from the template. And **`--fill` works without `--click`**: what typing in a field changes, as a search box does; with a click, what
  the filling changed by itself is said apart. `--element` and `--state` read the page as the interaction left it, and a
  second `--element` is refused rather than replacing the first.
