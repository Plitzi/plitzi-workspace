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

A team of agents on one project (`plitzi run`, `plitzi task`), the page tools those agents measure with, and what
authoring and the elements learnt from the runs.

## To do when you upgrade

- **Node 24.** Every package's `engines` is `^24.22.1 || >=26.12.1` (Node's security release of October 2026); Node 22
  is no longer supported. `plitzi doctor` says `node-too-old` and `node-unpatched`, and an older project's `engines`
  as `engines-behind`, which `doctor --fix` raises. `undici` is `^8.12.3`.
- **The CLI's part of a project is `.plitzi/`.** What authored the space, the compiler options and the CLI's records
  lived in `plitzi/` and `.plitzi/`. `plitzi doctor` says `older-layout`, and `doctor --fix` moves them, with the
  scripts, the `tsconfig*.json` and the ignore files. `plitzi upgrade` asks for it first. A tsconfig has to name
  `.plitzi/**/*`: TypeScript skips a dot folder named bare.
- **`PLITZI_TOKEN`** replaces `PLITZI_TASK_TOKEN`. `task block --needs person` and `run open --agents` are gone: only
  the lead talks to the person, and the team's size is how many agents work at once.
- **`plitzi upgrade`** brings the new scripts (`start:preview`, the visual suite's own server on port 8400) and the
  team file's `about`. `upgrade --write` waits for an open run unless `--with-open-runs`; `plitzi run upgrade` upgrades
  under an open run without breaking it.

## Several agents on one project (`@plitzi/cli`)

An agent works a project alone by default. A team is a mode the person asks for — "several agents", "in parallel",
"subagents", in any language — and the skills, the project's `AGENTS.md`, `plitzi --help` and `run --help` say how to
start one. How it works: `docs/en/agent-runs.md`.

### The run

- `plitzi run start "<the ask>"` checks what a run needs (a space in code, Chromium, the harness) and opens it on its
  scope: a **spike** the lead ends with the tasks it found (`task spike s-scope --done "…" --tasks <stage.json>`). A plan
  also opens directly (`run plan`, `run open`). Either way every file a task touches is backed up first.
- **A plan is held to rules:** no file in two tasks, no cycle, ownership read off the imports, and a module only a page
  imports belongs to the task that names it. Its `inventory` lists the job piece by piece. Each piece is covered by an
  acceptance line a command proves (`{ said, check, covers }`) or left out with a reason (`leftOut`). `run plan`
  estimates at the project's own pace and warns of what is risky: files two tasks touch, exported contracts, checks it
  could not run, values no line measures, too few designers.
- **`run rehearse`** plays a plan out before any agent starts: the schedule, the critical path, the lead's queue and the
  run's length for each team size.
- **Each task works in its own copy** under `tmp/plitzi-runs/`, cloned copy-on-write, with `public/` binaries and no
  `.env`. `task complete` refuses changes to another task's files, takes free shared files by turns (or requests them),
  and runs the project's checks there.
- **Approved work merges into the run's, never into the project.** The person applies the run with
  `run finish --apply`, after the lead's report. The finish runs every done task's acceptance again on the whole result,
  and asks the person before it writes anything. A lead may apply it only when the person allows it, at their terminal
  (`run open --lead-finishes`, `run allow-finish`).
- **A run grows and changes while open:**
  - `run extend` stacks the next plan, with `--dry-run`, and `--lines` to try a stage's lines on the run's work first.
  - `run amend` corrects titles, acceptance, notes, findings, roles, quality, `dependsOn`, the inventory and the
    reference, and removes a task nobody took. A done task's acceptance only is amended; the finish holds it to the
    amended line.
  - `run pending` lists runs not yet applied. `run resolve` settles a file a person changed meanwhile, and `task
revert` takes back an approval.
- **A run closes clean:** nothing unread, unanswered or blocked, and nothing left in the project's `tmp/`. Its servers,
  preview and kept browser are stopped, its folders removed. Its report stays in `tmp/plitzi-reports/`.
- **What a run noticed and left** becomes the project's backlog (`run notice --on`, `.plitzi/backlog.json`, `run
backlog`), offered to the next plan. What got in the agents' way in Plitzi goes to `.plitzi/feedback/<run>.md`
  (`run notice --plitzi`), for the person to share.

### The team (`.plitzi/team.json`)

- **The lead and its agents:** each agent's roles (`developer`, `designer`, `reviewer`, `tester`, `writer`, or the
  project's own), `count`, `model` (or one per quality level), `effort`. Edit it by hand, or with
  `plitzi run team set <name> …`.
  - The file is checked as it is written — `run team check`, `doctor`, a JSON Schema in `@plitzi/cli/schemas`, a
    misspelt key said with the one it meant.
  - A new project starts with two developers (one on demand) and a designer.
- **`min`:** that many start with the run; the rest are **on demand**. `run watch --until lead` names the agent to start
  when work waits for one, and an agent with nothing left stops by itself.
- **`sessionPerTask`:** an agent works one task a session. It stops once its task is complete, and the lead starts it
  again with a fresh context for the next task, or for its own task if it is sent back. Fewer tokens for an agent that
  would otherwise carry several tasks in its context.
- **Leads:** one for every four agents (`lead-2`, `lead-3`…, or `"lead": { "count" }`). Co-leads review and answer
  questions from one queue and are started only when reviews queue up; planning and the finish stay with `lead`.
- **A designer reviews the UI of other tasks before the lead.** `options.designReview` (`light`, `standard`, `high`)
  says how closely. `task review --skip-design lead|no-ui` says why the lead skips it.
- **A tester writes `<id>-tests`** after each developer task.
- **Quality levels:** a task's `quality` (`light`, `standard`, `high`) picks the model a level, and work is taken by
  urgency.

### Who calls

- **Every agent has a token** (`<run>.@<agent>.<secret>`). `run agent <name>` makes it, with the agent's own CLI
  beside it (`scratch/<agent>/plitzi`), which passes the token on every command, in a task's copy too. An agent started
  by hand names itself once (`--agent <name>`).
- **Without its own token a caller is refused** (`identity`, exit 26). This covers a name alone, an empty or foreign
  token, a task's token, and a name not of the team. The readings anyone may ask are the exception (`run status`, `run
report`, …).
- **The lead's actions are the lead's** (`lead-only`, exit 25), and a person's are typed at their terminal.
- **`run agent <name> --launch`** starts an agent headless in Claude Code, Codex or opencode.

### Working a task

- **Getting work:** `task next --follow --take` hands an agent its own task first (sent back, unblocked, with what its
  review asked), then the most urgent ready one. It says why a task waits, and "You can stop" only when nothing can come
  back to it. Commands that wait stay under a harness's 10-minute limit (`--follow`: 8 minutes) and wake the moment the
  run changes.
- **The brief:** `task context` gives the plan's `primer`, the run's notes, the task's findings and acceptance, its
  files' sizes and data, and how to call what they import. `--files` adds the files themselves.
- **Checks:** `task check` (`--fix`, `--acceptance`) runs what `complete` will hold the copy to, without completing. A
  pass stands while nothing changes, and a failure that is not the copy's own is said apart. `complete` refuses
  authoring warnings and suggestions, lint warnings in changed files, and a file past 400 lines.
- **Talking:**
  - `task ask` is a question that waits for an answer; `task tell` is for the lead to know.
  - `task message` reaches a task, an agent or `all`; `task inbox` reads them.
  - `task propose` and `task answer` are agreements between tasks; `task request` asks for a change in a shared file.
  - `task progress --step` says in words what the agent is at.
- **Reviews:**
  - `task show` shows a task as the lead reviews it: each diff, one file whole, what went to review.
  - `task look` looks at a task in one command: served, checked, pictured light and dark, its parts beside the run
    before it (`--before`).
  - `task review --approve | --changes`, then `task reassign`.
  - A review taken and not decided is handed on; a task past three rounds goes back to the lead.

### Watching a run

- **`plitzi run monitor`:** a live board in a terminal of its own. It shows what needs someone, the tasks and their
  flow as a kanban, each agent's state, and the whole activity, paged. It works with the mouse, fits any terminal and
  only reads.
- **`run watch --until lead`** wakes the lead once for each review, question, block, idle agent or agent to start.
  `run status` gives the same in one answer.
- **`npm run start:preview`** serves the run's approved work as it grows; `run preview --task` serves one task's copy.
  The page's dev tools show the run in a **Run** tab.
- **The report and the bench** (`run report --summary --tokens`, `run bench`):
  - The flow: minutes, rounds, waits, checks and refusals by task and agent.
  - The cost: each command's output, time and median against its budget.
  - The harness's tokens, beside a lower bound of what was read again.
  - An audit of what does not add up.

### Faster and lighter for the agents

- **The other site is kept:** its pages are read without a picture and kept for 6 hours. Its HTTP files are cached on
  disk (`tmp/plitzi-cache/http`), and a browser kept between commands holds its pages loaded. Stateful reads — a click,
  a play, an outline — take a warm page from it: 2–5 s where a cold load took 10 s or more.
- **A copy is served for a command when nothing serves it,** and kept three minutes for the next.
- **The checks:** `author` runs first, then the rest three at a time. `typecheck`, `lint` and `format` keep caches, and
  a pass on one result is kept for the day, so the finish does not run it again.
- **Less to read again:** `page measure` says the other page and what it compares once, above every element; `task
context` gives signatures instead of bodies; a wait is logged once per reason.

## Page tools (`@plitzi/cli`, `@plitzi/sdk-authoring`)

- **`page check`** reads a page as a visitor's browser draws it:
  - `--expect <id>~<text>` holds what a page says, and `--then` goes on by the page's own links.
  - `--element`, `--hover`, `--click` and `--fill` say what an element shows and what an interaction changed.
  - `--status 404` checks a not-found page; `--themes` checks a fixed ground under theme-aware text.
  - It reports `heading-skipped`, `control-unnamed`, `label-wraps` and `flush-edge`.
  - Images a host held back (`throttled`) or that are still loading are said apart from the page's own failures; an
    empty layout shell is said as empty, not hidden.
- **`page shot`:**
  - `--width 1440,390`, `--steps` (click, hover, type, drag, scroll, press, wait, wait-for), `--fill`, `--clip`,
    `--scroll-to` and `--frames`.
  - `--compare <url>` sets the page beside another site section by section: the texts that differ, paired whatever
    their case or marks, and each section's dress (gradients, glows, filters, ornaments, background pictures).
    `--dress` fails where a look is missing.
  - Lazy pictures and frames are loaded first, and animations are held still.
- **`page measure <path> "<ours> => <theirs>" --compare <url>`** gives computed styles beside the other site's, every
  element at every width in one call:
  - What it reads: type, colours, borders, spacing, size, `x`/`y`, `list-style`, transforms, transitions,
    `::before`/`::after`, and a state (`--hover`, `--focus`, `--click`).
  - `--same <properties>` fails unless they match, lengths within half a pixel and a box's size within a thousandth.
  - An element is named by its name, a selector, or its name with a selector on it (`product-dot:nth-child(3)`).
- **`page outline`** lists the shown elements of either page, each by a selector `page measure` takes, with
  `--within`, `--depth` and `--click` to say what the click opened.
- **`page play <path> --steps … --read …`** plays an interaction and says after each step how far each element moved,
  whether it is shown and whether it takes a press. With `--compare` it plays the other site beside it, and
  `--same moved,shown,enabled` turns that into an acceptance line.
- **`page same`** says whether pages draw the same on two servers.
- **`plitzi explain`** answers "does Plitzi have a way to…". It covers elements and the fields their source publishes,
  steps, triggers, style states, global sources, template filters and functions, a server action's steps
  (`--list tasks`), codes, CLI commands and an export's fields.
  - `explain --search "<words>"` also reads the skills' references and recipes, so it answers with the page that
    teaches it.

## Authoring (`@plitzi/sdk-authoring`)

- **Pages registered by being there:** `pagesIn(new URL('./pages/', import.meta.url))` (`@plitzi/sdk-authoring/node`)
  loads a folder's pages, and `PageSpec.nav` with `navOf(pages)` gives a layout its menu.
- **A page's `robots` and `structuredData`** (JSON-LD, a template over its server providers), and
  `settings.robotsTxt`. `plitzi create` starts a space with both.
- **`settings.viewTransitions: true`** draws client-side navigation as view transitions; `view-transition-name` is a
  style property.
- **An element's `motion`** takes `easing` and `distance`.
- **New checks, each with its way out:** `page-path-unknown`, `list-items-outside-answer`, `span-holds-block`,
  `anchor-in-row`, `controls-other-row`, `variant-bound-twice`, `font-weight-not-loaded`, `template-text-into-value`,
  `shorthand-ambiguous` (a `background` with a bare `var()`), `shorthand-unread`, `ancestor-shape`, `state-shape`,
  `style-part-shape`, `rule-set-mixed`, `source-name-missing`, `page-nav-invalid`. `click-on-static-element` now
  catches an empty list item with a click.
- **What was written and silently lost is refused or fixed:**
  - `font: inherit` sets every font longhand, and `css({ animation: 'none' })` stops the animation.
  - A screen width written as a condition names the per-breakpoint value instead.
  - A refusal raised as a style is written names the author's line.
  - `heavy-animation` can be quieted on the elements that run it, and `repeated-shape` tells forms apart by their fields.
- **The testing helpers** used by the page tools are exported: `openPage`, `inspectPage`, `pageTexts`, `compareTexts`,
  `pageDecorations`, `compareDecorations`. Every export carries a doc.

## Elements and the SDK (`@plitzi/sdk-elements`, `@plitzi/plitzi-sdk`, `@plitzi/sdk-shared`)

- **An anchor in a list's row is the row's own** (`faq-answer-luna`), and a button's `controls` points at its own row.
- **A native disclosure:** `container({ subType: 'details' })` with a `summary`.
- **A carousel publishes `atStart`, `atEnd` and `shown`**, and steps `by: 'page'`.
- **Forms:** a required `<select>` is required. Buttons and textareas take the page's font.
- **Links:** a link to a URL with a scheme is followed as written in any mode.
- **Loading and navigation:** a hidden `embed` loads nothing until it is shown, and a page being left keeps its server
  sections while the next one is prefetched.
- **Small fixes:** a toast's close button shows its focus, and the dev tools never print.
- **Templates (`@plitzi/sdk-shared`):**
  - `date` reads epoch seconds, and `'now'|date(…)` is the moment of the render.
  - `<`, `>`, `<=` and `>=` order strings as text.
  - `replace({…})` takes Twig's map form.

## Server (`@plitzi/sdk-server`)

- **`list.put`** refuses a value written as JSON that does not parse.
- **`/health` says which copy of a project serves**, and a port is held while it is being taken.
- **A run's preview** answers `/__plitzi/run`, and only a preview's pages ask for it.
- **The server's budget is loaded again:** the filters' catalogue and the pages' rule are entries of their own that the
  server never reads.

## Dev tools (`@plitzi/sdk-dev-tools`)

- A **Run** tab, offered only on a run's preview: progress, the tasks by where they stand, the agents and what needs
  someone.
- The panel scrolls again.

## The workspace

- **No file past 600 lines of code:** the shared lint config sets `max-lines`. The longest files are now folders of
  modules, with the same exports.
- **ESLint's `quotes` rule is gone;** Prettier writes the quotes.
