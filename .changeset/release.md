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

- **`run amend` keeps the tasks of tests the run made** after a developer task the plan keeps: encore-2's amend of a stage
  dropped three, "nobody had taken them", with the proposals sent to them.
- **An agent starts with its own identity, never its launcher's:** `run agent --launch` hands the harness the agent's
  own token and session, and none of the lead's (`PLITZI_TOKEN`, `PLITZI_AGENT`, `PLITZI_RUN`). encore-2's agents
  inherited the lead's token from its CLI, and a project script's `plitzi space lint` ran as the lead — found by the
  run's own `two-sessions` finding.
- **A task sent back to an agent that is not running reads as waiting for it, not silent:** the lead is told to start
  it again, and no longer "no signal — reassign it" beside that (encore-2's t-room-read said both at once) — and
  `run upgrade` no longer waits for it: nobody is writing it, and its copy is kept (encore-2's waited an hour on it).
- **`task complete` runs the approved tasks' lines on a copy still served:** the server lent for the task's own lines
  was stopped once they passed, and every approved line on the same pages read "nothing answers" — encore-2's
  t-room-side was refused three times as breaking five lines it had not touched. An approved line nothing could answer
  is now told to the lead, as one of the task's own, and not held against the task.
- **A lead's `task look` at a task whose review is its own takes the review,** said in the activity as `task next --take`
  says it: encore-2's lead looked and approved, and the person following the run saw nobody take its reviews. A look
  while the designer's UI review is due takes nothing.
- **A line amended while its task waits in review is the one the finish holds it to:** `run amend` replaced the lines
  of done tasks alone, so encore-2's t-playback-safety, amended in review, was approved on its old line and the finish
  refused the run on it.
- **The run starts its own agents — the keeper** (`plitzi run keep`): with the team's `options.launch`, the agents the
  run asks for are started whatever the lead is doing — the base when not running, one on demand for waiting work, one
  a task was sent back to. `run open`, `resume`, `attach` and the lead's `run watch` start it, one a run, its log in the
  run's cache. Only the lead's watch started them before: encore-2's ready tasks waited with no developer running while
  the lead reviewed or wrote a stage.
- **The team's base stays while the run is open:** `task next` never tells one of the base to stop for want of work —
  it waits for a stage the lead stacks, and hears how its own work ended; only one on demand stops. One not running is
  asked for whatever waits. encore-2's designers and tester, stopped once every task was done, were stopped when a
  stage came.
- **Who runs is its process's to say:** an agent the CLI launched runs while its process does — never the log's last
  word, which asked to start dev-1, running, while dev-2 and dev-3 waited stopped. A stop holds until the agent comes
  back for work: a notice sent on its way out no longer reads as "no signal" (encore-2's tester, half an hour).
- **The lead's attention holds only what is the lead's, and now:** a line that failed and passed since, a task refused
  before it was approved, leave it; what is Plitzi's goes to the run's feedback alone. Every task done, the lead's
  summary is refused while anything waits for it — encore-2 ended with ten notices standing, and its lead said "done"
  before stacking a stage.
- **The report tells each agent's life** — started, took, completed, reviewed, waited, stopped and why; its minutes at
  work, stopped and silent — and the feedback its figures (`lives`): a run read whole after it is gone.
- **A tester reviews code, never a design:** encore-2's test-1 approved the identity system and its components.
- **`task look` with no page named opens its acceptance's pages before the home page,** as a review's offer does — a
  look at a plugin's file pictured the home page, where none of its reactions is.
- **A reviewer's holder command says its review speaks for itself** (its look, its verdict) where it said "holds no
  task at work: name it"; the agent's prompt asks for progress in tasks of its own only.
- **`page measure --click … --hover|--focus …` and `page shot --click … --hover …`:** a state reached in two moves — a
  menu opened, an item of it hovered — measured and pictured; `measure` refused it as two states, `shot` had no
  `--hover`.
- **`task show` shows 400 lines of diff in all,** each file past them said with its size and how to read it:
  encore-2's reached 44k characters, read 77 times.
- **The dev tools' panel shows what its badge counts:** opening it from the badge mounted it again elsewhere in the
  layout, and the logs it kept were gone — a warning on the badge, none in the panel. It starts from the page's log
  history (`pConsole.history()`), and Clear empties that too.
- **A `complete` whose checks fail names what it took from the run** on that complete, with how to read each — encore-2's
  test-1 checked green and failed on a file approved since, with no word of which had come in.
- **`task review --skip-design lead` approves only after a `task look`** of the task since its last complete.
- **`task look` reads signed in as its acceptance checks it** (`--as` from the acceptance), and a page check refused 401
  or 403 says who it was signed in as.
- **A plan's element ids include its components' parts,** so an acceptance naming a part of a component is not refused
  as unknown; **`run amend` keeps the run's primer** when the plan names one that is no longer beside it.
- **A failing test is said by its name first** (`✖`, `FAIL`, `not ok`, an `…Error`), before the lines around it.
- **The report and the feedback say what each brief weighed** — primer, brief, files, shapes, imports, per task — so a
  brief that grew is seen.
- **`page measure` reads `outline` and `outline-offset`,** and `--focus` focuses by the keyboard, so `:focus-visible`
  draws as a visitor tabbing sees it.
- **`page play` says where a shown element is when it is not plainly there:** partly or out of view, under another
  element, and its transform — a dialog scaled to nothing was "shown".
- **A part new in the run is pictured alone** in `task look --before`, saying the run before has none of it, rather than
  failing the comparison.
- **The space's failure page is recognised** (`<meta name="plitzi-space-failure">`, `SPACE_FAILURE_META`): a measure on it
  says the space failed to render instead of measuring the error page.

- **A tester starts on the strongest model, as a designer does,** when its entry names none (`ROLE_MODELS`): its tests
  and its review are what stop a bug or a regression getting through. A model the file says always wins.

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
  A task it still holds from an earlier session waits for the next one, named when it is told to stop.
- **`resumeSession`:** an agent started again after it died with a task in hand resumes its own session (Claude Code's
  `--resume`), so it keeps what it knew and had not written yet. It starts fresh instead, saying why, when its session
  is gone or past 8 MB. The starter team asks it of every agent. `run agent --launch` refuses to start a second session
  of an agent that is still running.
- **`options.startGraceMinutes`** (3 when not said): an agent just started does not read "no signal" or "not running",
  so `run watch` no longer wakes the lead for every agent it has just launched.
- **An agent whose process ended is not running**, whatever its last word in the log. An agent launched by
  `run agent --launch` that has ended reads stopped on the board, and `run watch` asks for it again when work waits:
  a UI review with no designer running says which designer to start, at once.
- **A stage's checks read the run's work,** not the project the finish has not written yet: `run extend` no longer says
  every element the run made is missing.
- **`--as` in the finish:** any folder of a run — a task's copy, the finish's checked copy — signs in with the project's
  `.env`.
- **`task complete` runs again the lines of approved tasks on the pages it changes:** one it breaks refuses it, naming
  whose — or, when the change means it, `--known-failure "why" --fixed-by lead` and the lead amends the line. Found
  before review, not at the finish.
- **`task look` fills a route no link reaches** with the parameters another page's address gave (`/r/:slug/stats` at
  the `night-drive` of `/r/:slug`).
- **`page check --then` follows the link a visitor sees at that width,** and says when every link there is hidden (a
  nav behind the burger). **`page check --url` on a run's preview** judges by the run's work, not the project's.
- **`server stop --port` on a run copy's server** says whose it is and where it is stopped from.
- **The activity names a task once,** in its column: "approved (round 2)", not "approved t-shell (round 2)". An agent's
  row names it before what it last did.
- **The lead reads working on the board** while its commands come (a stage stacked, an agent started, a message), with
  what it last did, and idle only once they stop. `run agent --launch` is in the run's feed: "started dev-2 in claude".
- **`options.launch`** (a harness, `claude`): `run watch --until lead` starts the agents work waits for itself, rather
  than asking the lead to, and says the ones it could not start.
- **Leads:** one for every four agents (`lead-2`, `lead-3`…, or `"lead": { "count" }`). Co-leads review and answer
  questions from one queue and are started only when reviews queue up; planning and the finish stay with `lead`.
- **A designer reviews the UI of other tasks before the lead.** `options.designReview` (`light`, `standard`, `high`)
  says how closely. `task review --skip-design lead|no-ui` says why the lead skips it.
- **A tester reviews the code, then writes `<id>-tests`** after each developer task. `task next` hands it the reviews
  first, as a lead that reviews; its approval approves the task, and the lead is woken only for a review no tester took
  in 2 minutes. With no tester in the team, the lead reviews every task.
- **The starter team names its models:** the lead on `claude-opus-5-5` at `"effort": "high"`, the designer on
  `claude-opus-5-5`, the developers on `claude-sonnet-5-5`. They are `team.json`'s, never the CLI's: one it leaves out is the harness's default. A lead that
  reviews (`lead-2`) starts on the team's lead model. A model the team names is passed only to a harness that runs it
  (Claude Code a Claude one, Codex any other, opencode `provider/model`); otherwise the agent starts on the harness's
  default, and `run agent --launch` says so.
- **`effort`** for the lead and each agent (`low`, `medium`, `high`, `xhigh`, `max`; `run team set --effort`) is how hard
  it thinks: Claude Code's `--effort`, Codex's reasoning effort (`max` is its `xhigh`). Left out, the harness's own.
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
  `--fresh` drops ESLint's kept answers too, so a type fixed in an imported file clears its importers.
- **Talking:**
  - `task ask` is a question that waits for an answer; `task tell` is for the lead to know.
  - `task message` reaches a task, an agent or `all`; `task inbox` reads them.
  - `task propose` and `task answer` are agreements between tasks; `task request` asks for a change in a shared file.
  - `task progress --step` says in words what the agent is at.
- **Stopping a server:** `plitzi server list` and `plitzi server stop [--port <port>]` stop only what listens from the
  folder they run in and says, by its `/health`, that it serves that folder — with what it started. Anything else on the
  port is named and left alone. The agents' rules forbid `pkill`, `killall` and killing by name, leave a hung command
  to the harness, and write files with the edit tools instead of a shell heredoc. An agent once freed a hung heredoc
  with `pkill -f "cat"` and took the machine down.
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
- **The run reports itself; the lead keeps no list of problems.**
  - Each round, as its agent completes it, is kept beside its task (`tasks/<task>/reports/<round>.json`). It holds:
    - its time, its sessions, its checks and refusals;
    - each command it ran, and why one failed;
    - what it asked `explain` and found nothing for;
    - its notices of Plitzi;
    - what it was like to work with Plitzi, in its words: `task complete --ease <1-5> --hardest "…"` (asked before
      anything runs), and `--friction "…"` and `--helped "…"` for each thing;
    - what its harness spent. For Claude Code that is read from the session on the machine: turns, tokens and the
      results read again the most.
  - **Findings:** one list read off the run's records, each with its evidence, whose it is (Plitzi's — CLI, platform
    or docs —, the lead's, the agents', the machine's) and what would stop it. It covers:
    - an agent holding two tasks, in two sessions, or working on after it was told to stop;
    - a check answering two ways on the same work, a line failing three tries, a step run again rather than read, a
      task breaking what an approved one was accepted on;
    - `explain` misses and topics asked three ways;
    - the lead's own scripts and the agents' scratch scripts and packages, what two agents said of Plitzi;
    - commands refused as written, the machine's errors;
    - answers over 12k characters, costly tasks and contexts, results read again the most;
    - what the audit and the run's facts said before.
  - `run watch` says the live ones as they happen. `run report` starts with them, by whose. `run finish` points at them.
    The bench counts them run after run.
  - **The experience, combined:** the lead says its own with its summary (`run report --summary … --ease --hardest`).
    The run puts every round's and the lead's together: the ease by agent, the hardest rounds, and what cost the most,
    got in the way or helped, grouped when several said it alike, with who said it. Frictions join the notices in the
    findings, so one complaint from three agents is one thing to fix. The bench keeps the ease run after run.
  - **The run's feedback to Plitzi** consolidates the agents' round reports, the lead's report and experience and
    Plitzi's findings, as `.plitzi/feedback/<run>.md` and a `.json` to analyse across runs. `plitzi feedback` stays a
    single agent's.
  - Every command keeps its session and, when it fails, why and the lines that say what failed (a page's console errors
    and failed requests among them). A `task check` keeps what it ran on and what each failing step said.
  - **The harness's spend for Claude Code, Codex and OpenCode,** read from the sessions each keeps on the machine (Codex
    and OpenCode found by their process and the project's folder), with the model, effort and version each ran on, and
    Plitzi's own files each read — the skills and packages' types a doc fix starts from.
  - **What a fix reads without running anything again:** why each line or step kept failing, in the findings; what each
    review asked when it sent a task back; and the agents' scripts, copied beside the report before the run's scratch
    goes.
- **Every `plitzi …` the CLI tells anyone to run is one it takes:** a test reads the skills, the agents' prompt and every
  message of the CLI through its own parser. That is how `task complete --follow` reached three agents. The command
  registration lives in `program.ts` (`buildProgram`), for that test.
- **The expected end follows the project's pace:** a run's estimates are scaled by how long its tasks took against
  theirs, and a project with no history of its own takes this machine's (`~/.config/plitzi/pace.json`).

### Faster and lighter for the agents

- **The other site is kept:** its pages are read without a picture and kept for 6 hours. Its HTTP files are cached on
  disk (`tmp/plitzi-cache/http`), and a browser kept between commands holds its pages loaded. Stateful reads — a click,
  a play, an outline — take a warm page from it: 2–5 s where a cold load took 10 s or more.
- **A copy is served for a command when nothing serves it,** and kept three minutes for the next.
- **An acceptance stops the agent's own server of its copy** before serving the copy itself, and says so: two servers of
  one copy wrote one `kv` file. A project's Playwright server keeps its own (`PLITZI_KV_FILE`, set by the scaffold).
- **The checks:** `author` runs first, then the rest three at a time. `typecheck`, `lint` and `format` keep caches, and
  a pass on one result is kept for the day, so the finish does not run it again.
- **Less to read again:** `page measure` says the other page and what it compares once, above every element; `task
context` gives signatures instead of bodies; a wait is logged once per reason.

## Page tools (`@plitzi/cli`, `@plitzi/sdk-authoring`)

- **`element-empty`:** `page check`, `inspectPage` and a project's visual tests report an element a visitor sees with
  nothing in it — no words, no picture: a binding to a field the data lacks — by id, with how many list rows drew it so.

- **`plitzi verify`** says a project nothing serves as such — start it — where it asked for an account in `.env`, and
  says apart the pages nothing answered from those sent to sign in.
- **`page check`** reads a page as a visitor's browser draws it:
  - `--expect <id>~<text>` holds what a page says, and `--then` goes on by the page's own links.
    `--expect <id>` alone holds that it is shown.
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
  whether it is shown and whether it takes a press. It reads each element's text, value, focus and `aria-pressed`,
  `-expanded`, `-checked` and `-selected` too. With `--compare` it plays the other site beside it, and
  `--same moved,shown,enabled` turns that into an acceptance line.
- **`page same`** says whether pages draw the same on two servers.
- **`page check --click`, `--expect` and `--element` find a plugin's own parts** by their id, as `page play` does
  (`reactions-more` inside a plugin).
- **`--as` that reaches no server says so,** rather than ending in a stack trace; `--read a,b` says the elements are
  separated by spaces.
- **`--as <account>`** on `page play`, `page measure`, `page outline` and `task look` signs in first, with the account
  of the project's `.env` (in a task's copy, the project's). `fill` is a step of `--steps`.
- **A step on an element hidden at that width** (a burger at 1440) fails at its own step, naming the breakpoint, not
  at the next one.
- **`plitzi functions dev`** says before running what is missing — sdk-server, `isolated-vm`, `core-js`, resolved where
  the runner loads them — and that the project's own `npm start` runs the same functions without the isolates.
- **`plitzi explain`** answers "does Plitzi have a way to…". It covers elements and the fields their source publishes,
  steps, triggers, style states, global sources, template filters and functions, a server action's steps
  (`--list tasks`), codes, CLI commands and an export's fields.
  - `explain --search "<words>"` also reads the skills' references and recipes, so it answers with the page that
    teaches it.

## Authoring (`@plitzi/sdk-authoring`)

- **`space lint` takes a module only its test reads as part of the space,** not an unused file (a palette held to AA
  beside its test).
- **`message-while-running`** warns of a channel's `onMessage` flow that says nothing of a message arriving while it runs
  (the default `skip` drops it): `whileRunning('queue', …)`, `'latest'`, or `'skip'` when meant.
- **A channel's topic with a choice** (`{{ room.locked ? 'vault' : 'room' }}:{{ id }}`) is checked as both words, each
  needing its pattern; one put together otherwise is left to the server, as a bound topic is. Both were refused.

- **Pages registered by being there:** `pagesIn(new URL('./pages/', import.meta.url))` (`@plitzi/sdk-authoring/node`)
  loads a folder's pages, and `PageSpec.nav` with `navOf(pages)` gives a layout its menu.
- **Actions registered by being there:** `actionsIn(new URL('./', import.meta.url))` reads every file of
  `src/actions/` and what each exports — one file per domain, nothing to list; one id in two files is refused naming
  both. New projects start with it.
- **The home page is never the `'*'` page:** with no `isDefault`, the page at `''` is the home, else the first other one;
  a `'*'` page that says `isDefault` is refused (`page-catch-all-default`).
- **`settings` is typed** as the space's settings, so a misspelt one is a compile error.
- **`onView(margin?)`** starts a flow when an element comes into view and when it leaves, with `{ inView }`.
- **`unauthorizedRedirect` written with a query** (`'/sign-in?next=…'`) is refused saying the visitor's address travels
  on its own, as `?redirect=`.
- **A page's `robots` and `structuredData`** (JSON-LD, a template over its server providers), and
  `settings.robotsTxt`. `plitzi create` starts a space with both.
- **Link previews that show a picture.** A page's `seoImage` (a file of the site, an address, or a template over its
  server providers), `seoImageAlt` and `seoType` (Open Graph's kinds). The space says who it is once in `settings`:
  `siteName`, `language`, `favicon`, `shareImage` (for a page with none) and `themeColor` (one, or one a scheme).
  Refused when a head could not read them: `share-image-invalid`, `og-type-unknown`, `space-identity-invalid`.
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
- **`unknown-variant`:** an `activeWhen` that sets a class's variant the class does not declare is warned, naming the
  variants it has.
- **The testing helpers** used by the page tools are exported: `openPage`, `inspectPage`, `pageTexts`, `compareTexts`,
  `pageDecorations`, `compareDecorations`. Every export carries a doc.

## Elements and the SDK (`@plitzi/sdk-elements`, `@plitzi/plitzi-sdk`, `@plitzi/sdk-shared`)

- **No placeholder words on a page:** a text, paragraph, heading, button or field label with no value draws nothing,
  never "Text", "Heading", "Button" or "Label" — encore's room cards read "Text" where their line was bound to nothing.
  The placeholder is the builder's, set from the declaration when an element is placed. An element drawn empty — those,
  and an image with no source — says so on the page (`data-plitzi-empty`).

- **An anchor in a list's row is the row's own** (`faq-answer-luna`), and a button's `controls` points at its own row.
- **A native disclosure:** `container({ subType: 'details' })` with a `summary`.
- **A carousel publishes `atStart`, `atEnd` and `shown`**, and steps `by: 'page'`.
- **Forms:** a required `<select>` is required. Buttons and textareas take the page's font.
- **Links:** a link to a URL with a scheme is followed as written in any mode.
- **Loading and navigation:** a hidden `embed` loads nothing until it is shown, and a page being left keeps its server
  sections while the next one is prefetched.
- **Small fixes:** a toast's close button shows its focus, and the dev tools never print.
- **A button with an icon and no `content` shows the icon alone,** not the placeholder "Button" beside it.
- **Sign out everywhere works on a `createAuth` server as written:** the page takes the server's `revokeUrl` as it takes its
  other auth endpoints (a space had to declare it by hand), and the step answers `{ ok: true }` for a flow to branch on —
  a refusal still fails it. Found by encore-2's dev-1.
- **`authLogoutEverywhere('site' | 'all')`**, the auth source's `logoutEverywhere`: a visitor signs out of the space on
  every device, or out of their account everywhere. `basic` posts to the space's `revokeUrl` (the page server's sign-in
  names it); a provider that cannot is refused, never a sign-out here alone.
- **A `chart` element:** bars, a line, an area or a donut from bound rows (`items`, `labelField`, `valueField`), drawn
  as SVG of its own at its box's width — no library loaded. It takes the colour of the text around it, its parts restyle
  it, and its rows are written as a table a screen reader reads. On the canvas, unbound, it shows a sample to style.
- **`PluginSource`** (`@plitzi/plitzi-sdk`): a plugin publishes a source to the elements put inside it, under its
  declaration's `sourceType` — `{{ player_deck.track }}`.
- **A visitor not signed in, sent from a page to a page of the space, carries `?redirect=<where they were going>`**,
  as one sent to a sign-in elsewhere did, so the sign-in sends them back.
- **Templates (`@plitzi/sdk-shared`):**
  - `ago(locale?)` writes a moment as "4 minutes ago" / "in 3 hours", and `duration` a length in seconds as `3:58`.
  - `date` reads epoch seconds, and `'now'|date(…)` is the moment of the render.
  - `<`, `>`, `<=` and `>=` order strings as text.
  - `replace({…})` takes Twig's map form.

## Server (`@plitzi/sdk-server`)

- **The head a link preview reads is whole:** the page's Open Graph and card, with its picture made absolute (a chat
  never resolves `/og.png`), `summary_large_image` when it has one, `og:url` and `<link rel="canonical">` from the
  public address, the space's icon (Plitzi's only when it names none), its `theme-color`, and `<html lang>` (it was
  always `en`). The page keeps the same tags as it moves (`pageHeadTags`, `@plitzi/sdk-shared/schema`).
