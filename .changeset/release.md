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

- **Several agents on one project: `plitzi run` and `plitzi task`** (`@plitzi/cli`; how it works, `docs/en/agent-runs.md`). One plan and one run at
  a time per project, with as many agents at once as its team has (`.plitzi/team.json`, written at the first run when there is none). The lead's plan of tasks
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
  the task's. **Acceptance a command can tell** (`{ said, check }`, run in the copy at `complete` with `plitzi` as this
  CLI and `$PLITZI_URL` the copy served; `page check --expect <id>~<text>` to hold a page's text; `run plan` refuses a
  check it could not run), **the run's notes** (a plan's `notes` and `run note`, to every task once) and `task context`
  as a brief to start from; commands run inside a task's copy need no token, run or agent (`tmp/plitzi-task.json`),
  `--timeout` takes `90s`/`8m`/`1h`, `PLITZI_JSON=1` answers every command as JSON, and a text written `-` is read from
  stdin. **`run rehearse`** plays a plan out before any agent starts — the schedule by agent and role, the critical
  path, the lead's review queue, the files several tasks change at once, and the run's length for each number of agents.
  **`run amend`** corrects what an open run asks (titles, acceptance, notes) from the plan edited, each task told; `run
plan` refuses a `page check` whose text the shell would split. From the sixth real run: `task next` hands a task back
  with what was said to it meanwhile, `complete` says each acceptance check and what the space's lint still warns of
  (kept for `task show`), `task show` marks read what the task told the lead, `run preview --task` says to page check
  from the copy, `task take` says to work inside the copy, and the report lists every file a task wrote. **A file a
  task takes past 400 non-blank lines** is said to the lead while it works (`run watch --until lead`), to the agent with
  its heartbeat, and refused at `complete` until it is split. **The lead may apply the run itself** when a person lets
  it — `run open --lead-finishes` or `run allow-finish`, typed in their terminal; the lead asks before opening — still
  with its report and the checks green on the whole result, said in the report. From the seventh run: `task next
--take` takes what it offers (passing one another agent took meanwhile), and says when the run is done for the agent
  how its own tasks ended; a shell left in a removed copy is told so; `complete`'s server for the acceptance logs, and
  says a server of the agent's own still running is the usual cause when it does not answer; `page check --expect` says
  each expectation met, and `page check` says a short link or button label broken onto two lines (`label-wraps`) — a
  menu one entry too long; `task show` says the files changed outside the task's own; `run plan` no longer warns of a
  held file to a task that waits for its holder. In `@plitzi/sdk-authoring`, a source named outside the scope that
  prefixes its element says so, with the two ways out. **A shorter cold start:** a plan's `primer` (the lead's,
  beside it) opens every task's brief, and `task context` names the few skill files the task's files need; `run plan` and
  `run rehearse` say the estimate at this project's pace, read off its past reports. **The team:**
  `.plitzi/team.json` (`plitzi run team set <name> --roles … --count … --model … [--effort]`) — the lead and each agent,
  its roles, how many and its model; its size is how many work at once (no `--agents`), a role nobody takes is refused, and `run plan` says
  how to start each agent. A **tester** in it gives each developer task `<id>-tests` after it (Playwright specs for its
  pages, `node --test` beside its modules, run against the copy served); a **designer** in it reviews the UI of
  the others' tasks before the lead (`task next` offers it, `task review` by the designer hands it on; the lead's
  `--skip-design` approves without it, said in the report). `task context --files` hands a task its files and its data's shape at once; the
  brief says a file of the task already near 400 lines. From the eighth run: a revert reaches the agents who did the
  task by name, a task in review is never called silent, a task done again after a revert wakes the lead, `task next`
  says what a pending task waits for and whose version a worked task ended as, and a change made in the project while a
  task worked is said as what it is — the lead decides. `page shot --fill` chooses a select's option.
- **Runs stack, and say what awaits applying** (`@plitzi/cli`): `run extend <run> <plan>` puts the next plan on an open
  run — begun from its work, one finish for both; `run pending` lists the project's runs not yet written into it, with
  the command for each. `task look <task> [paths…]` looks at a task in review in one command: served, page checked,
  pictured light and dark. `page check --then <paths…>` goes on by the page's own links, no reload, and checks each
  page as a visitor reaches it (what a session keeps); `--expect "<path> <id>~<text>"` holds one page of several.
- **The tenth run** (`@plitzi/cli`): `run plan` with a run open checks the plan as its next stage (nothing written)
  and says the `run extend` that stacks it; `run amend` and `run extend` take `[run] <file>` alike, and amend takes a
  stage's own plan; a page check's `--expect` naming an id the space does not have is said at `run plan`, with the page
  family's id it meant; a designer's approval stands for a round that did not touch the UI, and carries a `--note` to
  the lead; a review offered again says its round and what the lead asked; `task look` with no page looks at the pages
  that own the task's files; an address the not-found page answers is no longer a passing check; a task sent back is
  handed back with what its review asked; a tester's brief has the acceptance and reviews of the task it tests;
  `complete` refuses to serve a copy the agent's own server still holds; a new project lints its `node --test` tests.
- **A page a screen reader can follow** (`@plitzi/sdk-authoring`, `@plitzi/cli`): `inspectPage` and `page check` say
  headings that do not start at an `h1` or skip a level as the page is drawn — layouts and components included
  (`heading-skipped`) — and a link, button or field with no name a screen reader can read (`control-unnamed`), each
  with its way out; `skip: ['accessibility']` for a page that breaks one on purpose.
- **A team in every new project** (`@plitzi/cli`): `plitzi create` writes `.plitzi/team.json` — a developer and a
  designer, two agents, the harness's own models — with an `about` that says what each field and role means (any other
  name is a role of the project's own) and how to grow it; `run team` lists the roles, and the file is written as the
  project's Prettier leaves it.
  A case the project's data never shows is the lead's to plan how it is seen (the skill), the designer says one it could
  not look at, and a tester's task holds one with a unit test.
