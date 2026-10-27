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
- **`plitzi upgrade`** brings the new scripts (`start:preview`, the visual suite's own server on port 8400, `test`) and
  the team file's `about`. `test` is `node --test 'src/**/*.test.ts'`: `plitzi verify` and a run's checks now run the
  project's own tests, so a project whose tests are red fails them until they pass. `upgrade --write` waits for an open run unless `--with-open-runs`; `plitzi run upgrade` upgrades
  under an open run without breaking it.
- **Reports to Plitzi live in `.plitzi/plitzi-reports/`, committed.** A run's — once `tmp/plitzi-reports/<run>-<time>.*`
  and `.plitzi/feedback/<run>.*` — are one folder, `runs/<run>/`; `plitzi feedback`'s page, once in `tmp/feedback/`, is
  `agents/<date>/report.html`. `plitzi upgrade` brings the ignores that keep the folder out of the typecheck, the lint
  and the format (`tsconfig.base.json`, `eslint.config.mjs`, `.prettierignore`): run it before the next run ends. The
  old files are read no more — `run report --bench` and the estimates start again from the runs that end now; delete them, or
  keep them by hand. The feedback's JSON is gone: its data is the report's (`report.json`).
- **The CLI does what it was always told, and its surface is smaller.** `task next` takes the next task and waits for
  one: `--follow --take` are gone — `--no-wait` answers now (the lead's queue of reviews: `task next --role lead
--no-wait`), `--peek` only looks; a team agent's roles come from the team, `--role` only narrows them. `run watch` run
  by a lead ends on what needs it — `--until lead` is gone; a person's follows the run. Page commands read a page that
  sends a guest away signed in as the project's account (`PLITZI_CHECK_USER`) by themselves, and say so — `--as`
  names another, `--guest` reads it as a guest. Folded into another: `task heartbeat` → `task progress` (alone, a sign
  of life); `task claims` → `task claim` with no file; `task proposals` → `task propose` with no task; `run pending` →
  `run status --all`, which lists the runs not written in yet, ready ones first; `run feedback` → `run report --plitzi`;
  `run allow-finish [--revoke]` → `run finish --lead-finishes | --no-lead-finishes`; `run continue` → `run resolve
<run>` with no file; `run prune` is gone — every `run open`, and `run watch` while it follows, prune; `explain
--search "…"` → `explain "…"` (several words are a search). A command or flag written the old way is refused naming
  the new one. Agents' prompts and the skills say the new ones: `plitzi upgrade skills --write`.
- **One command for each thing, read off the CLI itself.** A plan is opened, tried and rehearsed by one command:
  `run plan <file>` → `run open <file> --dry-run`, `run rehearse` → `run open <file> --dry-run --rehearse`, and
  `run open --spike` is gone (a run opens on its scope by itself). `run state` → `run status --all`; `run bench` →
  `run report --bench`; `run note` → `task message all "…"` (every task, the ones taken later too); `run team check`
  → `plitzi doctor`; the `skills` group → `plitzi upgrade skills --write`. `task take <task>` → `task next <task>`.
  A question a task needs answered is a block (`task block`), which the lead lifts with its answer (`task unblock
  <task> --answer "…"`, kept in the report). A file's turn is one command:
  `task wait <file>` → `task claim <file> --wait` (`--follow`, `--timeout` as before), `task release <file>` →
  `task claim <file> --release`. `page same --than <origin>` → `--compare <origin>`, as every page command names the
  other side. The run's work outside the run is one command: `run copy [dir]` → `run preview --copy [dir]`; a file's
  versions one: `run restore <run> <file> --from <backup>` → `run show <run> <file> --restore [backup]` (still a
  person's, confirmed by the run's name); a run's machine one: `run release <run>` → `run attach <run> --release`.
  `run can-write`, a hook's question, is left out of the help. What an agent has in hand — its work, a step of a
  review, a spike — is read one way by every command: a scout at its spike gives `task progress` (refused before), and a
  writer's command names what is held and what ends it. What moves between a project and its space is
  `space pull` and `space push`, a part named: `functions pull` → `space pull functions` (into any project connected to
  the space, as before), `functions push` → `space push functions`, `runtime push` → `space push runtime` (its module is
  `src/runtime/index.ts`: `--entry` is gone). `space push --dry-run` lists the functions' and the runtime's files, and a
  part asked that the project lacks says where it is looked for. `plugin upload` stays: a plugin package's way to a
  space, which `space push` is not. Each old name is refused naming the new one.
- **Research is a card: a kanban.** A research card (a spike) is taken with `task next` as any card — a scout's, with
  its copy and token; the lead finds it out itself with no scout in the team — completed with what it found (`task
  complete --found "…" [--tasks <stage.json>]`) and reviewed by the lead (`task review <card> --approve [--leave
  <tasks>] | --changes "…"`): a left `<id>-tests` is its card with no tests. `task spike`, the `spike` status, its
  own column and `--findings-only` are gone; `task spike` is refused naming the new commands. A run opened before keeps
  working: a card in its old status reads as ready, or in review with what it found.
- **Every card is reviewed one way: a kanban.** A card's `review` names the roles that review it, in order (`"review":
  ["designer", "tester"]`); one that names none is the tester's, the lead's with no tester, and a role nobody in the
  team takes stands as that default, said. Each step is taken by an agent of its role that worked neither the card nor
  what it tests (else a developer that did not, else the lead), is its for 8 minutes (15 on its first review), and its
  approval hands the card with its notes to the next step — the last approves it; changes start the next round from
  the first step, offered first to who said each step before. A step nobody takes in 5 minutes is the next step's
  reviewer's too; the lead says any step. The UI review apart from the rest is gone with what it needed:
  `task complete --review code|ui`, `task review --skip-design`, the plan's `designReview`, the lead's reserved round
  and the wait for the same designer. `run open --dry-run` names the cards that change what a visitor sees with no
  designer in their review, and the monitor shows one Review column, each card at its step and who says it. A run
  opened before keeps working: a card in review without its step starts at its first.
  The report and the bench measure every review the same way, by step: each task's rounds by the step that sent it back,
  each step's wait for a reviewer and its reviewer's time at it, each agent's steps said; the bench's "UI wait" and
  "Lead wait" are "Review wait" and "Review". A card's time in the report ends at its last step's approval — it ended at
  its first step's, a two-step card read approved before its lead said it.
  Research completes as any card (`complete` in the activity): its time worked is measured, a card sent back to its
  scout is handed back in the same context (it was told to stop), and the feed says what it found. Its brief names no
  files and points at the scout's half (`runs-scout.md`); `run open --dry-run` names each agent's work, an on-demand one's
  too — a scout's research cards, the review steps of a designer or a tester.
- **`page same` says an element that differs by its words alone**, drawn the same — and `task look` says it is more
  likely what the two servers' data says (a time, a count) than the task: a look warned the page "moved" for a show's
  start a minute apart. `run report --summary` refused a summary written on the command line as "not there": it says
  the option names a file.
- **One server on a copy, and its failures said.** A task's acceptance lines are run with the copy served once for
  all of them whenever a line is a page command (`plitzi page check / /rooms`), and a page command in a copy reads the
  server its check gave it (`$PLITZI_URL`): a line with no `--url` served the copy a second time, which died on the
  copy's `state/jobs.json` and read "nothing could answer it". A kept server that does not answer as the copy's is
  stopped, not only forgotten; a look whose server stops says so at once, with the error it stopped on and its log,
  where it waited a minute to say "did not answer"; the copy served for a command names its log. A line that failed on
  a crash keeps the error, not Node's version banner; a command run from a folder that was removed (a task's copy, once
  approved) is refused saying so, where Node printed a stack.
- **Research's stage is kept, and the lead's advice settled for good.** An approved research card's stage is kept in
  the run's `inputs/<card>/`, said at the approval — the plan its tasks are amended from; it was dropped. `run settle
  <advice>` settles a kind of advice though it is not given that moment (it comes and goes with the agents running), and
  a scout whose research waits for the lead is not "idle" to be fed the backlog. A card sent back starts its round with
  no progress of the last.
- **The report measures what was waited for.** A card's time to take runs from when it could be taken — a tests card
  from the approval it waited for, not the stage that stacked it; a card handed back is at it again when its agent reads
  its brief; the kept browser's process is no agent's time in the CLI (a run read 641 s of it).
- **What encore-12's agents asked for.** A research card's stage is refused while a task of it has no acceptance line a
  command proves, naming them (the scope was sent back once for them). A note to the lead (`task tell`) wakes it no
  more: it comes with what does, or as the watch ends ("Nothing that needs the lead … " and the notes under it). `page
  check` fails on what the server logged as failed while its pages were opened (`server-logged`), when the server is
  the CLI's — a task's copy, a look's — and on a submit the browser held back (`form-held-back`, naming `noValidate`),
  which it only said. `task look` takes a path with its own visitor and status — `task look t-x "/moderation --as juno
  --status 403" "/withheld --as juno"` — one look a visitor, each told what the others covered. `page shot --clip <part>
  --showing <elements>` pictures the copy of a part drawn more than once that shows the most of them, and a look
  pictures a component where the task's elements show (a playing room card stood for an idle one's change).
- **A scout sees its stage from its own card: `task check --tasks <stage.json>`** — checked as the lead stacks it, each
  line run once on the run's work. `run extend` is the lead's alone, its dry run too: encore-11's and encore-13's scouts
  reached for it, the skill pointing there; one with a task's token is refused naming `task check --tasks`. The scout's
  prompt, brief and take say it.
- **What the run reads it reads as data, never off words.** An acceptance line nothing can answer is the lead's
  attention (`line-unanswered`), waking it until that task's acceptance is amended — it was a note the lead was no
  longer woken for. A task refused again and again is counted by the task the refusal was about (its own, or the
  token's), not by a `Task "…"` read in its message. A task's notes say what they record (`kind`: taken, unblocked,
  cut, a review's round) where readers matched their first words; a run opened before reads its notes so marked.
- **A run keeps each command it ran by what it is** — its name, its options, its arguments, read off the program as it
  ran (`commandPath`) — beside the line as typed: the report, the findings, the bench and the monitor read those, where
  each took the line apart its own way (`--list` matched in the text, the waits told by a regex). A refusal in the
  report says the command's name, no longer the whole line it was given.
- **The monitor shows the lead by what it holds**, as every agent: reviewing a step it took, at work on research it
  finds out with no scout, idle otherwise — its last act and its last command said on its row, never taken for work. It
  read "working" for three minutes after any act of its: after it opened a run, its scout at the scope.
- **No copy server outlives what started it.** The copy's server a command starts is stopped once that command is
  gone — a harness's timeout, a Ctrl-C, a crash — unless it is kept for the next command; keeping one stops the one kept
  before, and a kept server whose record names another is stopped by its watchdog, where it left it running: six
  servers of the CLI's own tests outlived their runs for days, and a `task check` cut short left the copy's state held.
- **A project's suite serves on its folder's own port** (from 8400, 5273 for a client project): a run's copies each ran
  their specs on 8400 with `reuseExistingServer`, a copy's specs passing on another copy's code. `plitzi upgrade` writes
  it into a `playwright.config.ts` nobody changed; one the project changed takes the same line by hand (`const OWN = …`,
  from the scaffold's).
- **Page tools, from encore-12:** `page check --ssr --as <user>` holds the HTML the server sent that visitor, not a
  guest's (six providers read "not in the HTML"); a `type` or `fill` step sets a date, time, colour or range field whole
  (keys set nothing in a date's segments); `page measure` names `data-plitzi-instance` when a selector wrote an instance
  as an element; `page check --fresh` and `page shot --fresh` say the option is `task check`'s and `task look`'s.
  `page check --space` takes a module anywhere in the project — a variant kept in `tmp/` reads `src/` — never its root.
  `explain form` says what `noValidate` does to a field's `requiredMessage`.
- **Every page command reads a page as one visitor, from the same flags.** `page check`, `measure`, `play`,
  `outline`, `same`, `shot` and `task look` take `--as`, `--guest`, `--timezone`, `--presence`, `--clock`, `--block`,
  `--autoplay` and `--storage` alike — `page check` took no `--clock`, `page outline` no `--timezone`, `page same` no
  `--as` — and open the page one way (`visit.ts`), so what one reads another reads the same. `--steps` is one
  vocabulary: `page check` and `page outline` play a visitor's steps before they read the page, as `page measure` did,
  and `task look --steps` checks what they leave too, where its check read the page at rest. A step another account
  plays (`as <account> …`) is refused by `page check` and `page outline`, which keep no other visitor's page, naming
  `page play` and `page measure`; a picture among the steps of a command that reads is refused naming `page shot`.
  The browser's own line for a request `--block` failed is not read as the page's console error (what the page says
  about it still is), and a required flag missed because it was given by its old name says the new one.
- **`run report --tokens` is gone.** The harness's count comes from each round's report: the agent table says what
  each harness read, its largest context and what it read again; the bench's "Context / task" column is gone.
- **`grid-area` and `grid-row`/`grid-column` expand as CSS does:** an omitted part is `auto`, a named area's mirrors it.
  `'grid-area': '2 / 1'` used to end at row 1 and column 1 — a space that placed by it may move; look at its grids.
- **`condition-short-source`** refuses a step's condition naming an element's source by its id alone
  (`roomStats.locked`), which never held: write `apiContainer_roomStats.locked`.

- **`PLITZI_KV_FILE` is `PLITZI_STATE_DIR`**, a folder: a project's server keeps its `kv` (`kv.json`, when the project
  names none) and its job queue (`jobs.json`) there instead of `state/`. `plitzi upgrade` rewrites `playwright.config.ts`
  (the visual suite's server keeps `tmp/visual/state`); a project that changed it sets the variable by hand. A store the
  project opens itself — a SQLite database in `src/config/serverOptions.ts` — should open in that folder too.

## Several agents on one project (`@plitzi/cli`)

- **One lead, the manager; a tester reviews every task; a scout finds out the spikes.** The lead is the person's harness
  and never starts again, so whatever it reads it reads again every turn: a run's lead, scoping and reviewing, spent 68%
  of the run. Now:
  - **Scout** (new role, Opus): `task next` takes it the run's research cards — its scope, research of a stage — as
    any card. An agent's question is a block, the lead's to answer (`task unblock --answer`), never the scout's, and a
    scout with none left is told it can stop. Its `task complete --found "…" [--tasks <stage.json>]` sends what it found
    to the lead's review — the stage checked as `run extend --dry-run`, its primer kept beside it — decided with the
    person: `task review <card> --approve [--leave <tasks>] | --changes "…"`. **Every research card is the lead's
    to approve**, and adding or taking out tasks the lead's alone.
  - **The keeper** starts a scout for research nobody took and the scout a card was sent back to, and an
    agent for a step of a review nobody of its role is free for; a scout whose result waits for the lead counts as free. A scout starts
    fresh once what it found is with the lead, a tester once its review is escalated.
  - **The lead is told only what is its:** a scout's proposal (`proposal` in `run watch`), an escalation (its block) —
    never a spike or a review's step the scouts and testers take, or a message beside them to answer — and an
    agent's question, its block. `run open --dry-run` names a scout's and a tester's work; `run open --dry-run --rehearse` plays the team's testers as
    its reviewers.
  - **Tester** (QA, Opus): its step of every card's review, a designer's card included — what it was asked, its
    checks, how it behaves, its code — and its approval, the last step, is the card's.
    What it cannot decide: `task review <task> --escalate "…"`, blocked on the lead.
  - **The lead** reviews nothing by default: what is escalated or past its review rounds, and a review nobody else may
    take — every task when the team has no tester — and `run watch` wakes it for nothing else. A review no tester may take
    (a lone tester's own `-tests`) is a developer's that worked neither it nor what it tests, handed by `task next`
    before a task of its own (the keeper starts one for it); the lead's only when none may, as it would hold the run.
  - **A task that takes long wakes the lead to ask where it stands**, any task at work and a spike a scout finds out:
    past twice its estimate, and again at each estimate more, with its agent's last word. `task message <task|@agent>
    --standing` asks; the agent answers whole with `task tell --standing --fraction --eta --done --left [--blocked]`
    (refused when a part is missing), its fraction kept as the task's progress, and the standing wakes the lead with
    what it may do — let it go on, change its course, unblock, narrow or split it, or take it back.
  - **Seen in encore-10:** `run start` names the run from the ask's first words when `--run` is left out (its help
    said so; it was refused) and says nothing of what happens next when it was refused; `run open` says the scope is the
    scout's when the team has one (it told the lead to find it out). The monitor puts a spike someone finds out **at
    work** (its scout named), one nobody took — or proposed, with the lead — in the spike column; `run status` names
    who finds a spike out. An agent the run asked for and its keeper started (`launch` logged `asked`) no longer shows
    the lead "working". What a scout found and the lead is to decide shows **in review** ("lead decides scout-1's"),
    never a spike still being found out. A flow card is drawn in its task's colour, as the strip is — a task sent back
    read yellow above and blue in its "At work" card.
  - **The tests are a developer's, the tester only reviews.** With a tester in the team each developer task still gets
    `<id>-tests`, now a developer's task (`testsOf: [<id>]`, a new plan field): written by a developer that did not
    write what it tests — `task next` offers it to no other, `task next <task>` and `task reassign --to` refuse its author,
    the keeper starts one that may, `run open --dry-run --rehearse` plays it so — and the tester's only when no developer may (a team of
    one). The tester's Opus goes to its QA; the tests are developer work on Sonnet.
    A tester never approves past a question the task asked the lead: it escalates it. Every task approved, the lead's
    `task next` says its close in order (look, report, finish) and the lead never "stops".
    Whoever reviews a task is handed what the team told the lead of it (`task tell`, `✉`). A step taken is let go
    when its card leaves review — sent back, escalated, taken back — its reviewer told, never left busy. A review escalated and answered (`task unblock
    --answer`) asks for its stopped agent again; a task taken back drops its block and what was asked. Before finishing it looks once at the whole result: **`plitzi run look`**
    checks and pictures every page the run changed (1440 and 390, light and dark); `run finish` asks for it after the
    last approval.
  - **Co-leads are gone:** `lead-2`…, `"lead": { "count" }` (refused, saying to add testers), `task next --role lead`
    for anyone but the lead, the questions a co-lead took (`answering.json`).
  - **The starter team** is one to two developers and none to one designer, tester and scout (`"min": 0`, every one on
    demand), the keeper starting each when work of its role waits — a review for a tester, a spike for a scout.
  - **A role of your own says what it does:** an agent's `"skill"` in `team.json` — a markdown file of the project,
    `run team set a11y --roles accessibility --skill .claude/skills/a11y/SKILL.md` — is read first by its agents;
    `run open --dry-run` refuses one the project does not have.
  - **To redo:** a `team.json` with `"lead": { "count" }` drops it; add `{ "name": "test", "roles": ["tester"], "min": 0,
    "model": "claude-opus-5-5" }` and `{ "name": "scout", "roles": ["scout"], "min": 0, "model": "claude-opus-5-5" }` to
    get the new roles.

An agent works a project alone by default. A team is a mode the person asks for — "several agents", "in parallel",
"subagents", in any language — and the skills, the project's `AGENTS.md`, `plitzi --help` and `run --help` say how to
start one. How it works: `docs/en/agent-runs.md`.

### The run

- `plitzi run start "<the ask>"` checks what a run needs (a space in code, Chromium, the harness) and opens it on its
  scope: a **research card** ended with the tasks it found (`task complete s-scope --found "…" --tasks <stage.json>`). A plan
  also opens directly (`run open --dry-run`, then `run open`). Either way every file a task touches is backed up first.
- **A plan is held to rules:** no file in two tasks, no cycle, ownership read off the imports, and a module only a page
  imports belongs to the task that names it. Its `inventory` lists the job piece by piece. Each piece is covered by an
  acceptance line a command proves (`{ said, check, covers }`) or left out with a reason (`leftOut`). `run open --dry-run`
  estimates at the project's own pace and warns of what is risky: files two tasks touch, exported contracts, checks it
  could not run, values no line measures, too few designers.
- **`run open --dry-run --rehearse`** plays a plan out before any agent starts: the schedule, the critical path, the lead's queue and the
  run's length for each team size. A module a task makes beside a file of its own it changes is that file's to import,
  not a registration in the space's entry: a run's four UI tasks were said to meet in `src/space/index.ts`.
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
  preview and kept browser are stopped, its folders removed.
- **Its reports stay, in one folder to commit and send to Plitzi:** `.plitzi/plitzi-reports/runs/<run>/` — `feedback.md`
  (what of it is Plitzi's, read first), `report.md`, `report.json`, `records/` (the run's plan, log, usage, messages and
  each task's rounds and reviews, to compute any of it again with the run gone — never the project's files) and
  `scratch/` (the agents' own scripts). No path of the machine and no token in any. A run's id is its folder's: `run
open` refuses one already used.
- **What a run noticed and left** becomes the project's backlog (`run notice --on`, `.plitzi/backlog.json`, `run
backlog`), offered to the next plan. What got in the agents' way in Plitzi goes to its `feedback.md` (`run notice
--plitzi`), for the person to share. `run open --dry-run` and `run open` say which items the plan takes up, by task, and list as
  open only those no task's `closes` names — a run's plan closed all five and was told to take them up.
- **A task that waits for another never holds its files against it:** a stage stacked after a task, naming the file
  that task makes, refused its complete as "another task's at work" while it could not start before it.
- **`run monitor`'s spend says what the run costs in the harness:** a TOTAL column — in, out and cached summed, each
  agent's and the run's whole — and the status bar says the run's.
- **A finish never crashes on an agent still ending a command:** its usage line is not written into a run being removed,
  the removal is retried, and the project is let go whatever happens — a finish failed with `ENOTEMPTY` after writing
  the work, leaving the project claimed by a run that was gone.
- **A run that stands still is said to the lead:** nothing worked or in review for 5 minutes while tasks are left wakes
  `run watch` with what holds each one — a ready task offered to nobody and the lock that keeps it, a
  blocked task's reason, the way out. A run once stood still past ten minutes with its watch saying "nothing new".
- **Agents run the project's `typecheck` and `lint` before `task check`:** their prompt and `runs.md` say it — of
  a run's 34 checks, 17 failed on what those scripts say in seconds.
- **The lead notes every problem of Plitzi as it happens** — the CLI, the platform, a skill or doc, a workaround a limit
  forced — with `run notice --plitzi`: its prompt said `run notice` (the project's backlog) of the CLI alone.
- **A blocked task lets go of what it took by turns and left unchanged**, handed on to the task waiting for it: a task
  blocked kept a file it took to trace a bug, and the task its block waited for needed it.
- **A file of a task nobody has taken is claimed ahead of it** (`task claim`), said so — that task is offered once the
  claim is approved, the change in it; `complete`'s refusal of such a change names the claim. `run amend` changes what a
  taken task `touches`. A run's one-line fix in a waiting task's file had no way in.
- **`task claim --wait` on a file a later task names is never a loop:** that task waits for the asker, so the file is granted.
- **Two tasks in review that read each other's files are approved as one change:** `task review A --approve --with B`
  merges both, checks them together and closes each — one at a time neither passed the checks, and neither could ever
  be approved. An approval refused by the checks names the tasks in review it may need.
- **`task look --steps`** pictures each page after the steps — `state notice …` shows a UI only a message or a flow
  makes — and a page the space keeps for signed-in visitors is read as the project's account (`PLITZI_CHECK_USER`), or
  said read as a guest and why.
- **A proposer withdraws its own proposal** (`task answer <id> --withdraw "why"`): one the lead's change of course left
  "unanswered" on the other task held its complete.
- **`run agent --launch` on an agent that runs answers so**, nothing started — it was a refusal, run twice by a lead.
- **`run open --dry-run` says an id two tasks expect to make on two pages:** an element's id is the space's, one element.
- **`run open --dry-run`'s notices take what the plan already says:** a file other tasks import is no longer said of a task that
  waits for it — the follower the notice asks for — and a reader a task names in `touches` is no longer read by files
  no task holds. `run open --dry-run --rehearse` reads the parts a task makes with a page as that page's to import, never as
  registered in the space's entry. Its advice to hold an agent to a role names the command that does it:
  `run team set <name> --roles …`.
- **`run watch`'s "they share no file" says what else a task may need** of the one it waits for: its actions, data or
  modules.

### The team (`.plitzi/team.json`)

- **`run amend` keeps the tasks of tests the run made** after a developer task the plan keeps: a run's amend of a stage
  dropped three, "nobody had taken them", with the proposals sent to them.
- **An agent starts with its own identity, never its launcher's:** `run agent --launch` hands the harness the agent's
  own token and session, and none of the lead's (`PLITZI_TOKEN`, `PLITZI_AGENT`, `PLITZI_RUN`). A run's agents
  inherited the lead's token from its CLI, and a project script's `plitzi space lint` ran as the lead — found by the
  run's own `two-sessions` finding.
- **A task sent back to an agent that is not running reads as waiting for it, not silent:** the lead is told to start
  it again, and no longer "no signal — reassign it" beside that (a run's t-room-read said both at once) — and
  `run upgrade` no longer waits for it: nobody is writing it, and its copy is kept (a run's waited an hour on it).
- **`task complete` runs the approved tasks' lines on a copy still served:** the server lent for the task's own lines
  was stopped once they passed, and every approved line on the same pages read "nothing answers" — a run's
  t-room-side was refused three times as breaking five lines it had not touched. An approved line nothing could answer
  is now told to the lead, as one of the task's own, and not held against the task.
- **A lead's `task look` at a task whose review is its own takes the review,** said in the activity as `task next --take`
  says it: a run's lead looked and approved, and the person following the run saw nobody take its reviews. A look
  at a step that is not the lead's takes nothing.
- **A line amended while its task waits in review is the one the finish holds it to:** `run amend` replaced the lines
  of done tasks alone, so a run's t-playback-safety, amended in review, was approved on its old line and the finish
  refused the run on it.
- **The run starts its own agents — the keeper** (`plitzi run keep`): with the team's `options.launch`, the agents the
  run asks for are started whatever the lead is doing — the base when not running, one on demand for waiting work, one
  a task was sent back to. `run open`, `resume`, `attach` and the lead's `run watch` start it, one a run, its log in the
  run's cache. Only the lead's watch started them before: a run's ready tasks waited with no developer running while
  the lead reviewed or wrote a stage.
- **The team's base stays while the run is open:** `task next` never tells one of the base to stop for want of work —
  it waits for a stage the lead stacks, and hears how its own work ended; only one on demand stops. One not running is
  asked for whatever waits. A run's designers and tester, stopped once every task was done, were stopped when a
  stage came.
- **Who runs is its process's to say:** an agent the CLI launched runs while its process does — never the log's last
  word, which asked to start dev-1, running, while dev-2 and dev-3 waited stopped. A stop holds until the agent comes
  back for work: a notice sent on its way out no longer reads as "no signal" (a run's tester, half an hour).
- **The lead's attention holds only what is the lead's, and now:** a line that failed and passed since, a task refused
  before it was approved, leave it; what is Plitzi's goes to the run's feedback alone. Every task done, the lead's
  summary is refused while anything waits for it — a run ended with ten notices standing, and its lead said "done"
  before stacking a stage. **`plitzi run settle <finding> --note "…"`** is how the lead settles a finding no approval
  settles — an agent that went on after "You can stop", a check that answered two ways: it says what it did, kept for
  the report; each finding says so. A run's close waited on three with no way to settle one.
- **The report tells each agent's life** — started, took, completed, reviewed, waited, stopped and why; its minutes at
  work, stopped and silent — and the feedback its figures (`lives`): a run read whole after it is gone.
- **A tester reviews code, never a design:** a run's test-1 approved the identity system and its components.
- **`task look` with no page named opens its acceptance's pages before the home page,** as a review's offer does — a
  look at a plugin's file pictured the home page, where none of its reactions is.
- **A reviewer's holder command says its review speaks for itself** (its look, its verdict) where it said "holds no
  task at work: name it"; the agent's prompt asks for progress in tasks of its own only.
- **`page measure --click … --hover|--focus …` and `page shot --click … --hover …`:** a state reached in two moves — a
  menu opened, an item of it hovered — measured and pictured; `measure` refused it as two states, `shot` had no
  `--hover`.
- **`task show` shows 400 lines of diff in all,** each file past them said with its size and how to read it:
  A run's reached 44k characters, read 77 times.
- **The dev tools' panel shows what its badge counts:** opening it from the badge mounted it again elsewhere in the
  layout, and the logs it kept were gone — a warning on the badge, none in the panel. It starts from the page's log
  history (`pConsole.history()`), and Clear empties that too.
- **A `complete` whose checks fail names what it took from the run** on that complete, with how to read each — a run's
  test-1 checked green and failed on a file approved since, with no word of which had come in.
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
- **`min`:** that many start with the run; the rest are **on demand**. `run watch` names the agent to start
  when work waits for one, and an agent with nothing left stops by itself.
- **`session`: when an agent is started again with a fresh context,** always between two pieces of work — a task
  completed, a review decided — never in one, past any size, so nothing it knows and has not written is lost: `task`
  (the default) after each one, `context` once its harness's context passes `options.freshContextAt` (250k tokens),
  `keep` never. Testers, designers and co-leads too; the lead that plans keeps its session, and an agent outside the
  team (nobody would start it again). A run's designer and tester, never started again, grew to 400k tokens and
  read 26–30k a turn, against ~12k for its developers started again per task.
  **Breaking:** `sessionPerTask` is gone — what it did is every agent's default now, and a team file with the old key
  is refused saying to remove it.
- **Planning a run with the person** (`runs-plan.md`, read by the lead first): the goal asked as a choice, the code and
  the platform's limits read before a task is written, the person's decisions asked before the tasks, and a summary —
  what is built, decided, left out, how long, who works, who applies it — said before anything starts. No agent of the
  team starts while a run holds its scope spike alone.
- **The run's keeper starts on a run just opened** — its log's folder made (a run's open crashed on it, no agent
  started) — and is the one to start agents while it runs: the lead's watch starting them too told the lead an agent
  "could not be started" that was running. An agent started meanwhile by another is no failure.
- **One start of an agent at a time** (a lock of its own): the keeper and a lead's watch both started a run's
  design-1 — two sessions on one copy — and test-1 three times. An agent no longer inherits the harness session of
  whoever started it (`CLAUDE_CODE_SESSION_*`).
- **An acceptance reaches its copy's server where the server says it listens** (`PLITZI_SERVER_RECORD`): asked for a
  port another check took meanwhile, a server while developing takes the next free one, and a run's checks waited a
  minute on the port asked — a right task failed.
- **A lead's `task show` of a task in review takes the review,** as `task look` does: the monitor says which task the
  lead is at, and another lead is not offered it.
- **A task sent back waits for its own agent,** who takes it as soon as it ends the task it is at: it is no longer
  handed to a free agent after 3 minutes (the `handed-off` entry and the bench's "Handed off" column are gone), and
  while it waits it never reads "no signal — reassign it".
- **`resumeSession`:** an agent started again after it died with a task in hand resumes its own session (Claude Code's
  `--resume`), so it keeps what it knew and had not written yet. It starts fresh instead, saying why, when its session
  is gone or past 8 MB. The starter team asks it of every agent. `run agent --launch` refuses to start a second session
  of an agent that is still running.
- **`options.startGraceMinutes`** (3 when not said): an agent just started does not read "no signal" or "not running",
  so `run watch` no longer wakes the lead for every agent it has just launched.
- **An agent whose process ended is not running**, whatever its last word in the log. An agent launched by
  `run agent --launch` that has ended reads stopped on the board, and `run watch` asks for it again when work waits:
  a review's step with nobody of its role running says which agent to start, at once.
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
- **`options.launch`** (a harness, `claude`): `run watch` starts the agents work waits for itself, rather
  than asking the lead to, and says the ones it could not start.
- **A designer's step in the review of the cards that name it.** `options.designReview` (`light`, `standard`, `high`)
  says how closely.
- **A tester reviews the code, and a developer writes `<id>-tests`** after each developer task. `task next` hands the
  tester its steps first; its approval, the last step, approves the card. With no tester in the team, the lead says the
  tester's steps.
- **The starter team names its models:** the lead on `claude-opus-5-5` at `"effort": "high"`, the designer on
  `claude-opus-5-5`, the developers on `claude-sonnet-5-5`. They are `team.json`'s, never the CLI's: one it leaves out is the harness's default. A model the team names is passed only to a harness that runs it
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

- **Getting work:** `task next` takes and waits by itself, handing an agent its own task first (sent back, unblocked, with what its
  review asked), then the most urgent ready one. It says why a task waits, and "You can stop" only when nothing can come
  back to it. Commands that wait stay under a harness's 10-minute limit (`task next`: 8 minutes) and wake the moment the
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
  Telling whose a server is reads every listener's folder in one `lsof`, not one per process: `server list` and
  `server stop` took seconds on a machine with many servers listening, and a few hundred milliseconds now.
- **A brief read again is shorter:** the run's primer, read whole once by the agent on the task, is said in a line while
  unchanged (`task context --primer` prints it) — a run's lead's 7k primer was 46% of every brief read again. A
  finding says when it was written, and which of the task's files the run approved since.
- **Reviews:**
  - `task show` shows a task as the lead reviews it: each diff, one file whole, what went to review — its last ten
    notes, each clipped (`--full`: all).
  - `task look` looks at a task in one command: served, checked, pictured light and dark, its parts beside the run
    before it (`--before`). A part with no box — a channel, a provider with no tag — is pictured by what it holds, never
    tried on every page.
  - `task review --approve | --changes`, then `task reassign`.
  - A review taken and not decided is handed on; a task past three rounds goes back to the lead.

### Watching a run

- **A ready task held by another's claim is said to the lead** (`held-ahead`): which task holds which file, and that
  approving it frees the file. A run's ready task sat 22 minutes with three developers free.
- **A proposal to a task in review is refused**, naming what works instead (the lead asks it in the review, or the file
  is changed after its approval): one waited ten minutes for an answer that could not come.
- **The team starts by itself:** with `team.json`'s `options.launch`, the run's keeper starts the base the moment the
  run opens — it waited two minutes for the lead while `run open` said it started them — and `run open` names whom it
  starts. `run agent <name> --launch` takes the team's harness unless `--harness` names another (a lead was refused
  "Which harness" for one the team named).
- **An agent starts lighter:** Claude Code is started with only the tools an agent uses and none of the person's MCP
  servers (`--tools …`, `--strict-mcp-config`) — its first context 16k tokens rather than 46.7k, read again on every
  turn: ~660k of cache over a 22-turn task.
- **A step that is the lead's is the lead's once it reads it** (`task look`, `task show`): nobody else is offered it — a
  lead looked at a task as its watch said to while its designer took the same review, and the lead's approval was
  refused.
- **`task look` opens a route's pattern at an address its acceptance names**, said or checked (`/messages/:username` at
  `/messages/nobodyhere`), and `task next` offers the look so; a look with nothing it can open says so, never the home
  page in its place.
- **`run monitor`:** the Activity is the newest first, as the simple panel's Latest; the sidebar's spend says under
  each agent its tokens in, out and read again from the cache.
- **`task check` says warnings apart as `task complete` does:** those on files the task changed are its own; the rest,
  in a line, were there before it — a run's developer read a check's warnings in files it never touched as its own.
- **A lead's prompt tells of a scope only when the run has one** (`s-scope`, opened by `run start`): a run opened on a
  plan made before it says its tasks are on the board — its lead, told of a scope, asked for one and was refused.
- **A run's checks build the functions** as the runner does (`functions`, by the project's installed sdk-server): a
  copy importing `node:crypto` into `src/functions/` passed its tests under `node --test`, and only its server, failing
  to start, said so. A copy whose server stops on an error is said at once — not after a minute — as the copy's own:
  its lines fail with the work, never "cannot be answered — amend the line" (a run's lead nearly amended a valid line).
- **A lead's watch says the board with what woke it** — every task, where it stands and who has it: a run's lead ran
  `run status` after each of its watches, 8 times in 10 minutes. **`run amend` alone** amends the plan the run keeps
  (`inputs/`), edited there — a lead ran it so and was refused for a missing argument.
- **A run's report says what it cost:** at the API's prices, with how much was the context read again, by agent and its
  costliest pieces (`spend` in `report.json`; `feedback.md` and `report.md` alike) — a run's $6.75, a third of it one
  designer task, was read off its log by hand. The bench keeps tokens, cost and the share read again a task done.
- **A spike's spend is its own:** what finding it out cost is kept as it ends (`spent`, piece `spike`) — a run's scope,
  every page swept, was counted in its lead's first review after it, $3.77 of a five-minute review.
- **A look beside the run before says, first, what differs or that nothing does** — one line above the pictures: a
  look of its parts printed a line a part, width and scheme among 39 pictures' paths, and two runs' leads read it as
  silence. `task look --status 404` sets the 404 beside the run before's, never "new". **`task check` reads green when
  only the run's own failures remain** — what fails the same way in the run's work, which `complete` takes as the
  run's: agents completed with a known failure they did not need. **A plan's task may leave `dependsOn` out** (none).
  **`page check` says a refusal its flow read apart** (`· refused, and its flow went on: 401 /auth/login`): a page's own
  request answered 4xx while no flow failed — a wrong password the sign-in says — never the page's failure.
- **What opening a run says is what it does:** a run opened on its scope says its base starts once the scope has its
  tasks (it said "now", and the keeper rightly waited); `run start` says a team with `options.launch` starts by itself,
  never to start it by hand; refused for the project's checks, the opener is told `run start … --despite-checks` too, and
  no task's "complete again".
- **`run open` says who leads:** the opener, through the lead's own CLI — or an agent that CLI starts
  (`…/scratch/lead/plitzi run agent lead --launch`, in the team's harness): a run's opener started its lead with
  `npx plitzi run agent lead --launch` and was refused as nobody.
- **The skills say what a run's agents got wrong:** the team starts by itself (`options.launch`), never by the lead's
  hand (the CLI skill's own overview still said `run agent` starts each); `--expect <id>~<text>`, never a sentence; a
  part a few px tall pictured with `--scale 4`; a task's files include the tests that read what it changes; a list's
  ties come out by `id`. Every option a skill's section names is taken by a command the section names — the projects
  table offered a `measure` script no project has.
- **Every option a run's message tells of comes with its command** (`plitzi task review t-home --changes "…"`, never
  `(--changes)` alone): `task next`'s waits went on saying `--follow` after it stopped taking it, and two agents were
  refused it at a run's end. Messages also name commands now checked whole — `task check --fix` without `plitzi`,
  `--approve | --changes`, `--width 390,1440 --same …` past the comma.
- **`run monitor`'s spend says what the run cost and when:** the run's last 30 minutes as a chart, its tokens and the
  share read again from the cache (sidebar and Spend), and its cost at the Claude API's prices — each turn on its model,
  cache writes by how long they were kept — in the sidebar, a `COST` column and the status bar. A model with no price
  says none rather than a guess. The run's log keeps each piece's cost and minutes (`spent`); runs logged before keep
  their tokens and show no cost.
- **A developer's "code review alone" stands when no page draws what it changed** — a setting with no element, a type:
  designers were sent such tasks, and their looks had no page to open.
- **`run open --dry-run` says a primer over 6k** and what it costs: every task's first brief carries it whole, and a run's 9.7 KB
  one put all 19 of its briefs over 12k characters.
- **`plitzi run monitor`:** a live board in a terminal of its own, in Plitzi's colours (dark or light, as the terminal
  is). It opens simple — who is at what, the tasks by stage and the stuck ones, the preview, the latest events, your own
  notices — and `m` switches to advanced at any moment (`--advanced` opens it so). Advanced has views as tabs:
  Overview, Flow (the kanban), Tasks, Agents, Spend. The Overview shows the activity, the agents at
  work and the flow in brief; from 130 columns, a sidebar with the tasks, agents, spend and preview. What needs someone
  is one notice at a time, its command copied with `c`. It also has a command palette (`ctrl+p`) and works with the
  mouse. It fits any terminal and only reads, except for the preview: `p` starts it, `x` stops it (also one served by
  `npm run start:preview`), and quitting stops one it started, so `q` asks twice while it serves one.
  - **Each activity line is short** — 72 characters at most, in its own words ("checks fail: lint + 3 files of other
    tasks", "stops for a fresh context") — and a click on a ▸ line opens the whole of it under it; the dev tools' Run
    tab shows the whole on hover. A run's lines ran to 499 characters.
  - **What each agent spent** (Spend, and the sidebar): pieces of work, turns, tokens in, out and cached — read again each
    turn, a tenth of the price, kept apart: one figure of all three said 1.1M where ~240k was the price — and its context,
    marked past `freshContextAt` for a `"session": "context"` agent alone — and its tasks and sessions, with what one of
    each costs on average (`PER SESS`, `PER TASK`, said under them; the run's counts a task once, whoever worked on it).
    Sorted by in+out, `s` changes it. Kept in the run's log as each
    task completes and each review is decided (`spent`), the lead and the reviewers included.
- **`run watch`** wakes the lead once for each review, question, block, idle agent or agent to start.
  `run status` gives the same in one answer.
- **The run's preview** serves its approved work as it grows: `p` in `run monitor`, its server's output under its
  address, or `npm run start:preview`; `run preview --task` serves one task's copy.
  The page's dev tools show the run in a **Run** tab.
- **The report and the bench** (`run report --summary --tokens`, `run report --bench`):
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
    Plitzi's findings, as the `feedback.md` of the run's reports; its data is the report's. `plitzi feedback` stays a
    single agent's, kept beside them.
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
- **A lead with nothing waiting for it helps:** its skill says to take a ready task
  (`task reassign <task> --to lead`), work its copy and complete it — a run's lead wrote the moderation demo's tests
  while the tester ran a spec.
- **What a run cost, cut** (its tasks read 3.9M tokens each, another's 2.2M):
  - A tester and a lead that review read `runs-review.md` — how a task is judged, the same for the lead — never the
    lead's whole half again on each fresh start.
  - A brief says of a task it depends on its acceptance, six lines, never how its reviews went; a note, 300 characters
    (the whole with `--json`). `task show`'s diffs stop at 240 lines in all.
- **The tester is no bottleneck:** while every tester is at work, a developer is offered a `-tests` card after its own —
  never of a task it worked (a run's tester was at work 104 of 152 minutes).
- **Nobody reviews a task they worked**, the lead included: a co-lead or a tester does.
- **A reviewer's `task progress`** is its review's sign of life, not refused (nine times in one run).
- **`task show` with no task** is the one you hold or review; `task complete <id>` takes your own id.
- **A tests card's check runs every test of its folder**, not only the files it names.
- **`run watch` is quieter:** an agent none of whose role's cards is left is not called idle, a card to split is only of
  the idle agents' roles, and an agent to start is the keeper's for 90 s before the lead hears of it.
- **A command line refused says what it meant:** two flags a zsh variable held as one (`"--as mika"`), an option another
  page command has (`page shot --element` is `--clip`), a command another group has (`run agents` is `run status`).
- **A failed step says nothing of a copy's missing `.env`.**
- **`run upgrade` sets right a run whose Plitzi already changed:** a stop loads the run whatever is installed — a run's
  upgrade was refused `version-mismatch`, the very thing it re-pins.
- **A package that comes with the SDK stops no run:** a run pins the CLI and the `@plitzi` packages the project names;
  one they bring (`@plitzi/plitzi-ui`) moving within their ranges is said to the lead, and the agents go on. A run's
  plitzi-ui patch held every agent 13 minutes. `run notice` is taken while a version changed, and `task next`
  waits through it to its end, never refused there.
- **A reviewer reads the task's brief:** `task context` in a review copy is the reviewed task's. A review the lead
  decides while another holds it tells that reviewer so, and nobody reviews their own.
- **A brief says the neighbours another task holds:** a file beside the task's own (`room.test.ts` beside `room.ts`) and
  whose it is — a run's developers found them at `task check`, after writing them.
- **A wait that would never end is refused:** `task claim --wait` and `task propose --wait` on a task that runs after this one
  (its `dependsOn` leads to it) say so at once, and leave no proposal behind; a run's dev-1 waited past its harness's
  timeout.
- **A review reads its own warnings:** the checks' warnings a task leaves are those on files it changed; the rest are
  counted in a line, theirs whose file it is.
- **`task look` says what it did not picture,** each page and why, and pictures a part new since the run before alone.
- **A command no longer tells an agent to pass its token** — the shell carries it.
- **`run monitor`'s flow says who has each review:** one Review column, each card at its step and who says it; a long id gives way to the name, cut in its middle, where it
  took the name with it ("t-desk-selector-ai…"); a review nobody took yet reads "waiting".
- **The monitor's approved column puts the latest approval first** — what just landed.
- **`↻ restarting` in the monitor:** an agent stopped between two pieces of work for a fresh context reads restarting —
  before the run starts it again and after, until its first command — never "stopped" (a run's design-1), and the
  run counts it running from its launch.
- **`run report` prints the run at a glance and each finding's title**; `--full` (and the finish's file) the whole of
  it. Its title is the run's goal, the stages it grew by listed under it; the lead's summary sits under its heading.
- **What the report counts, counted right:** an agent's waits and minutes end at the last approval, not the person's
  finish; a call is repeated within one session, never a wait (`task next`, `run watch`); the head,
  the indicators and the bench count the same tasks; a heavy context and a costly task are one finding each, the rounds
  their evidence; `explain` is said once; what agents said is grouped by its first text; a tool's result is named
  `Read .ts`, `Bash plitzi page measure` (a command after a comment, a `cd` or a loop too).
- **`task context`** reads what its files import from the task's copy, never the project as the run began.
- **`task check`:** `--fix` touches the task's own files alone; a check failing as the last one on the same files says
  so; a backup an editor or `sed -i -E` left is refused (`plitzi task discard`); a type error keeps its cause, the deepest
  lines under it. `complete` refuses the backups too.
- **Reviews:** an agent's first review is its own for 15 min, its reading held; another's verdict is refused while it
  reviews in its time. `task next`'s look names the acceptance's pages too, signed in as it checks them, and a
  page checked with a status of its own apart (`--status 404`).
- **`task look`:** finds a page only a signed-in visitor has a link to (`/u/:username`); keeps every look of a round;
  says a tall page's parts; says a picture not taken once a reason, with how to see the part; a dress change once, with
  every section it is in; that its copy holds its plays' state (`server reset` for a cold side); `--before` when not set
  beside the run before.
- **An agent is told what is next for it:** `task show` of another task offers `task tell`/`task propose`, never the
  lead's `task message`; a base agent with every task approved hears that the run waits for its finish and a person's
  apply; a new file beside a file near the limit is said to be the task's.
- **`two-tasks`** no longer counts a sent-back task waiting for its agent — the rule is that it waits.

- **The run's time.** A piece of work takes 10 minutes (the scope 30): past it `run watch` wakes the lead to ask where
  it stands, again at each limit more. `run open --dry-run` says a task estimated past it and a line that runs a whole Playwright
  suite; such a line holds a machine-wide lock — one suite at a time, whoever runs it. A line past two minutes says how
  long it took; one that failed with Playwright reusing the copy served on `PORT` says its `webServer` never started.
  A check or a complete gives its task's sign of life every minute. Every task approved, `run watch` wakes the lead to
  close. `complete` with the lead's word unread is refused with it.
- **Research and reviews.** `task review <card> --approve --leave t-a,t-b|all` stacks a research card's tasks but
  those.
  `plitzi run copy [dir]` makes the run's approved work a folder of the caller's scratch, its state its own. `task look`
  reads a page only a signed-out visitor opens as a guest, counts an address for the route it fits and the pages an
  earlier look of the task covered. A review is said slow only past its time; a task of tests waiting for what it tests
  is never "held up"; `task show` names the round being reviewed as `task next` does.

- **The run's report reads straighter.** A copy of the project an agent made by hand in its scratch is said as one
  (`Copies of the project made by hand`, fixed by `run copy`), and only the files it wrote there count as its scripts —
  encore-10's "1250 scripts" were four copies and ten probes. A refusal that hands over the lead's word (a verdict, a
  complete) is a step of the flow, never "refused N times over". `task look` with more pages than it pictures says the
  rest as not looked at, with the look that pictures them.
- **A run's report needs nothing before its apply.** It starts with **Before you apply** — the finish's dry run, tasks
  approved over a known failure, lines rewritten after approval, notices to the backlog, the
  lead's problems — its head says the work, the lead's close and the person's wait apart, a task that ran long says
  why (its acceptance rewritten, escalations, sends-back, what was stacked beside it, that nobody cut it), a slow close
  is the lead's, and Plitzi's problems are grouped by part: the run and the CLI, the platform, the docs.
- **New, or met before.** Each finding of a run's report is held against the runs before it the project keeps: one met
  again says where, comes first, and is counted (the bench's "Met before") — what a fix did not stop, apart from what
  the run explored.
- **Signing in from `/login?redirect=…`** goes back to that page (it went home): the e2e auth journey says so.
- **`page play`** says where a page went by itself as it opened, and how long each address was shown (a sign-in that
  sends a signed-in visitor on). **`page measure --steps`** plays another account's steps (`as dax: action …`): a review
  sets up a state the cold copy lacks, and `plitzi server reset` puts it back.
- `plitzi space pages` answers with `space overview`; the functions skill says a function reads no environment variable
  (a credential, `src/data/` or the input), which `explain` finds.

## Page tools (`@plitzi/cli`, `@plitzi/sdk-authoring`)

- **`page measure` reads how a row lays out** — `flex-direction`, `justify-content`, `flex-grow`, `min-width` (said
  only when not their initial value), and `--only`/`--same` take them: a run's designer sharing five rules read them
  through display, gap and width.

- **`task look --guest`** reads its pages as a guest, though a page sends one away or the acceptance reads it signed in
  — a run's lead looked at a guest's conversation through `page check` by hand. **`--before` says nothing gone that is
  there:** a layer on both sides, its section a little wider on one, is no look taken away (a run's look said the
  header's gradient removed on every page of two tasks that never touched it); and a look of parts says when nothing
  else of its pages moved, never leaving it to silence.

- **`page check` says a server provider that failed on the page server** and was answered in the browser after
  (`server-render-failed`): the first paint and a crawler lacked it, and the server logged it on every load while every
  check said "nothing wrong". The SDK keeps why each failed since the page loaded (`rsc.failures`), the dev tools say
  it (`window.__plitzi.serverFailures()`), `readDevTools` reads it.

- **A provider failure the page shows is handled, not a problem:** when an element on screen reads a failed provider's
  `errorMessage`, `hasError` or `status`, `page check` says it apart (`· failed, and the page shows it: …`) and
  `dataIssues` puts it in `shownFailures` — a run's page whose purpose is a refusal ("Nobody here goes by that name")
  was ✗ at every width. A failure nothing on screen reads still fails the page.

- **No more crashes on `setTypeOfService EINVAL`.** Node 24's undici threw it from a socket's event on macOS, ending
  `task look`, `page measure` and `page play` with a stack trace; the CLI sets a socket's type of service as best effort.
- **A look that crashed no longer holds its task's look:** a lock whose process on this machine is gone is taken at once,
  and a lock held past its wait is a refusal naming what holds it, never a stack trace.
- **`task look` reads signed-in pages signed in:** a page that sends a guest to the sign-in from its own flows is found by
  one quick guest check and read as the project's account (`PLITZI_CHECK_USER`); `plitzi doctor` says a check password
  with no account beside it (`check-user-missing`). A page the task adds is pictured alone, never set beside the 404.
- **`plitzi server reset` in a run's copy stops the copy's own server first**, and says so.
- **`page play --read` keeps an element's text whole** in `--json` (the line a person reads clips it at 80), and a play
  over several widths whose steps act says each width starts from what the first changed on the server. Its `wait`
  takes a unit: `wait 3s`. An element read again as it was says `as before`.
- **Two new steps, in `page play`, `page shot --steps` and `task look --steps`:** `action <id> [json]` runs one of the
  space's actions as the page's visitor — the server's data put in the state a step needs — and `as <account> <step>`
  plays a step as another account, signed in on a page of its own (`as mika type dm-input hi; as mika press Enter`):
  what another person does, seen on this page. Both reach the project's own server, never `--compare`'s site.
- **A save to the space that did not author is said by every page command:** the page is the space as it last
  authored, and the line says why — a run measured an element the refused save added and was told it was not drawn.
- **`page check`** says a provider that failed though everything that reads it is hidden at that width (a run's passed
  at 1440 with its lists empty); `--state` says what each key of a source holds, not its keys alone; a list written out
  as its children counts them as its rows; `label-wraps` leaves a link alone across its column (a title) to wrap, and
  a dash is no word.
- **`page shot --clip`** of a part a few lines tall says its size and `--scale 4` to read it up close; `page measure`
  says a pseudo-element's x and y to the hundredth, as a width.
- **`page measure`** reads `text-decoration` and `text-underline-offset` (a hover that only underlines), `align-items`,
  and where a `::before`/`::after` is drawn — its `x` and `y`, off Chromium's own layout — and why it sits there
  (`display`, `vertical-align`, `align-self`); `--same` without `--compare` names `--only`. A reading is shorter: four
  borders or sides alike are one line (`border`, `inset`), and a layer drawn again says how many times (`×4`).
- **`task look`** says why it has no picture — nothing to picture, or no command that said why — and a comparison that
  answered nothing readable. Its pictures are said under their folder, and a comparison names four of its sections.
- **`task show --full`** shows as many diffs whole as one answer holds (12k characters); each file past it says its
  size and how to read it alone (`task show <task> <file> --diff`). A run's answered 34k, read again on every turn.
- **A refused command line** says what an option left bare takes (`--as` with an empty shell variable), where
  `task inbox` reads a task's messages, and `page shot --clip` for `task look --clip`.
- **`element-empty`:** `page check`, `inspectPage` and a project's visual tests report an element a visitor sees with
  nothing in it — no words, no picture: a binding to a field the data lacks — by id, with how many list rows drew it so.

- **`plitzi verify`** says a project nothing serves as such — start it — where it asked for an account in `.env`, and
  says apart the pages nothing answered from those sent to sign in.
- **`page check`** reads a page as a visitor's browser draws it:
  - `--expect <id>~<text>` holds what a page says — any copy of it, a list's rows — and `--then` goes on by the page's
    own links. `--expect <id>` alone holds that it is shown; `--expect '!<id>'` that none is.
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
  - `--read a,b,c` reads three elements, as `--width` and `page measure` take commas; `--read` alone reads the page as
    it rests, no step needed.
  - A part for screen readers alone (`sr-only`: a pixel's box, clipped) reads "for screen readers only", never shown —
    in `page outline` too; an element's text is what a visitor sees, none of its hidden children's, and a list says
    how many rows it shows.
  - A target out of view is scrolled to before the step, as a pointer reaches it, and what moved is measured from
    there: a sticky part read "moved 315px down" after a click on a switch below it.
- **`page measure` says an element it measured is hidden** — none of its matches drawn — alone and beside the other page.
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
- **`plitzi explain ctx.later`** (`job.save`, `FunctionContext.later`, or a bare `later`) says a member of a type a
  package exports, with its whole doc: `explain later` said it was nothing.
- **`plitzi explain`** answers "does Plitzi have a way to…". It covers elements and the fields their source publishes,
  steps, triggers, style states, global sources, template filters and functions, a server action's steps
  (`--list tasks`), codes, CLI commands and an export's fields.
  - The types `@plitzi/sdk-authoring` exports are found by their words too — `explain "binding spec"` names
    `BindingSpec` — and `explain --list types` lists them, each with its doc's first line.
  - `explain "<words>"` also reads the skills' references and recipes, so it answers with the page that
    teaches it.
- **`page outline --width 390,1440`** outlines each width, and **`page shot --scheme light,dark`** pictures each scheme,
  as `check`, `measure` and `play` take a list.
- **A run's agent starts with nothing of the person's beside the project:** Claude Code without its memory of the
  project (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, ~700 tokens a turn, and carried across runs), opencode `--pure` (no
  plugins) — as Claude Code was already started without the person's MCP servers.
- **`space overview`** says each unit in a line — what it owns and how many shared files it reaches — and
  `space overview <unit>` one whole: a run's lead read 12k characters of it, every shared file said again per unit.
- **The builder's settings name the page shown instead of one withheld** (Pages a visitor may not see): every page a
  visitor may see, or Plitzi's words.
- **`page check` says a page that draws nothing of its own** (`page-empty`, from `inspectPage`): only its layout — a
  record not found with nothing said, data that never came, every part hidden. A run's lead found a blank 404 only by
  reading pictures one by one, every check having passed.
- **`page check` of a page withheld from its visitor** (its `access`, answered 401 or 403) owes only its layout's
  elements and those of the page drawn in its place (`onScreen`'s `withheld`): a 403 read as every element of the page
  "not on the page", which the server never sent.
- **`page shot / /r/nope /u/dax`** pictures each page, at each width and scheme asked: a lead wrote three pages and
  was refused. `--out` names each picture by what tells it from the others (`look-r-nope-390.png`).
- **`explain ctx.later`** answers the member first, as the installed types declare it.
- **`plitzi functions later [key] --now`**: what the served project holds to run later (`ctx.later`), by key and when it
  is due — and one started now, through the server's own queue: a spec of a show waited five real minutes a pass.
- **`page play` and `page shot --steps` set what the demo data never has:** `reload`, `store <key> <value>`
  (`localStorage`), `state <key> <json>` (the space's state, on a development page), and with `--clock <instant>` the
  steps `clock <instant>` and `tick 5m` — a countdown read at each moment. `fill email=ana@x.com` is taken as `--fill`
  writes it.
- **`page play` and `page measure` read a page in a browser that refuses:** `--block <text>` fails each request whose
  address holds it, `--autoplay refused` refuses media with sound until a press, `--storage refused` throws on
  `localStorage`. `page play` takes `--timezone`.
- **`page measure --only <properties>`** prints those alone (`--only box`: place, size, padding, margin), and **`--rows`**
  measures every row of a list, not its first. A click's answer from the server lands before what follows reads the
  page.
- **`page outline --within`** takes the first part shown and names what is inside it, through the wrappers.
- **`page play` says a read never there once**, not at every step and width.
- **`plitzi server reset`** puts what a folder's server keeps (`state/`) back to a cold start, refused while one of its
  servers runs; `server stop --port` says whether anything listens there at all.
- **`page check` judges no words a reader never sees for contrast:** a line clipped to nothing for screen readers
  (`overflow: hidden` on a pixel, `clip-path: inset(50%)`, `clip: rect(0 0 0 0)`).
- **`plitzi space fix` says what is left** when nothing has one fix to write — each warning and suggestion where it was
  written, and how one written so on purpose is quieted — never "Nothing to fix" beside them.
- **`page shot`:** `--scale <1–4>` pictures a small drawing up close; a `--clip`'s name is in the file's
  (`home-site-header-1440-light.png`); a whole page past three screens is also written in parts a screen and a half tall;
  a clipped part is pictured without what is pinned over it (a sticky header); a sheet pinned over the page that holds
  more than the screen is pictured whole; a component's instance is clipped by its name; `--frames` on a part counts any
  change as motion, and a page's slight changes are said apart.
- **`page measure`** says what an element says of itself — its initial values and what it inherits counted, `--all` for
  every one, a data URI by its kind and size — and how many elements its selector finds; it measures `animation`,
  `position`, `max-width`, `grid-area` and a pseudo-element's `position`, `top`…; `--steps` plays steps first (data only a
  visitor makes: a chat line); `No element` says the ways one is not drawn.
- **`page play`:** `goto <path>`; `→ <path>` where a step took the page; a colour a step changed; an element's
  animations; a `;` inside quotes is the text's; `fill .class=text`; a `state` value quoted as a shell writes it. A click
  that navigates is no failure, in `page check --click` too.
- **`page outline --find <word>`** lists the elements whose name, selector or words hold it, the whole page searched.
- **An option's value that is the next option** (`--width --scheme`) says the value went missing; `page shot --full`
  says a shot is the whole page already.
- **Node 24's fetch failing its first request** with `setTypeOfService EINVAL` is asked again, once, for the CLI's
  requests to a server of this machine.
- **`explain`** answers a name it does not have with what its words describe, a setting of the space as one, a state a
  class styles (`active` is the press; the open tab is `current`), and what an element writes on its node.
- **`page check`** reads a condition written inside a class's rule (`@container`, nested) as the width hiding it.
- **`selector-instance`** (`plitzi space lint`): a test's `data-plitzi-el` selector naming a component's instance, which
  finds nothing — `handles.element(id).selector` does.

- **`page play`** runs an action once, at the first width, says what it answered under its step and, answered 401,
  that `--as` plays the page signed in; reads a list's row by `<el>:2` or `<el>:last`; says a public page played signed
  out. **`page measure`** says the viewport it read at, takes `top`, `right`, `bottom` and `left`, and says a provider
  as one drawn by its children. **`page check --state <names>`** holds only those; a space that does not author is said
  by its first lines, not a count.

## Authoring (`@plitzi/sdk-authoring`)

- **`class-overrides-class` says the same property set over the class listed after it** (`gap` over `gap`, a longhand
  over a longhand, at one breakpoint), not only a shorthand erasing a longhand: a run's shared class, made of five
  `repeated-css` warnings, lost its `gap: 10px` to `btn`'s `8px` on two buttons — `btn` written later — while author,
  lint and every check passed.

- **A suggestion about several elements names them all**, not "and 3 more", and `space lint` says where each other one
  was written (`Also written at …`, the suggestion's `elsewhere`): a run's agent fixed the one named, ran lint again
  and met the next, four times in half a minute.

- **`focus('field-id')`**: a step that gives an element — or the first field inside it — the keyboard's focus.
- **`server-when-unknown`** warns of a server provider whose `when` reads what only the browser holds (a `state`, a
  variable, a browser provider): the page server resolves it whatever it says.

- **Every trigger has its factory:** `onChange()`, `onMouseEnter()`, `onHover()`, `onFocus()`, `onBlur()`,
  `onThemeChange()`, `onApiSuccess()`, `onMessage()` and the rest beside `onClick()` — each trigger an element fires, by
  its own name. `onChange()` written by analogy failed as a bare ESM error; a test holds every trigger to one.
- **The scroll family's sides:** `overscrollBehaviorX`/`Y`, and `scrollPadding` and `scrollMargin` on every side — a
  horizontal scroll-snap shelf was refused `overscroll-behavior-x` and `scroll-padding-left` (in the style inspector
  too).
- **A located element says it has no box** (`boxless`): a provider with no tag, a channel, a plugin's that draws nothing.

- **`server-source-in-browser`** refuses a provider with an `action` or a `connector` and no `runtime: 'server'`: the
  browser asks a `query` alone, so it never asked and its children stayed empty, saying nothing — a run's shell notice
  of a show starting never showed (found by a run's test-1).
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
- **`provider-when-not-rules`** refuses a provider's `when` that is no rule group (a string, a single rule) — it never
  waited — and a rule's field is read as a source by its name.
- **`id-taken` lists every clash at once**, the ids under a refused element too: a run's took three check rounds.
- **`padding: 'var(--pad, 4px 10px)'` is refused, naming the longhands:** each side got the whole fallback — no length.
- **`clip` names its successor** in the refusal: `clip-path: inset(50%)`, or the `sr-only` utility.
- **`repeated-shape` says what counts as a copy** (three of four elements or more, two of eight) and how copies alike on
  purpose are kept (`quiet`); `variant-bound-twice` says two things that change apart are two classes.
- **`taskAction` keeps a param's limits:** `maxLength`, `min` and `max` are the action's input fields' too — read off the
  action, and refused before the task runs (`Invalid input: minutes (number, at most 240)`).
- **The testing helpers** used by the page tools are exported: `openPage`, `inspectPage`, `pageTexts`, `compareTexts`,
  `pageDecorations`, `compareDecorations`. Every export carries a doc.
- **`popup-position-set`** warns of a class setting where a `dropdownPopup` is drawn; **`icon-font-replaced`** of a
  class giving a `fontAwesome` icon another font; **`template-or-value`** of `x or 'value'`, which answers true or false
  (`??` is the fallback).
- **`keptState`** names the only state keys kept — refused beside `transientState`, a painted key one of them.
- The `repeated-on-pages` suggestion says where a component of one area is written and listed.

- **`plitzi explain <page field>`** — `unauthorizedRedirect`, `accessLevel`… — says it is a page's and where its meaning is.

- **`pageAt` and `audienceAt`**: which page of an authored space answers an address, for a guest or a signed-in
  visitor, and whom it is for — the router's own decision. The CLI reads them instead of a copy of the router.
- **`login-then-leaves`** warns of steps after `auth.login` on a page for signed-out visitors: the page sends whoever
  signs in on as the login succeeds, and those steps race it.

## Elements and the SDK (`@plitzi/sdk-elements`, `@plitzi/plitzi-sdk`, `@plitzi/sdk-shared`)

- **A hidden element with no tag draws nothing**: a `channel` or provider without a `subType` ignored its own `visible`, its
  children shown.
- **Scroll steps wait for their box to have something to scroll**: `scrollTo(…, { y: 'end' })` on a page's load did
  nothing on a list not laid out yet. And every element answers a `focus` step.
- **A provider's `when` holds, in the browser and on the page server.** The browser read it against the route and query
  params alone, where authoring writes its fields as sources (`auth.isAuthenticated`, `apiContainer_room.found`): it
  now reads the sources it names. The page server resolved every server provider whatever its `when` said — a guest's
  page resolved what only a signed-in visitor reads: it now holds one it knows all of (`navigation`, `auth`, the
  answers of the server providers it names, resolved first) and leaves it out until it holds; the browser asks it once
  it holds there (signed in), and says it waiting, never "could not be reached". `whenOf`, `whenPaths`,
  `serverWhenValues`, `isEmptyAnswer` (`@plitzi/sdk-shared/schema`) and `ruleValuesOf` (`/helpers`) are the one
  reading of both sides.
- **A kept message said again to a page that joins is `replayed`**: a moment on a `retain: true` channel — a room
  opened — is answered by a flow `when` it is not, where every replay read as said now. The Channel's `onMessage` hands
  it on.

- **`explain apiContainer` says how an action is reached:** only the page server resolves an `action` or a
  `connector` (`runtime: "server"`); a browser flow calls one with `runServerAction`, then reads again — and what
  `onApiSuccess` and `onApiError` hand their flow. The `ago` and `date` filters are found as relative and local time.

- **No placeholder words on a page:** a text, paragraph, heading, button or field label with no value draws nothing,
  never "Text", "Heading", "Button" or "Label" — a run's room cards read "Text" where their line was bound to nothing.
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
  a refusal still fails it. Found by a run's dev-1.
- **A guest refused asks no renewal** (`@plitzi/sdk-auth`): a 401 to a visitor who never signed in — a server action
  kept for signed-in visitors — sent a `/auth/refresh` that could only fail (400). A refusal renews or ends a session
  only when this browser holds one (a stored credential or the hint cookie). Found by Carlos on a run's Remind me.
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
- **A `number` field takes `min`, `max` and `step`** (`formControl`), each bound said by its `minMessage`/`maxMessage`
  when broken, compared as numbers; the builder's panel shows them for a number field.
- **An element written with no words draws none:** a declaration names the attributes whose default is the builder's
  placeholder (`placeholders`: a text's, heading's, paragraph's, button's and markdown's `content`, a field's `label`,
  a modal's `title`), and authoring never writes them — a bound text that read nothing drew "Text" (a run's Home
  window). The builder still places an element with its word.
- **A server provider that failed says why while developing:** its element shows the error its action or connector
  answered (`rscFailureOf`), not "could not be reached"; in production it stays the visitor's message.
- **A flow reads a refusal's `code`:** `/_action` answers it beside the message, so a page tells "too-many" from
  "not-allowed" without matching words.
- **An element rendered outside a space says where a plugin is tested**: what it works out in a `.ts` module, what it
  draws in the browser.
- **A filter written as JavaScript names it** is refused with the one the templates have: `concat` — write
  `first|merge(second)`.
- The authoring skill says `|ago` for "3 minutes ago", not a transformer.
- **`dropdown`:** `popupWidth: 'trigger'` makes its popup at least as wide as its trigger; `openDropdown`,
  `closeDropdown` and `toggleDropdown` open and close it from a step.
- **`settings.keptState`:** with `keepState`, only these keys are written and brought back — a dismissed notice kept, the
  page's other keys fresh.
- **A declaration's `marks`** say what an element writes on its node (`role="tab"`, `aria-selected`) and how a class
  styles it; `explain` and its search read them. Each style state says what it is (`STYLE_STATE_MEANINGS`).
- `inspectTemplate` answers `notes`: what reads as other than it looks.

- **`navigation.queryParams`** read as the URL standard does: a value keeps every `=` after its first
  (`?next=/a?x=1`), `+` is a space, each decoded once.
- **A visitor who signs in on a page for signed-out visitors** goes back to the `?redirect=` its address carries (on
  this site), else where the page says — the moment the login succeeds; steps after the login race the page leaving.
- **A realtime connection swapped for one more topic** keeps the old one hearing until the new one is let in: an event
  said meanwhile — the one a page opened by navigation causes — is no longer lost, and arrives once.
- **A refresh of server elements writes `rsc.*` at the SDK root**, not through the element's scope: two providers'
  refreshes were ~55 "scope collision" warnings a page.

## Server (`@plitzi/sdk-server`)

- **A page withheld from its visitor keeps its layout's data:** the site around the refusal is read as on every page —
  its header, its inbox — and only the page's own providers are kept back. A run's withheld page drew a blank avatar
  and no inbox, every layout source "could not be reached".

- **A server provider's input bound to the address is read on the first paint:** a binding of `input` on
  `navigation.routeParams` / `queryParams` alone is resolved by the page server as the browser resolves it
  (`serverInputOf`, `@plitzi/sdk-shared/schema`), and the browser compares against it. A run's conversation page bound
  `{ with: routeParams.username }`: the server resolved it with no `with`, refused it on every load and logged a stack,
  while the browser asked again to draw it. A render's refusal logs its words too (`invalid_input — Invalid input: slug`).

- **…and bound to another server provider's answer too:** `input` bound to `apiContainer_room.data.owner` is resolved
  after that provider, on the server, as the browser does (`inputProviders`, `browserServerInput`). A run's crate list
  bound its person to the room's answer: the server asked with none, refused on every load, and the list came empty.

- **A server provider that fails says how it read its bound input**, in the server's log and in what `page check`
  reads (`server-render-failed`): `input.with ← apiContainer_room.data.owner: empty`, or why a binding was not read
  there — the visitor's state, a `when`, a provider with no answer (`inputReadings`, `@plitzi/sdk-shared/schema`).

- **A space can give a withheld page its own look:** `settings.withheldPage` names a page of the space — by id or slug
  in authoring, a page with no `access` (`withheld-page-invalid` otherwise) — drawn in place of the platform's few
  words, inside the same layout, with the same 401 or 403; its server providers are resolved with it
  (`withheldPageOf`, `@plitzi/sdk-shared/schema`). `auth.isAuthenticated` tells "sign in" from "not yours" there. The
  MCP's `patchSettings` takes it by id, with the same refusal; `""` gives the platform's words back.

- **A project's server keeps the last space that authored when a save does not, and `/health` says why**
  (`spaceStale`), until a save authors; a space that never authored shows the latest refusal, not the first.

- **A refusal's words reach the element that asked for them**, in production too, as `/_action` answers them — not
  "could not be reached", nor the log's "Action … ended as failed, refused (code): …" around them.
- **A list entry's id refused names the id**, the marks allowed quoted. A test's store is the server's own:
  `createKvStore(createMemoryKv())` from `@plitzi/sdk-server/actions`.
- **A project's server holding its state names how to stop it:** a second `npm start` beside a server a page check kept
  is refused with `plitzi server stop --port <port>` in the holder's name.

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
- **The job queue survives a restart, kept where you choose** — as the `kv`: `createMemoryJobQueue`,
  `createFileJobQueue({ file })`, `createSqliteJobQueue({ file | db })` (`@plitzi/sdk-server/sqlite`, shared by every
  process on the file), Mongo, MySQL or a `JobQueue` of your own, all over one set of rules (`queueRules`) and the same
  contract tests. **A project's server keeps it in `state/jobs.json`**, beside its `kv`: a `ctx.later` due while the
  server was down runs once it is back, and a job a worker held is taken again, its attempt `lost`. Before, it lived
  in memory and a restart dropped every `ctx.later` waiting. The primary and its workers share one queue
  (`fleetJobQueue`): the primary's was another instance than the one its workers reached.
- **A run's preview** answers `/__plitzi/run`, and only a preview's pages ask for it.
- **The server's budget is loaded again:** the filters' catalogue and the pages' rule are entries of their own that the
  server never reads.
- **`createFileJobQueue`** is exported from `@plitzi/sdk-server/actions`, as its docs said: a self-hosted server keeps
  its jobs in a JSON file through a restart. A project's server answers `plitzi functions later` while developing.
- **An action's input field takes `maxLength`, `min` and `max`**, refused before the run with the limit named.
- **A render an action refused says why, as a warning:** `Action "x" ended as failed, refused (room-not-found): There
is no room at this address.` — one line, no stack — where the log said "ended as failed" as an error for every
  guest's page; a step that broke stays an error, with its own message.
- **A `render` read of an action with no `render` trigger** says so — the trigger to add — and a refusal's `code` reaches
  the page (`ActionRefusal`).

- **A project's server holds no `kv` file** when its `serverOptions.action.kv` names a store, and keeps what it does
  hold in `PLITZI_STATE_DIR` when set (see the upgrade notes).

## The builder (`@plitzi/plitzi-builder`, `@plitzi/sdk-elements`, `@plitzi/sdk-schema`)

- **Settings → Sharing:** the site's name, language, icon, share image, theme colour and `robots.txt`, checked as they
  are typed by the same rule authoring refuses on.
- **A page's SEO** takes its share image, its description and its kind, with robots, and shows the link's card.
- **A setting the space had no value for is kept:** the builder wrote a setting only where one was already there, so a
  new one was saved by the platform and lost on the canvas until the next load. `SCHEMA_SETTINGS` lives in
  `@plitzi/sdk-shared/schema` now, for the builder and authoring alike.
- **The MCP's `patchSettings`** writes the site's identity, `robotsTxt` and `viewTransitions` too, and `keptState`.
- **Settings › State** edits `keptState` beside the keys never kept, and says when both are written.

## Dev tools (`@plitzi/sdk-dev-tools`)

- A **Run** tab, offered only on a run's preview: progress, the tasks by where they stand, the agents and what needs
  someone.
- The panel scrolls again.

## The workspace

- **No file past 600 lines of code:** the shared lint config sets `max-lines`. The longest files are now folders of
  modules, with the same exports.
- **ESLint's `quotes` rule is gone;** Prettier writes the quotes.