- **`list.put`** refuses a value written as JSON that does not parse.
- **Functions by domain:** every file at the top of `functions/` (a space's or a plugin's) may export a definition by
  default; they are merged — a task, route, job or provider said twice is refused naming both files, `limits` is said
  once, `allow.hosts` is all of theirs. A top-level file that exports no definition (a helper, types) is code the
  others import, never bundled as one.
- **The same call made while it runs is answered by that run** (`joined: true`, `X-Plitzi-Joined`), not refused 409.
- **An action's `list` input** takes several values — one per line in the builder, an array from code — with
  `maxItems`.
- **`ctx.presence(topic)`** says who is on a topic of a `presence: true` channel, counted by the server on every
  replica (kept beside the grants in the actions' `kv`, with a heartbeat).
- **`ctx.visitors.get(username | id)`** reads one of the space's people — public fields alone — through
  `lookups.getVisitor`; a server with `auth` answers its own accounts (`auth.publicAccount`).
- **`kv.listSwap(list, id, expected, next)` and `kv.listChange(list, id, change)`** change one entry of a list only if
  nobody changed it first, as `kv.swap` / `kv.change` do a key.
- **A sign-up refused because the account exists names the field** (`field: 'username' | 'email'`).
- **Signing out everywhere, of a site or of the account:** a session records the host it was signed in on;
  `/auth/sessions/revoke` takes `{ scope: 'site' | 'all' }`, and the page server answers `/auth/logout-everywhere` for its
  own host (`endSessions`). The MySQL store adds the column (schema 6) and lists each session with its host. A store of
  your own: `saveSession` keeps `client.host`, `clearSession({ userId, host })` ends that account's sessions there alone.
- **`/health` says which copy of a project serves**, and a port is held while it is being taken.
- **A run's preview** answers `/__plitzi/run`, and only a preview's pages ask for it.
- **The server's budget is loaded again:** the filters' catalogue and the pages' rule are entries of their own that the
  server never reads.

## The builder (`@plitzi/plitzi-builder`, `@plitzi/sdk-elements`, `@plitzi/sdk-schema`)

- **Settings → Sharing:** the site's name, language, icon, share image, theme colour and `robots.txt`, checked as they
  are typed by the same rule authoring refuses on.
- **A page's SEO** takes its share image, its description and its kind, with robots, and shows the link's card.
- **A setting the space had no value for is kept:** the builder wrote a setting only where one was already there, so a
  new one was saved by the platform and lost on the canvas until the next load. `SCHEMA_SETTINGS` lives in
  `@plitzi/sdk-shared/schema` now, for the builder and authoring alike.
- **The MCP's `patchSettings`** writes the site's identity, `robotsTxt` and `viewTransitions` too.

## Dev tools (`@plitzi/sdk-dev-tools`)

- A **Run** tab, offered only on a run's preview: progress, the tasks by where they stand, the agents and what needs
  someone.
- The panel scrolls again.

## The workspace

- **No file past 600 lines of code:** the shared lint config sets `max-lines`. The longest files are now folders of
  modules, with the same exports.
- **ESLint's `quotes` rule is gone;** Prettier writes the quotes.