- **An anchor in a list's row is the row's own** (`@plitzi/sdk-elements`, `@plitzi/sdk-authoring`): inside a list with
  `items`, an element's anchor is drawn with its row's name (`faq-answer-luna`) — no longer refused as repeated — and a
  button of the same row that `controls` it points at its own row's (`controlsInRow`, set by authoring); one outside the
  row is refused (`controls-other-row`), and a link to a row's anchor too (`anchor-in-row`). `anchor-repeated` is now a
  component's alone. A `container({ subType: 'ol' })` refused is told a list's rows can be written out as children.
- **A toast's close button shows its focus** (`@plitzi/plitzi-sdk`): the library's own rule takes its outline off; the
  SDK puts it back, and rings the notifications region in the space's colour.
- **`page check`** (`@plitzi/cli`): `--element` once for each element, each with what it reads and how its classes
  meet; an address a page answers by its own id (as the router does) is that page, not the not-found one.
- **Runs on Windows** (`@plitzi/cli`): a check's `$PLITZI_URL` / `$PLITZI_PORT` are written into it for any shell, a
  served check gets `PORT` (and one running `playwright test` is served), `plitzi` has a `.cmd` beside it, and the copy's
  server is stopped as a tree.
- **A paragraph made of parts holds no block** (`@plitzi/sdk-authoring`): `span-holds-block` warns of a `p` container
  holding a `text` or a plain `container` — `<div>`s the browser closes the paragraph before, which broke hydration.
- **A disclosure, natively** (`@plitzi/sdk-elements`): `container({ subType: 'details' })` with a `summary` first, and
  `open` to start open — the browser's own, no state, announced as one.
- **Buttons and textareas take the page's font** (`@plitzi/sdk-elements`, `@plitzi/plitzi-sdk`): `font-family:
inherit` in their base style, the declaration and the stylesheet alike.
- **Pages registered by being there** (`@plitzi/sdk-authoring`, `@plitzi/sdk-shared`, `@plitzi/cli`): `pagesIn(new
URL('./pages/', import.meta.url))` (`@plitzi/sdk-authoring/node`) loads every page of a folder — each module's default
  export, a page or a family's list, the home page first — and `PageSpec.nav` (`{ label, order }`) with `navOf(pages)`
  gives a layout its menu, `current: 'section'` for a page with others under it; `nav` is authoring only, and one it
  cannot list is refused (`page-nav-invalid`). A new page is then a file of its own: no line in the entry, none in the
  layout. The CLI follows the folder as imports (`space overview`, the runs' ownership, `space lint`'s unused files), by
  the rule both share (`pageModulesIn`, `@plitzi/sdk-shared/project`). For a project with a server: `plitzi doctor`
  says `node-in-browser` when a space authored in the browser imports `@plitzi/sdk-authoring/node`. `plitzi create`
  keeps listing the pages — one agent on a project needs no convention.
- **The marks a spec carries are the global registry's** (`@plitzi/sdk-authoring`): a page family, where an element was
  written and a source's path, made by the project's copy of the package and read by a CLI's — `plitzi space lint`
  took a family's pages for `repeated-shape` copies when the two copies differed. And `@plitzi/sdk-server` loads its
  budget again: the filters' catalogue is `@plitzi/sdk-shared/helpers/twigWrapper/filters/catalog`, and the pages'
  rule `@plitzi/sdk-shared/project/pages`, entries the server never reads.
- **`date` reads an epoch in seconds too** (`@plitzi/sdk-shared`), as the docs said and Twig's own does: below 10^11 a
  number (or a string of digits) is seconds — `1792454400|date('Y-m-d')` was 1970-01-21 — milliseconds above.
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
  the filling changed by itself is said apart. `--element` and `--state` read the page as the interaction left it.
- **`plitzi explain` knows a server action's steps** (`@plitzi/cli`, `@plitzi/sdk-server`): `explain list.put`, `--list
tasks` — what each does, what it answers and its params, read from the `@plitzi/sdk-server` the project installed, the
  catalogue the builder draws them from. The twenty steps that had no description have one.
- **`repeated-shape` tells forms apart by their fields** (`@plitzi/sdk-authoring`): an element's `subType` is part of
  what it is — a date field is no number field, an `h2` no `h3` — so two forms asking for different fields are no longer
  taken for one component (only fewer suggestions: copies alike in kind are still found).
- **No file past 600 lines of code** (every package): the shared lint config holds each file to it (`max-lines`,
  blank lines and comments not counted), and the files past it are folders of modules by what changes together — the
  twig filters by kind, the project's layout check, the server's types, the authoring codes by subject, `authorSpace`
  and `specFromSpace` (their classes' methods now functions of the author and the reader), the auth API by flow, the
  schema validator by check, the MCP guide by section (its text unchanged), and the functions sandbox's guest a web API
  to a part, each printed into the isolate on its own. Only how the code is filed changed: the exports are the same.
- **Runs held against what an agent can do around them** (`@plitzi/cli`), found by running the CLI against itself —
  races, forged tokens and records, links, writes after a review, kills mid-step:
  - what an approval merges is what went to review (kept at `complete`), never the copy as its agent left it after —
    `task look` and the approval say what was written since;
  - two tasks completing at once no longer both take one shared file by turns (one claim at a time, `claim.lock`), and
    a file two tasks made by one name is the lead's to decide, never two put together;
  - a plan refuses a pattern (`src/pages/*.ts`), a link, and two paths that differ only in case (one file on macOS and
    Windows); a task with no acceptance is said; a plan that is not one says each wrong field;
  - a file of a task turned into a link is refused at `complete`; a copy that is gone is said as gone;
  - a UI review counts only from a designer of the team, and `--skip-design` is the lead's, said how;
  - a token a task was never taken with is told apart from one it was cut from; a run's record broken by hand is a
    refusal by name with what to do, not a crash;
  - the docs say what is a guard rail: a person's actions are kept a person's by the harness's permissions;
  - a message too long to scan is cut in `run status` and `run watch`, whole in the inbox; a developer task that gets no
    task of tests is said, with why; `run team set` asked for what the team already is says so, and is no refusal;
  - the rounds before a person looks at a task are counted apart for the designer's UI review and the lead's; `task
show` of a task in review shows what went to review; a task that accepted an agreement is told when the task it
    agreed with is approved; `task look` of a shared file looks at the pages that use it;
  - **the finish runs every done task's acceptance checks again on the whole result**: one a later task broke (in
    pet-friends v12, the summary that grew past the printed sheet another task fitted it to) stops it, naming both;
  - a designer's own work asks for no UI review when no other designer could give it; `task complete --note` tells the
    lead what to look at; `run can-write` agrees with `complete` about a file of a task not taken yet; `task request` on
    another task's own file points to `task propose`; a sign of life of a task in review says it is in review.
- **Runs are faster** (`@plitzi/cli`): the project's checks run `author` first, then the rest three at a time — every
  failure said at once; and a pass on one whole result is reused within the hour, so `finish --apply` after its dry run
  does not run them again (a cycle of take, complete, review and finish: 13 s → 6.5 s on pet-friends).
- **A run leaves nothing of the lead's behind** (`@plitzi/cli`): the plan's primer, an amendment (`run amend`) and a
  stage (`run extend`) are removed with the run as its plan and summary were — the version read last of each — and so
  is the folder that held only them (`tmp/v11/` stayed with its primer).
- **The dev tools never print** (`@plitzi/plitzi-sdk`): their badge and panel (`data-plitzi-devtools`) are hidden in
  print by the SDK's stylesheet, so a printed page is what its visitors see — the badge was on every printed page in
  debug mode, where a project could not reach it inside its shadow root.
- **Watch the agents' work while they work** (`@plitzi/cli`, `@plitzi/sdk-server`, `@plitzi/sdk-shared`): a project's
  `start:preview` script (`plitzi run preview`, written by `plitzi create`, added by `plitzi upgrade`) serves the open
  run's approved work as each task is approved; the project's own `start:dev` says on its console, while a run is open,
  that it serves the project untouched until the finish and where the agents' work is; `run open` names the script and
  `run status` the preview's address — or how to start it. With no run open, `start:preview` says so and how the project
  is served.
- **The visual suite runs on a server of its own** (`@plitzi/cli`, `@plitzi/sdk-server`, `@plitzi/sdk-shared`): a
  project's `playwright.config.ts` starts the project on 8400 (a client project's on 5273) — a port none of its other
  scripts take (`start` 8080 or 5173, `start:preview` 8300/8301, the inspector 9229) — over plain HTTP, its record kept
  apart (`PLITZI_SERVER_RECORD`, `tmp/visual/server.json`) so `tmp/dev-server.json` stays the person's server's. It no
  longer falls back to 8080 and reuses the server a person has open. `plitzi upgrade` brings it to every project.

- **More leads for a larger team** (`@plitzi/cli`): one lead for every four agents — `lead-2`, `lead-3`… beside `lead`,
  or as many as `"lead": { "count" }` in `team.json` says (`plitzi run team set lead --count N`). They take reviews from
  one queue (`task next --role lead --follow --take`), a review another took refused to them, and do nothing else:
  planning, amending, stages, notes, unblocking, reassigning, reverting, reconciling, the summary and the finish are
  `lead`'s, refused to them and to every agent of the team (`lead-only`, exit 25). **They are started only when the
  reviews queue up**: `lead` reviews every task until two wait and the oldest waited five minutes — then `run watch
--until lead` names the lead to start — and one handed nothing for ten minutes is told it can stop, so a lead never
  waits on tokens for reviews it is not handed. While one runs, `lead` is woken for a review only after it waited two
  minutes untaken. Two verdicts on one task are given one at a time.
- **A verdict is a lead's** (`@plitzi/cli`): an agent of the team giving a review without its task's token — a developer,
  or a designer once the task's UI is said — is refused; before, any name without a token reviewed as the lead.
  `task revert` says it is the lead's before it asks for `--reason`.
- **Upgrading Plitzi mid-run loses no work** (`@plitzi/cli`): re-pinned by `run attach`, a task in hand on this machine
  keeps its copy, its agent and its token, and is told to go on — before, it started over from its reviewed version.
  `task next --follow` waits through the upgrade as through a stop, `run status` says what the person runs, and the
  refusal's next step says the agent keeps its work. A run's file that this CLI cannot read is said as the CLI's that
  wrote it, with the command to go on with it, not as a hand edit; `src/tests/runRecords/` keeps a run as each released
  CLI wrote it, and a test reads, works and finishes each, so a change to a record that is not additive fails before it
  ships. `run plan` says when the project's skills are older than the CLI.
- **`plitzi task check`** (`@plitzi/cli`): what `complete` holds a copy to — the project's checks, the acceptance's
  commands, the files too long — run without completing, and counted by no brake; it hands over what the lead said
  meanwhile (la-velada: three messages reached an agent only once it completed). A component or token one task declares
  for the tasks after it, read by none yet, passes a task's checks as a warning and fails only the finish's. The brake allows one more failure for
  each agent past the first (five agents fixing at once stopped a run on five), and a preview's server is stopped with
  everything under it (on Windows, its tree).
- **`run plan` says two more things** (`@plitzi/cli`): a file of a task that other tasks' files import — what it exports
  is their contract (v12: a component's params changed under three callers) — and the tasks whose acceptance no command
  proves, which hold at their review only.
- **`team.json` says what it means as the CLI installed does** (`@plitzi/cli`): its `about` is the CLI's — written fresh
  whenever the CLI writes the file, and brought up by `plitzi upgrade` (files), the agents and leads left as the project
  has them; before, a project kept the words of the CLI that created it (no lead count).
- **Words where a format goes are said as content** (`@plitzi/sdk-authoring`): `from` with `as: 'Pip has no weighing
yet'` was refused as a format nobody declared, offering to declare one; it now says `as` is a format's name or a
  template, and that words an element always shows are its `content`, with no `from`.
- **A link to a URL is never a page path** (`@plitzi/sdk-elements`, `@plitzi/sdk-authoring`): a link whose address
  has a scheme — `https:`, `mailto:`, `tel:` — is followed as written in any mode; a bound `{{ item.url }}` left in
  page mode resolved to `/https:/www.idealo.es/` (la-velada's sponsors). Authoring cannot know what a bound address
  holds — a page's path from the data works in page mode — so the SDK decides it by the value.
- **A run's checks are never hidden behind authoring's suggestions** (`@plitzi/cli`): a space that authors with
  suggestions still has its typecheck, lint, tests and format run — before, every step after `author` was skipped, and
  a task went to review with a type error unseen (la-velada: `class: { padding }` in a home part).
- **Co-leads counted running while they review** (`@plitzi/cli`): `lead` is not woken for a review another lead took,
  nor told to start a lead while one is at a review.
- **Follow a run as a person** (`@plitzi/cli`, `@plitzi/sdk-dev-tools`, `@plitzi/sdk-server`, `@plitzi/sdk-shared`):
  `plitzi run monitor` draws the run live in a terminal of its own, beside the harness's — every task, who has it and
  who reviews it, the leads at work, what needs someone, one task opened (↑↓, enter) — and only reads, so the agents
  never notice it; a shell with no terminal is refused and pointed at `run watch`. And the run's preview answers the run
  at `/__plitzi/run` (`@plitzi/sdk-shared/runs`): the page's dev tools show it in a **Run** tab, offered only there.
- **`plitzi run upgrade`** (`@plitzi/cli`): Plitzi upgraded under an open run without breaking it — a person's: the run
  stops gently, waits until nothing is being written, is upgraded (`plitzi upgrade --write --with-open-runs`, or
  `--install "<command>"`), re-pinned by the new CLI and resumed; an upgrade that fails leaves it as it was, open again
  (la-velada: an install under the open run stopped the preview three times).
- **The dev tools scroll again** (`@plitzi/sdk-dev-tools`): the panel's body took the whole panel's height below its
  header, its last rows out of reach in every tab; it takes the room under the header now. The Run tab reads at a
  glance: progress, the tasks still moving by where they stand, the approved ones beside the agents (model, status,
  what each is at), what needs someone under them, and the activity.
- **One preview a run** (`@plitzi/cli`): a second `run preview` of one run rebuilt the folder the first served from
  under it; it is refused now, naming the running one. A note of a task approved since no longer needs the lead.
- **The CLI's part of a project is one folder, `.plitzi/`** (`@plitzi/cli`, `@plitzi/sdk-shared`, `@plitzi/sdk-server`):
  what authors the space, the compiler options, the README and what the CLI records lived in `plitzi/` and `.plitzi/`;
  they are `.plitzi/` now. A project laid out before is said by `plitzi doctor` (`older-layout`) and moved by `doctor
--fix`, its scripts and `tsconfig*.json` following; `upgrade` asks for it first. A run's copies carry `.plitzi/` now —
  what a task's checks author with — and no task writes it: `complete` refuses a change there.
- **Careful leads** (`@plitzi/cli`): a plan says what the run leaves out (`leftOut`), shown at `run plan` and `run open`
  and kept in the report — and `run plan` says when it says nothing. The lead's skill starts with an inventory of what
  the job asks (pages, sections, the pieces a visitor would miss, each a check), prepares the data whole, gives the
  foundations to different agents, names classes and providers by area, reviews against the inventory and checks the
  coverage before closing — what la-velada's copy missed.
- **A model a quality level** (`@plitzi/cli`): a plan's task says `quality` (`light`, `standard`, `high`) — set by `run
plan` where it says none, with why: what many tasks build on is `high`, a one-file few minutes `light`. A team agent's
  `model` may be one a level (`{ "standard": "…", "high": "…" }`, `team set --model standard=…,high=…`), each level
  started apart and `run plan` saying whose tasks are whose; an agent started at a level (`task next --quality`) is
  handed tasks of it or below and told what waits above. The schema and `run team check` know both forms.
- **`team.json` is checked as a person writes it** (`@plitzi/cli`): every unknown field is said with the one it likely
  meant (`"modle"` — did you mean `"model"`?), by `plitzi run team check`, `plitzi doctor` (team) and `run plan`; and the
  file names its JSON Schema (`$schema`, shipped in `@plitzi/cli/schemas`), so an editor marks a wrong field as it is
  typed.
- **A look at a task's part of a page is of that part** (`@plitzi/cli`): `task look` of a task that writes a section of
  a page others build pictures its own elements, clipped, and sets apart the page check's findings on the others'
  parts — the home's stubs and missing h1 were each part's "failures"; fewer, smaller pictures for every reviewer.
- **What the run's agents asked for** (`@plitzi/cli`): every command that waits waits 9 minutes when not told —
  under the 10 a harness gives one command (`task next --follow` at 30 lost its answer to the background); `task show
--full` prints every line of each diff; `run preview --task` serves a task's copy while it is worked too, for its
  agent to look at its own pages without a server of its own in the copy; `page shot https://…` pictures another site
  as anyone sees it (the original a copy is made after), and one slow to wake is asked twice and said as slow, not as
  nothing answering.
- **A task's copy draws its pictures** (`@plitzi/cli`): the binaries of `public/` and `vendor/` a task does not own
  are cloned into its copy unread — told changed by size and time, never read whole for a fingerprint — so its page
  checks and every look at it see the images (la-velada: every review of the artists and the banners saw them 404).
- **A run's agents lose fewer rounds** (`@plitzi/cli`): `run amend` changes a task's role and quality until an agent
  takes it; a task sent back that others wait on tells its agent, at another task, that it goes first; `task check`
  brings into the copy what the run approved and what a person changed in the project since it was made, as `complete`
  does; `task look` and `run preview --task` use the agent's own server when it serves the copy already, instead of
  failing on its lock; `run extend` keeps the run's choice of a designer's review; `run finish`'s refusals say what a
  finish does next, not "complete again"; `run plan` no longer warns of a folder's own index, which only assembles its
  parts; a co-lead alone is told to hand what is beyond a review to the lead.
- **`page shot --compare --clip <section>`** (`@plitzi/cli`): compares both pages whole and keeps that section's
  difference in the report — it was refused, and a task copying one section read the whole page's.
- **Authoring says what rendered nothing** (`@plitzi/sdk-authoring`, `@plitzi/sdk-shared`): a list's `items` bound to
  a query provider outside its answer — the provider itself, or a field read at its root — is warned
  (`list-items-outside-answer`: no list there, its rows drew NaN); `activeWhen` on a component's `props` is taken, as
  `variantFrom` was; `border-image` is in the style vocabulary; a link reaches one row's anchor (`hash: 'pick-<row>'`)
  without `anchor-missing`, and the docs say a row's anchor is named after its row; `template-short-source` names
  `r.inTemplate.item` for a list's row instead of its id written by hand.
- **A project's `.plitzi/` is read by its typecheck and lint** (`@plitzi/cli`): TypeScript leaves a dot folder named bare
  in `include` out, so a new project includes `.plitzi/**/*` and `doctor` says (and `--fix` writes) a tsconfig naming
  `.plitzi` bare. The older `plitzi/` moved into `.plitzi/` keeps the scripts that run the CLI (`plitzi run preview`
  was rewritten `.plitzi run preview`), and its ignore files (`.prettierignore`, `.gitignore`) follow the move.
- **A run leaves the project's `tmp/` as it found it** (`@plitzi/cli`): its review pictures (`task look`, a `page shot`
  in a copy) are the run's and go with it; an agent's own files go in its copy's `tmp/` or the run's
  `scratch/<agent>/`, which `task next` names and makes; what appears in the project's `tmp/` anyway is said to the
  lead (`left-in-tmp`), at the finish, and to every agent by name with its next command — la-velada's agents left
  `tmp/dev1/` and a preview log there.
- **The Run tab lists the tasks once** (`@plitzi/sdk-dev-tools`): by where each stands — at work, in review, blocked, to
  do, approved last — under their headings, eight rows tall and scrolled on its own, beside the agents.
- **A run that ends stops its preview first** (`@plitzi/cli`): its record goes, the preview stops its server on it, and
  only then the run's folder — removed under it, the server's own watch restarted it in a folder gone (`uv_cwd`).
- **A plan lists the job piece by piece** (`@plitzi/cli`): `inventory: [{ id, piece, page, leftOut? }]`, each piece
  covered by a line of acceptance a command proves (`{ said, check, covers: [id] }`) or left out with its reason — `run
plan` refuses one that is neither, and the report says who covered each. The lead's coverage was a skill's advice:
  la-velada's first run left the tier list, the live stream and a dozen pieces unsaid.
- **The scope of an open run changes, said** (`@plitzi/cli`): `run amend` removes a task nobody took — never one taken
  or one another waits for — and changes the inventory, checked again over what is left; the plan and its primer move
  into the run's folder at `run open` (`inputs/`), where the lead edits them.
- **Why a task waits is said** (`@plitzi/cli`, `@plitzi/sdk-dev-tools`, `@plitzi/sdk-shared`): a pending task names the
  tasks it starts after, a waiting one its file, a blocked one what blocks it — in `run status`, `run monitor` and the
  Run tab (`why` in the snapshot); the Run tab's Needs attention scrolls on its own.
- **A run closes only once nothing needs attention** (`@plitzi/cli`): `run finish` refuses an unread message, an
  unanswered proposal, a block, a person's step, a version to re-pin or what was left in the project's `tmp/`, each
  said where it is resolved.
- **An image still coming is not one that failed** (`@plitzi/sdk-authoring`): `page check` waits up to 20 s for the
  images on their way and says one still loading apart from one that failed — under many checks at once a CDN answered
  late, and every acceptance on a page failed on it.
- **The run keeps moving when one piece waits** (`@plitzi/cli`): `task next` no longer offers a ready task whose file
  another task holds (agents were refused three times and stopped) — it says whose, and `--follow` waits; when every
  designer is at a task of its own, the UI reviews are the lead's too, and the run's view says so; a task handed back
  names its copy; `run monitor` says who reviews each task, what else each agent holds, and how many UI reviews wait for
  a designer.
- **`page check` in a task's copy is held to its part** (`@plitzi/cli`): findings on elements other tasks write are
  said apart and fail nothing (the finish checks the whole result); a link of stacked blocks (an eyebrow over a name) is
  no longer a wrapped label.
- **A plan's unit that is a folder** (`@plitzi/cli`): backed up as a path before it exists, it is read as no file once
  the run makes it, and put back by going once empty — the preview's sync stopped an approval on it.
- **The finish checks the result with its pictures** (`@plitzi/cli`): the copy the whole result is checked in carries
  the binaries of `public/` and `vendor/`, as a task's copy does; an image the browser was answered for is loaded though
  it draws no size of its own (an SVG with only a viewBox); `task look` names a path with a query safely.
- **The finish runs again only what did not hold** (`@plitzi/cli`): each acceptance line that passed on a result is
  kept for it (an hour), and the next finish on the same result runs only the others — said ("N as before, the rest run
  again"); a whole set run again for one line a CDN was slow on asked the same thousands of images once more.
- **A page whose images come slowly still answers** (`@plitzi/sdk-authoring`): `openPage` waits for the document and
  then for its requests to quiet, never for `load` — a CDN slow to send the images made `page check` say nothing answered
  at all.
- **An image its host held back is not the page's failure** (`@plitzi/cli`): an image answered 429 (ask again later),
  or dropped with no answer while its host answered the page's other requests — a CDN's limit, met by a run's checks
  asking at once — and the browser's console line for it are said apart
  (`throttled`, "held back by their host") and fail nothing; la-velada's checks failed on the original's CDN. A console
  error of a document embedded in the page (an iframe's — a video player) is said apart the same way (`fromEmbeds`).
- **A run's activity is the whole of it** (`@plitzi/cli`): the log holds every step from `run open` (the plan, its
  team, its estimate) to the finish — each failed check with what failed, a refusal and a crash with the command (its
  token redacted), a look, a review taken, a UI review skipped, a brake, a preview that could not sync — and `run
monitor` shows each as it comes, a problem in red.
- **A run audits itself before it closes** (`@plitzi/cli`): `run report` and `run finish` read the activity for what
  does not add up — a task done with no approval, a review that waited over ten minutes, three rounds or more, many
  failed checks, the same refusal again and again, a crash, a brake — and say it in the report, approved or not.
- **The lead is seen at work** (`@plitzi/cli`): `run monitor` reads the lead's state off its last action, never idle
  while it fixes a detail; each row says how long it has stood where it is, each agent its role.
- **Moves between pages drawn as view transitions** (`@plitzi/plitzi-sdk`, `@plitzi/sdk-shared`, `@plitzi/sdk-authoring`):
  `settings.viewTransitions: true` draws each client-side navigation as one view becoming the next — the pages
  cross-fade, and an element named the same on both (`view-transition-name`, now a property the style engine and
  authoring know) moves from one place to the other; it waits for the new page to be laid out (at most a second), and
  is skipped where the browser has none or the visitor asks for less motion.
- **A hidden embed loads nothing** (`@plitzi/sdk-elements`): an `embed` hidden by its `visible` (or an ancestor's) sets
  no `src` until it is first shown, and keeps its page after — a frame hidden in CSS is loaded whatever its `loading`,
  so a player behind its poster loaded (and autoplayed) on every visit. In the builder every frame shows what it holds.
- **The activity says what each agent is at, and how the run ends** (`@plitzi/cli`, `@plitzi/sdk-dev-tools`): an agent
  between tasks is logged waiting (and for what), idle once its wait gave up, or stopping with nothing left — shown as
  ◌ waiting / ◼ stopped in `run monitor` and the Run tab; the last approval logs every task approved, and a whole,
  checked dry run of the finish logs the run ready with the person's next step. The designer's changes are logged as
  its UI review (they read as the lead's); a lead going past a UI review a designer took tells that designer, and the
  audit says it, its rounds split by whom; `task tell --about <task>` lets an agent with no task in hand (a reviewer)
  tell the lead; the lead is "working", not "reviewing", at anything but a review.
- **Hand-offs without the wait** (`@plitzi/cli`): what waits on a run — an agent's `task next --follow`, a file's wait,
  a question's answer, the lead's `run watch --until lead`, `task inbox --follow` — wakes the moment the run's folder
  changes, not at its next 10 s look (`runChanged`): a task sent is taken by its reviewer, an approval by the next agent,
  at once.
- **A task asks the review it needs** (`@plitzi/cli`): `task complete --review code` goes to the lead's code review
  alone, said in the activity, `--review ui` has its UI looked at first — by a designer, or the lead when none is free —
  and left out the run decides as before; a lead offered a task whose UI a designer approved is told the code is its.
- **The run's flow** (`@plitzi/cli`): `f` in `run monitor` draws the run from to-do to approved — each stage with its
  tasks and who holds them, what holds an agent back (■ held: blocked, waiting for a file, asking the lead, failed), the
  review split in its UI's and the lead's, and what a review sent back (↺, apart: it goes back to the same agent).
- **Groups open with the mouse** (`@plitzi/cli`): a click on a group of repeated events opens it, each repeat under it,
  and folds it again — ▸ / ▾ left of its time, its repeats hanging right of its words; the wheel scrolls what it is
  over (the tasks' selection, the activity's pages); an opened group is never split by a page. The screen is written
  over in one synchronized frame, never wiped first, and a burst of events draws once (16 ms): it no longer flickers.
- **`run monitor` follows the run live** (`@plitzi/cli`): it watches the run's folder and draws again the moment the CLI
  writes to it — a take, a review, a message, a state (a fifth of a second, not the 2 s it polled at) — and every second
  for its clock; `--interval` is the fallback read (5 s).
- **`run monitor` is a board** (`@plitzi/cli`, `@plitzi/sdk-dev-tools`, `@plitzi/sdk-shared`): what needs someone on top
  (or that nothing does), the tasks left listed and the approved folded in a line naming them (`a` lists them; listed
  once nothing is left), each activity line
  marked by its kind (▶ took · ⇢ sent · ✓ approved · ↺ sent back · ✉ message · ? question · ✗ problem) with its legend,
  and a message said from whom to whom — the agent holding the task — its words quoted, in columns (time, who, task,
  what — the task's empty when it is about none); an event repeated in a row is one line, ×N since when (a refused
  finish once per pass); once every task is approved the lead is ✓ done, saying what is next and whose; a task held on a question to
  the lead says so on its row, its agent (? asks the lead), the head and the Run tab; the legend of the keys stays on
  screen, each area saying its own.
- **The page being left keeps its server sections** (`@plitzi/sdk-elements`): a server provider whose page is still on
  screen keeps its answer while the next page's payload is prefetched — it unmounted its children for that moment, and
  a view transition's picture of the page held nothing to move.
- **One look of a task at a time** (`@plitzi/cli`): `task look` serves a task's copy under a lock — a lead's look and
  its designer's at once stopped each other's server, and one said nothing answered.
- **`run monitor` pages through the whole activity** (`@plitzi/cli`): ← newer, → older, from the plan to now, the page
  said.
- **`run monitor` says who did what** (`@plitzi/cli`): the tasks at work first and the approved last, each approved one
  with who wrote it, its rounds and its time against its estimate (read off the log: an approved task holds no owner);
  a long id cut in the middle; the head counts the tasks by where they stand; the list scrolls with the selection; a
  task opened says who wrote it, who approved its UI and it, and what was sent back or failed; each agent how many of
  its tasks are approved; a task's message is said by the agent that wrote it, once.
- **A stage takes up what the run left out** (`@plitzi/cli`): a piece the run's inventory left out that a stage's
  acceptance covers is waiting no more — its reason dropped, said by `run extend` and in the log; a file the run's
  approved work already holds is no longer said as one the stage makes.
- **`heavy-animation` can be quieted** (`@plitzi/sdk-authoring`): the suggestion is about the elements wearing the
  class (or the element's own style) that runs the animation, and is left out once each of them says `quiet:
['heavy-animation']` — it named no element, so nothing quieted it, and a run's author check failed on an original's
  one blurred entrance.
- **JSON-LD, a page's robots and `robots.txt`** (`@plitzi/sdk-authoring`, `@plitzi/sdk-elements`,
  `@plitzi/sdk-server`, `@plitzi/sdk-shared`): a page says `robots` (`'noindex'`, `'noindex, nofollow'`…) and
  `structuredData` (a JSON-LD object or a list of them, each text a template over the page's server providers as its
  title is — a detail page describes its record), written in the server's `<head>` and kept by the client's;
  `settings.robotsTxt` is the space's `/robots.txt` — every line checked — and a space that says none lets crawlers read
  everything, never its 404 page. `plitzi create` starts a space with both: a `robots.txt` and the home's `WebSite`.
- **What a run's agents tripped on in the CLI** (`@plitzi/cli`, `@plitzi/sdk-server`, `@plitzi/sdk-shared`,
  `@plitzi/sdk-authoring`):
  - Playwright's `test-results/` and `playwright-report/` are ignored by a new project's `.gitignore`, Prettier and
    ESLint: a run's `complete` no longer fails its format check on them.
  - A project's `/health` answers which copy of it serves (`Instance`, `projectMark` of `@plitzi/sdk-shared/project`: a
    hash of its folder, no path said), and `page check`/`page shot` refuse a port that answers with this project served
    from another folder — a run's copies share the name, and one whose port another copy held measured that one, in
    silence. `SSRHealthConfig.instance` says it for any server.
  - `page check --hover <id>` and `task look --hover <id>`: the pointer over an element, and what it changed — how it and
    its elements look (colours, shadow, transform, opacity), what appeared, the flows it ran — or that nothing did; `look`
    pictures it at 1440. `page shot --steps` has a `hover <element>` step.
  - `task show <task> <file>`: one file of a task whole, read from where its diff is — as it went to review, its copy, or
    as approved.
  - `page shot --compare --clip <section>` takes the section's element id as well as its DOM id (`PictureRegion.element`).
  - `comparePictures` never rounds a difference to 0: a hover's colour on one word of a whole screen was said as
    "nothing changed"; any pixel that differs is 0.1% at least.
  - `styles()` refuses in its types a style that writes its rules beside `states`, `variants`, `ancestors`… — on the key
    that belongs under `css`, as `author`'s `rule-set-mixed` does (`UnmixedStyle`).
  - The runs skill serves a copy with `npm run start:dev` and no `PORT`: a free port, written where `page check` looks.
- **The dev tools ask for a run only where there is one** (`@plitzi/sdk-dev-tools`, `@plitzi/plitzi-sdk`,
  `@plitzi/sdk-server`, `@plitzi/sdk-shared`): the Run tab asked `/__plitzi/run` every three seconds on every page in
  debug mode, and every server but a run's preview answered 404 — in the console each time, which failed the e2e that
  opens the dev tools. A preview's server now marks its requests (`req.ctx.runStatus`), the page that may debug is told
  (`runStatus` in its payload, a prop down to `DevToolsContainer`'s `run`), and the tab asks only then. The tab is
  offered from the first run read and stays — a finished run, or a preview gone quiet, leaves the last one read — and a
  tab kept in storage that the page does not offer (Run, QA) shows the logs instead of an empty panel.
- **What velada-more's log showed wrong** (`@plitzi/cli`):
  - A run's report written before a task was approved is behind: `run finish`'s dry run names the tasks it misses and is
    not `ready`, and `--apply` refuses until the lead writes the summary again (`run report --summary` is logged as
    `summary`; la-velada's said the morph was left out — written before t-morph was approved).
  - An approval is logged the moment its task is done, and what it let go after on a line of its own (`handed-on`):
    logged last, an approval whose next steps failed was in the run's work and nowhere in the log (t-tier-list).
  - A failed step keeps the lines that say what failed when its output is cut: a page check's `✗ … at 1440` and its
    findings sit above what it read, and the finish showed only `✓ at 390`.
  - `page check` reads an image another host has not answered yet, while it answered the page's other requests, as that
    host holding back — as a 429 or a drop is — not as the page's image that never loaded.
- **`run monitor` keeps the flow on screen and fits any terminal** (`@plitzi/cli`): the run's flow is the board's
  kanban, always shown under the attention (`f` hides it), its stages in bands on a narrow terminal and its cards fewer on
  a short one — each stage's count in a line where not even a card fits. Fifteen tasks are listed at most, the rest
  scrolled to with ↑↓, and the activity takes every row left down to the terminal's foot;
  the agents go in brief under the tasks below 140 columns; the activity's columns are as wide as what they say; the keys
  and marks wrap rather than being cut; under 24 rows the activity gives its rows to the board. Held to every size from
  60×20 to 220×60 by a test.
- **`run monitor`'s wheel scrolls only what it is over** (`@plitzi/cli`): the tasks' list, or the activity's pages — its
  title and columns too — and nothing over the flow, the head or the keys, where it turned the activity's pages.
- **A stage of `run monitor`'s flow scrolls with the wheel over it** (`@plitzi/cli`): the cards it has no room for
  (`+ 13 more` under approved) are scrolled to in its column, what is above and below said (`↑ 5 · + 8 more`), never past
  its last card.
- **`run monitor` keeps a line's colours when it cuts it** (`@plitzi/cli`): a cut line was written plain — an approved
  card with a long id white in a column of green, an activity row losing its tone; its styles now run to the cut and are
  reset there. A card's id longer than its column is cut in the middle, as the tasks' list cuts one.
- **A `background` with a bare `var(--x)` part is refused** (`@plitzi/sdk-authoring`, `@plitzi/sdk-mcp`): what the
  variable holds decides which longhand it is, and the guess (`background-color`) painted a gradient as nothing. `css()`,
  `styles()` and the MCP's style writes refuse it (`shorthand-ambiguous`, `ambiguousShorthands`), naming the longhand:
  `background-color` for a colour, `background-image` for a gradient or a picture. A var() inside a function
  (`linear-gradient(…, var(--x))`) is read as it is.
- **What la-velada's motion stage showed** (`@plitzi/cli`, `@plitzi/sdk-authoring`, `@plitzi/sdk-mcp`,
  `@plitzi/sdk-dev-tools`):
  - `run monitor` keeps up with a run written to without a pause — five agents, a stage stacked: it reads at most every
    150 ms instead of waiting for a quiet moment that never came, and a read that meets a half-written file (a plan as a
    stage is stacked) keeps the board and reads again, where it ended the monitor. Its head says the stage at work and its
    goal (`stage 3: velada-motion`; `run extend` logs the stage's goal).
  - An agent whose task waits for its review is idle in `run monitor`, saying so, never "in review" as if at work.
  - A completion's note (`task complete --note`) is said on the completion's line of the activity, not again as a message.
  - One `page shot` shows every arrival as it ends — a part clipped or scrolled to too, whose arrivals were taken as they
    began (blank rows) — and `--frames` writes every frame, where only the first was written.
  - `plitzi upgrade skills --write` runs under an open run: the skills change nothing the run is pinned to, and a run's
    own plan asks for them so.
  - A plan's check reads a shell redirection (`2>&1`, `> out.txt`) as the shell's, never as a page of `page check`.
  - `css({ animation: 'none' })` stops the animation: a lone `none` is the name, as a browser reads it, where it was a
    fill mode and left the animation running.
  - The `shorthand-ambiguous` refusal reads as one sentence in `css()` and in the MCP's hint.
  - What la-velada's motion round ran into:
    - `page check --hover` measures width, height, `background-size`/`-position`, `stroke`/`stroke-width` and
      `text-shadow`, and a hover rule written on the parent (`.card:hover .photo`): it reads up to three marked
      ancestors. Under 1024 px it says it skipped the hover, as a phone has no pointer, where it measured nothing.
    - An element at `opacity: 0` with no animation to bring it in is not on screen to `page check` and the testing
      probe (`@plitzi/sdk-authoring`): an arrival that never played was counted as shown.
    - `task complete` says the lint warnings of files the task did not change as there before it, in one line, never as
      the task's to fix; and counts a server on the port as the copy's own only when its `/health` names the copy.
    - A designer with UI reviews coming waits for them rather than taking a developer's task.
    - `npm run start:dev` in a task's copy takes a free port without `PORT` even when another copy starts at the same
      moment (`@plitzi/sdk-server`: a port is held while it is taken).
    - A `css()` refusal raised as the style is written names the line of the author's code that wrote it
      (`src/space/styles.ts:42: \`background: var(--x)\` …`).
    - A condition or a pseudo-element given `variants`, `ancestors` or `conditions` is refused as `style-part-shape`,
      saying where the rule goes, where it was "`ancestors: [object Object]` is not one CSS value".
    - An acceptance line that fails is run once more after the others: one a busy CDN failed passes then, saying it
      passed on its second run; one that fails twice is broken.
    - The runs skill stops a copy's server by its port, never with `pkill -f`.
  - For the next run, from velada-more's report:
    - `task review --skip-design <why>` says why the lead approves before the designer's UI review: `lead` (it looked
      at the UI itself) or `no-ui` (nothing a visitor sees changes). The report, the audit, `run watch` and the monitor
      say each by its reason — "UI by the lead", "no UI" — where all were "UI skipped", read as nobody looking.
    - `run plan` says when too few designers review the UI — one for every three developers keeps the reviews from
      queueing — and how many to start.
    - `task complete` refuses a `space lint` warning left in a file the task changed, there before it or not.
    - `plitzi run notice "…" --on <where>`: something wrong that no task owns, kept in the run's log, sent to the lead,
      said by the finish and listed in the report — what the next stage starts from.
    - `repeated-css` names `tw('sr-only')` for the visually-hidden CSS written by hand.
    - A whole-page `page shot` loads a lazy `<iframe>` (a map, a player) before it is taken, and names one from another
      site below the first screen: the browser draws it only on screen, so it is blank in that picture — said, with
      `--scroll-to <id> --viewport` to see it, where it was a silent blank box (`@plitzi/sdk-authoring`'s `loadImages`).
    - A project's pace (`run plan`) is its runs' middle task's minutes over its estimate: one clock left running no
      longer moves it.
    - A plan names the site it copies (`"reference": "https://…"`), and `plitzi run reference` keeps it once the run is
      open — each page of the inventory pictured and its words measured at 1440 and 390, both schemes, in the run's
      folder. `page shot --compare` on that site measures against what was kept and says when (`--live` asks the site
      now): la-velada's original redesigned its pages after the copy. The run finishing removes it.
      Keeping it names each page's section headings no piece of the inventory covers — what the plan may have missed —
      and never keeps a page the site answered with an error (a 429 or 503 is asked again later).
  - The workspace's ESLint no longer has a `quotes` rule — Prettier's `singleQuote` writes the quotes, and the two
    disagreed on a string holding single quotes; the `eslint-disable quotes` directives that worked around it are gone.
  - A task's copy served for a look (`task look`, `run preview --task`) is stopped whole on Linux too: its server was the
    shell's child there (`sh` is dash), and stopping the shell alone left it listening — under the CI, the CLI's test
    worker waited on it until the job's six hours ran out.
  - An element's `motion` takes `easing` (a CSS curve: a keyword, `cubic-bezier(…)`, `steps(…)`) and `distance` (px, for
    an arrival that travels — `fade-up` rises 24 unless it says 20), so a copy plays its original's arrivals with the
    presets rather than keyframes of its own (la-velada wrote eight). `@plitzi/sdk-shared` validates them, the SDK's
    stylesheet plays them, the builder's Motion tab has a Curve and a Distance field, and the skills, the MCP guide,
    `plitzi explain motion` and the docs say them.
  - Fewer steps and tokens for a run's agents, from what velada-more's spent them on:
    - `task context --files` says how to call what the task's files import from the rest of the project — each name's
      signature and the first sentence of its doc, through a barrel, never its body: the shared modules every agent
      read whole (two of la-velada's pages: 43k characters, said in 3k).
    - In a task's copy whose own server is not running, `page check` and `page shot` serve the copy for the command and
      stop it after: no server to start, wait for, find and stop by hand (64 steps across the run).
    - `task check --acceptance` runs only the acceptance's commands, the copy served for them: an agent fixing one line
      no longer waits for author, lint and typecheck each time (52 of velada-more's 88 failed checks were one).
  - `page shot --compare` reads each text as it is drawn — in the capitals its `text-transform` draws — and pairs the
    same words in other capitals as one text whose case differs (`case Logotipo → LOGOTIPO`), where la-velada's
    comparison listed every heading twice, once on each side (`@plitzi/sdk-authoring`'s `pageTexts`, `compareTexts`).
    - `run reference` takes a page whose picture times out (a font that never loads) as that page's failure, asked
      once more — it crashed the command with every page after it.
    - `run plan` says an element a check expects and the space lacks once per check, where a check expecting four
      texts of it said it four times.

