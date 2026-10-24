# Several agents on one project

How `plitzi run` and `plitzi task` keep several agents — the subagents of one harness, or harnesses of different kinds —
from stepping on each other on one project, and why nothing they do can leave it broken. How to use them is the CLI's
README and the `plitzi-cli` skill (`reference/runs.md`, every agent's; `reference/runs-lead.md`, the lead's); this page is for whoever changes them. The code is
`apps/cli/src/runs/`, the commands `apps/cli/src/commands/runs/` (registered in `commands/runs/register/`).

## The line

Plitzi provides the tools; the harness orchestrates. The CLI never decides what an agent does, chooses its model or
interprets a goal: the lead writes the plan, reviews the tasks and closes the run with its report. It starts an agent
only when asked to (`run agent <name> --launch --harness <it>`), in the harness named, with the model the team gives
it, and that agent then works by the run's commands like any other. The CLI reserves
files, gives each task a copy, checks, merges, keeps backups and shows progress. Nothing of it reaches the platform: a
space on Plitzi is pulled, worked on as a project and pushed once ([a space as a project](./projects-from-spaces.md)),
so the server never receives many agents writing at once, and the MCP, the builder and the server have no part in it.

The safety does not rest on trusting the agents. Locally a harness can write anywhere on the disk, so what holds is the
design: a task writes into a copy; whatever it changed is compared by fingerprint when it completes and before it
merges; only one checked merge, confirmed by a person, writes into the project; and every file is backed up before
anything touches it.

**One plan and one run at a time** in a project. The plan and the summary the lead hands the run are recorded with their
fingerprint, and removed with the run when it ends if they are as it read them — kept, and said, if changed since. `run
plan` and `run open` refuse while another run is going (`another-run`), and `tmp/plitzi-runs/active.json`, created
exclusively when a run opens, decides between two opening at once. A claim with no run behind it is a run still opening
— its record is written last — unless it is more than two minutes old: then it was cut, and is taken over. A run limits
how many agents work at once — its team's size, above 5 a person confirms: `task take` counts the agents
holding a task in progress — one holding two is one, and a take by one of them adds none — and takes one under the run's
`take.lock`, so two takes never pass the limit together (`agent-limit`).

## Starting one (`commands/runs/start.ts`, `commands/runs/agent.ts`, `runs/agentPrompt.ts`)

A team is a mode asked for, never the default: an agent asked for something works the project itself, and the CLI's
skill, the project's `AGENTS.md` and `plitzi --help` (the `run` and `task` commands grouped apart, as multi-agent) all
say so. `plitzi run start "<the ask>"` is the one way in: it checks what a run needs before it opens — a project whose
space is its code, the project's Chromium (every task's check opens pages in it), the harness asked for on the PATH —
then opens it as `run open --spike` does, and says each step after: the scope, the team, following it, the person's
merge. `plitzi run agent <name>` writes the agent's prompt (`agentPrompt`: who it is, its first command, its token
file, the skills to read, the rules no agent breaks) in its scratch, and prints the line that starts it headless in
Claude Code (`claude -p … --permission-mode acceptEdits --allowedTools …`), Codex (`codex exec --full-auto`) or
opencode (`opencode run`, its model as provider/model); `--launch` starts it detached, its output in
`scratch/<agent>/agent.log` and its pid in `agent.json`. `run watch`'s `agents-needed` names that command. Every run
before had its lead write each agent's prompt by hand — a page each, and nothing a person new to it could start.

## The lead and the agents

The lead — team lead and software architect — is whoever runs the run without a task's token: it plans, starts the
agents, answers them, reviews — the complete, strict review and the final word, whoever else reviewed — and closes. A task names the role that works it (`role`, a developer's when left out), and
`task next --role` / `task take --role` hold each agent to its role. The lead and the agents talk through the run's
`messages/` (`messages.ts`, `talk.ts`): an agent's question is on top of `run status`; what the lead says to a task — or
to every task in hand, or to an agent by name (`@dev-1`), which `task next` hands over between tasks — is handed over
with the task's next heartbeat, progress or completion, marked read as it is; a question with a reply leaves `run
status`. `run watch --until lead` (`leadWatch.ts`) is what a lead waits with in the background: it ends with what is new
for it — a review by its round, a question, a block, a notice — each once, what it woke the lead for kept in the run's
`lead-seen.json`. A block the lead lifts carries what the task waited for (`task unblock --answer`), and `task next`
hands an agent the task it holds and can go on with — unblocked, or sent back with changes — before anything new
(`yours`), so an agent waiting for work hears it. A task sent back that others wait on, while its agent is at another,
tells that agent it goes first (`goesFirst`, to `@<agent>`): nothing else reaches it before the task in hand is done. **The run's notes** — the plan's `notes`, and each `run note` — are
messages to every task (`*`): each task reads every one once, with its take or its next sign of life, and `task context`
(the brief an agent starts from) lists them beside its acceptance, what a review asked and what was agreed, with its
files' sizes, the shape of the data they import and how to call what they import from the rest of the project
(`moduleApis.ts`: each imported name's signature and the first sentence of its doc, followed through a barrel, never
its body — two of la-velada's pages import 43k characters of shared modules, said in 3k); `--files` adds the files as
they are, for a harness with no reader of its own — one that reads a file before it edits it read each twice
(velada-backlog's t-body-type: 57 KB with them, 3.5 KB without). In a
task's copy whose own server is not running, `page check` and `page shot` serve the copy (`copyServer.ts`, by
`serveCopy`) and keep it `LINGER_MS` for the next (`lingering.ts`): an agent starts no server to look at its page, where
la-velada's spent 64 steps starting, waiting for, asking about and stopping theirs, and pictures it again without a
start each time. A watchdog of its own stops it once unused or the copy is gone; one written since it was served
(`src/`) is stopped and the copy served anew — `start` does not reload — and whatever serves the copy itself
(`complete`, `task check`) stops it first: one server on a copy. Where processes are no group to stop later (Windows),
the copy is served for the command and stopped after. **What
nobody's task owns** — seen wrong outside the task in hand, there before the run — is `run notice "…" --on <where>`
(`notices.ts`), by an agent with its token, a reviewer by its name, or the lead: one line of the log (`notice`) —
never a message to the lead, which would wake it for what is the next stage's — said by the finish and listed in the report under "Noticed, owned by no task" — and kept past the run in the project's backlog (`backlog.ts`, `.plitzi/backlog.json`, beside the team: the
project's, in git), as the run finishes or is aborted, one already there kept once. `run plan` and `run open` list what
is open for the run being planned to take up; `run backlog` lists it, `run backlog add "…" [--on <where>]` keeps one
with no run open (the person's, or an agent's between runs), and `run backlog done <id> --note "…"` closes one, saying
how. A plan's task that does items says so — `"closes": ["b-3"]`, refused at `run plan` when one is not open — and they
are closed as its run is applied, each saying the task and the run that did it.

**The run's feedback to Plitzi** (`feedback.ts`) is what a multi-agent run says of Plitzi itself, as `plitzi feedback`
is a single agent's. Each agent reports every round it completes, with what it was like to work with Plitzi (below).
The lead adds its own report and experience (`run report --summary … --ease --hardest`). The run consolidates them as it
finishes or is aborted, with what its records show was Plitzi's or the machine's (the findings, below). `run feedback` writes it before that. It goes to
`.plitzi/feedback/<run>.md` to read and `.plitzi/feedback/<run>.json` to analyse (`RunFeedback`, `version`ed), for the
person to share with Plitzi's team; it is never sent by itself. Each file holds:
- the findings of Plitzi and of the machine;
- the experience, combined (below);
- the lead's report;
- what each agent and the lead spent, and the results read again the most;
- each agent's life in figures (`lives`): how often it was started and stopped and why, its minutes at work, stopped
  and silent — what a board reading "no signal", or a team stopped for good, is read from;
- what each brief weighed (`briefs`, `briefs.ts`), part by part — primer, brief, files, shapes, imports — off the log's
  `brief` entries `task context` writes: a primer or a task that made every brief heavier is seen there;
- refusals by code, and checks by step.

Notices of Plitzi (`run notice --plitzi "…"`) are among the findings, grouped when two agents said one thing. They never
reach the project's backlog. Nothing of the project's code is in either file and no token; the project's folder and the
person's home are said as `<project>` and `~`. A run's log goes with the run: velada-polish's lead had the next run's
work nowhere the next run reads, and la-velada's empty stats cell was seen in two runs and noted "predates this task"
in a review each time.

**More leads for a larger team** (`leads.ts`). One lead reviews for four agents (`AGENTS_PER_LEAD`): past that, tasks
waited for its review in v12. A team of five or more has `lead-2`, `lead-3`… beside `lead` — `"lead": { "count" }` in
`team.json` says another number — recorded in `run.json` (`leads`) when the run opens or a stage raises them. Two levels
and one queue, no lead with agents of its own — **started only when the reviews queue up**, since one waiting for
reviews it is never handed spends tokens on nothing: `lead` reviews every task, taking each from the queue (`task next
--role lead --take`), until two wait and the oldest waited five minutes (`REVIEW_BACKLOG_MS`) — then `run watch --until
lead` names the one to start; one handed nothing for four minutes (`IDLE_LEAD_MS`) is told it can stop — at once when no review waits and the tasks left are no more than the other leads, who review one each (`spareLead`), and a lead that
asked within the last minute (`leads-asking.json`) is running. A lead that reviews answers questions too (`answering.ts`):
with no review for it, `task next --role lead` hands it the oldest question to the lead no other lead took
(`answering.json`) — what the code, the plan or the original answers; a choice for the person or a change of plan it
leaves — and `lead` hears what it said (an fyi), woken for the question only once it waited `UNTAKEN_REVIEW_MS`
unanswered. A message to a task answers its one open question; with two open it is refused until `--reply-to` says
which, and one to `all` answers none (velada-dress: a note to every task marked a question answered). A lead that reviews waits with `task next --role lead --follow --take`,
which offers it a task in review no other lead took (`TaskState.reviewer`, for the round) — one it sent back first, then
the one that waited longest — and reviews it as `lead` would, as strictly; a review another lead took is refused to it
(`claimed`). Everything else — planning, amending, stacking a stage, answering, notes to every task, unblocking,
reassigning, reverting, reconciling, the summary and the finish — is `lead`'s, refused to a lead that reviews and to an
agent of the team (`lead-only`), so two never do it twice. With nothing waiting for it, `lead` helps: `task reassign
<ready task> --to lead` makes the task its own, worked in its copy and completed as an agent's is. `lead` may review any task; while one of them runs, `run watch
--until lead` wakes it for a review only after it waited two minutes with no lead taking it (`UNTAKEN_REVIEW_MS`). Two verdicts on one task are given one at a time (`review.lock`): the second reads it said.

**Connected as it goes.** A shared file a task changed — or any file no task at work holds: a done task's, one in no
task — is taken by turns at `complete` when nobody else holds it, so it merges with the task instead of waiting for an
integration task — an integration task holds its file only while it is worked, and there is one a file: what is
requested while it waits joins it; when the run's version moved since the copy was made, the two changes are put
together line by line (`merge3.ts`: changes to different lines both go in; two additions at one place one after the
other, the run's first; the same edit to a line with different additions after it — a trailing comma, then each its own
entry — joined, the separator carried; the same lines changed two ways, a conflict). A merge made at approval goes in
only after the project's checks pass over the whole result. `run preview` serves the run's work in the run's cache with
the project's dev server, and each approval writes into it — the project's `start:preview` script, which `plitzi create`
writes and `plitzi upgrade` adds, so the person watches the agents' work in a browser while their own `start:dev` serves
the project untouched; that server says so on its console while a run is open (`hosts/project/agentRuns.ts` in
sdk-server, reading `ACTIVE_RUN_FILE`), `run open` names the script and `run status` the preview's address; `run preview --task` serves a task's copy while it is in
review, so the lead looks at the pages before approving them; the run's preview keeps a snapshot of the run beside it
(`preview-run.json`, the shape `@plitzi/sdk-shared/runs` names) and hands its path to the project's server
(`RUN_STATUS_ENV`), which answers it at `/__plitzi/run` — the page's dev tools show it in their **Run** tab: each task,
who has it and who reviews it, why each waits (`why`: the tasks a pending one starts after, the file a waiting one
needs, what blocks one and who acts — `run status` and `run monitor` say it too), what needs someone; no other server
answers it, so the tab asks only a page its server marked (`runStatus` in the payload, set by `runStatusStage` on each
request it lets by) — asked everywhere, every page in debug mode logged a 404 every three seconds. A run that ends (finished, aborted)
stops its preview before its folder goes (`stopPreviewOf`): the record first, which the preview reads as the end, then
the folder once it stopped — never a server left watching a folder removed under it. `run monitor` is the same run, live, for
a person in a terminal of their own: it only reads (nothing marked read, nothing the lead is woken for touched) and
refuses a shell with no terminal, an agent's, whose is `run watch`. It is a board for a supervisor: the run and the stage at
work (`stage 3: velada-motion`, its goal under it — `run extend` logs each stage's), what needs someone on top; under it the run's flow, always — its kanban, each task a card in its stage from to-do to approved, with what holds
an agent; a task a review sent back is at work again with its agent, its card marked with the round it is at
(`t-boxer ↺2`), never a stage apart. An agent is at one task at a time — the one it last did something on itself (taken,
a heartbeat, a write: `TaskView.workedAt`, never a review that sent it back); the others it holds are held for it
(`parkedFor`: `t-home dev-2 at t-overlay`), so an agent is never on two cards of the flow at once. A lead is "reviewing"
or "finds out" only at a review or a spike a card names it on; what it did lately with nothing in hand is its last, idle
— a pending task's card says whom it follows (`t-motion ← t-boxer, t-lint`) (`f` hides it), a stage with more cards than it shows scrolled by the wheel over it
(`↑ 5 · + 7 more`, `FlowColumn`, `wheelTarget`); the tasks left and the agents, each with its state — at work,
waiting, asking the lead, stopped, done, idle while its task waits for its review — each saying what it is at in words:
the step it reported in its own (`task progress --step`), else what it ran last ("measuring /cart against the
original"); one not started says so, one running before anything of it reached the log is "getting started", and none
shows a command line, which is the lead's to read in `run watch` — fifteen listed at most, the rest scrolled to with ↑↓ — and the approved
folded in a line naming them (`a`); last the activity in columns (time, who → whom for a message, task, what), every row
the rest leaves, down to the terminal's foot, an event repeated in a row one line
(×N, opened and folded with a click), paged with ← → and the wheel. Each line says its event for a glance — 72
characters at most (`SHORT`, `feedLine.ts`), in its own words where the whole would be cut: "checks fail: lint, 2
acceptance lines + 1 file of other tasks", "stops for a fresh context" — and keeps the whole as its `detail`, opened
under it with a click (▸); encore-2's ran to 499 characters a line, a tenth of them past 200. The dev tools' Run tab
shows the same, the whole on hover. Beside the activity, as wide as it says and the activity taking the rest (a line over it when that would leave the
activity under 80 columns), **the spend** (`monitorSpend.ts`): what each agent's harness spent so far — the lead's and
the reviewers' too — its pieces of work, turns, tokens **in** (fresh input and context written to the cache), **out**
and **cached** (its context read again each turn: a tenth of the price, and most of what is read — one figure of all
three said 1.1M for one spec of encore-3's tester, ~240k its price), and its context now, marked past `freshContextAt`
for an agent of `"session": "context"` alone; its sessions — the sessions its commands ran in — and what one costs
on average, in and out (`AVG`): agents start fresh in different ways, a task each or past a size, and the average is
what a task costs. It sits under the agents and the activity under the tasks, on the board's one split
(`boardSplit`). Sorted by in+out, `s` turning it to average, cached, context, name. It is kept in the run's log as each
piece of work ends (`spent`, `spent.ts`): a task completed, a review decided, each from the agent's last, read from
its sessions as the round's report reads them (`harness/spentIn`). It fits the terminal it is in (`monitorBoard.ts`,
`monitorFlow.ts`): the flow's stages in bands on a narrow one and its cards fewer on a short one — each stage's count in
a line where not even a card fits — the agents in brief under the tasks under 140 columns, the activity's columns as
wide as what they say, the keys wrapped rather than cut, and under 24 rows the activity gives its rows to the board. It
watches the run's folder and
draws again the moment the CLI writes to it, every second for its clock, in one synchronized frame. Everything that
waits on a run — `task next --follow`, a file's wait, a question's answer, `run watch --until lead`, `task inbox
--follow` — wakes the same way (`runChanged.ts`), on a change, not at its next look: a hand-off is as quick as the CLI
writing it. The activity says what each agent is at between tasks (`waiting`, `idle`, `stops`), that every task is
approved (`all-approved`) and, at a whole and checked dry run of the finish, that the run is ready and whose step is
next (`ready`). `task show` (`show.ts`) gathers the rest of a review —
acceptance, checks, agreements, notes, what was said, each file's diff against where the copy started, the commands that
act on it; `task show <task> <file>` is one of those files whole, read from where the diff is (`showTaskFile`).

**No task ends with failing checks**: `complete` refuses. `--known-failure "why" --fixed-by <task>` takes it to review
anyway — said in the review, `run status` and the report, and to the task that fixes it; the final merge still needs
every check green.

**Nor one that breaks what another was accepted on**: once its own lines pass, `complete` runs again, on the same copy,
the lines of approved tasks that check a page its files draw (`othersHeld`) — encore's stats panel and its retro
`/design` broke three such lines, found only at the finish. One that fails refuses it, naming whose; a change that
means it (a page moved, its words rewritten) completes with `--known-failure "why" --fixed-by lead`, and the lead amends
that task's line (`run amend` of its stage's plan).

## Who owns which file (`ownership.ts`)

One agent per file, and a page is rarely one file: it is a folder of modules importing others every page imports. So
ownership is read off the imports, with the project's own TypeScript (`fileImports`, shared with `packSource`):

- The project's entries — the space's, the actions', the functions', the runtime's — are shared: everything goes
  through them.
- Each module an entry imports is a **unit** (a page, a layout, a component, the tokens), and so is each plugin's
  folder, whole: a page importing a plugin's declaration reads its contract, it does not share its files. A folder the
  entry loads its pages from (`pagesIn(new URL('./pages/', import.meta.url))`, read off the call — `pageFolderLoads`,
  shared with the lint's unused files) imports each page in it by convention (`pageModulesIn`, `@plitzi/sdk-shared`'s,
  the same rule `pagesIn` imports by): a page made there is a unit at once and writes no line in the entry, so two
  tasks adding pages share nothing — `run rehearse` counts no registration for it.
- A unit owns the modules only it reaches. A module two units reach is **shared**. A file no unit reaches (a data file,
  an image) is a unit of its own.

A plan names units; `checkPlan` expands each with what it owns and refuses a file in two tasks, or a folder that is not
a plugin's. What the job asks that the run does not do is the plan's `leftOut` — said at `run plan` (and that nothing
is, when it says none), at `run open` and in the report — so the scope is a choice made with the person, never found
after (la-velada's copy left the tier list and the hero's logo out, unsaid). The plan's `inventory` lists the job
piece by piece (`inventory.ts`: `{ id, piece, page?, leftOut? }`): each piece is covered by a line of a task's acceptance
a command proves (`{ said, check, covers: [id] }`) or waits with its reason, and `checkPlan` refuses one that is neither,
a line covering a piece not listed, or an id twice — so coverage is checked at `run plan`, held at `complete` and on the
whole result at the finish by the covering checks themselves, and listed in the report (who covered each piece, or why it
waits). A stage's lines may cover the run's pieces. A plan with no inventory is said, not refused. A plan that copies a
site says it (`reference`, its address): once the run is open, `plitzi run reference` keeps it (`reference.ts`) — each
page of the inventory, and its home, pictured and its words measured at 1440 and 390 in both schemes, in the run's
`reference/` — and `page shot --compare` on that site, in the project or a task's copy, measures against what was kept
and says when it was kept (`--live` asks the site as it is now). A page the site answers with an error is never kept
as the page — a 429 or a 503 is asked again 10 s and 30 s later, the pages a moment apart (la-velada's original
answered its fighters' list with "You are being rate limited"). Keeping it says, too, each page's section headings no
piece of the inventory names (`unnamedSections`: an h1 or h2 drawn, not a card's title beside others like it, words
compared without accents or case) — what the plan may have
missed, for `run amend` or a stage: la-velada's lead left three pieces of the artist page out, found only at review. The site may change while the run works or after:
la-velada's original redesigned its fighter page after the copy, and a comparison with it measured another page. The
run finishing removes it with the rest of its folder. It says — never refuses — a file of a task that other tasks' files import (what it exports is their contract:
change it compatibly, or say in the plan who follows it), and the tasks whose acceptance no command proves (they hold at
their review only; a check runs at `complete` and again at the finish). A task holds its plan's files only until it is done: then a shared one among them (the entry a shell task
split up) is requested like any other, and the rest are taken by turns. Shared files are taken **by turns** (`task
claim`, `task wait`: a `turn` lock, handed to the next waiter by priority when the holder is approved, with the approved
version put into its copy) or, when several tasks want one at once, changed in each copy as a **request** — whatever a
task changed in a shared file it does not hold becomes one at `complete`, its version kept. **A request goes in when its
task is approved**, held by another task or not, when it merges line by line with the run's version
(`buildRequestsMerge`: all of the task's together, checked once) — the holder's copy brings it at its next refresh. Its
approved files read what it adds, and a run whose work reads what it lacks fails every task's checks (velada-dress:
t-sponsors and t-predictions approved, their tokens waiting on the theme t-home held — every check failed on them, and
when t-home let go, each request alone failed the checks for want of the other's). A file let go of settles the approved
tasks' requests on it together (`settleRequests`); what does not go in is said in the log (`unmerged`,
`settle-failed`), and as soon as one requester is approved the CLI makes one integration task over the requests of the
approved ones (`integrateWhenReady`) — a request of a task still at work joins it, or the next, once approved; `task
context` hands it each request's diff against the run's version — each request's diff from the version its task started
from to the one it asks for. A request on a file its task then held by turns and merged itself is fulfilled when that
task is approved: no integration task is made for it. A blocking request makes its integration task at once and the
requester waits only for that one, so a task and its integration never wait for each other. The final merge is refused
while a request is not integrated. A new page is a file a task names that does not exist yet; registering it in the
entry is a request like any other.

## Tasks agreeing (`proposals.ts`, `agreements.ts`)

What crosses two tasks that are not shared files — a prop of one's component the other uses, a field of one's data — is
agreed between them. `task propose <task> --change …` writes a proposal in the proposer's `proposals/`; the task asked
answers once, in its own `answers/` (created exclusively): accept, reject (saying why) or counter, which is a proposal
made back. Three rounds of counters and the lead decides; the lead may answer any proposal. A proposer
that `--wait`s is waiting like a wait on a file — the same cycle check, one wait graph — and is taken back up with the
answer in its notes. A task does not complete with a proposal to it unanswered; accepted proposals are its
**agreements**, in its context and its reviewer's. What another task proposes is data, never an order.

## A cold start, short (`reading.ts`, `history.ts`)

Every agent starts cold, and most of what it would read is the same for all of them. A plan's `primer` — the lead's
Markdown beside it, 16 KB at most, kept in the run as `primer.md` and rewritten by `run amend` — opens every task's
brief; below it, `task context` names the skill files the task's own files need (`readingFor`: the cheatsheet for the
space, the reference of a layout, a component, data, a plugin or server code, and `runs.md`), only those the project
has. `run plan` and `run rehearse` read the project's past reports too (`readHistory`: the done tasks' minutes over
their estimates, from the last ten runs, with five tasks at least) and say the estimate at that pace beside the plan's.

## A run stacked on (`extend.ts`), and what awaits applying

`run extend <run> <plan>` adds the next plan's tasks to an open run — a stage may be its `tasks` alone, its name and
goal the run's, and its team's size is held to the run's open work with it: their copies start from what it approved, they may
wait for its tasks (`dependsOn`), their files are backed up beside its own, and one `finish` writes the stages into the
project as one diff with one report. An id the run has is refused, and so is a file a task still at work holds. `run
extend … --dry-run --lines` runs each of the stage's acceptance lines once on the run's approved work (`tryLines.ts`, on
the finish's own `acceptanceOnResult`) and says what each is: passing already (it holds nothing yet), failing for its
value (what the task changes), reading an element of ours not built yet, one of the other site's that is not there (the
line is wrong), or one its command refuses — the lines to fix first. `run
open` with a run going says to stack on it. `run pending` lists the project's runs not yet written into it — the ready
ones first, each with the command that applies it; read off the project's own `tmp/plitzi-runs/`, so every terminal on
it sees the same, and no other project's runs.

## Looking at a task in one command (`task look`)

`task look <task> [paths…]` serves a task's copy as it went to review, runs this CLI's `page check` from the copy at
1440 and 390 and `page shot` light at 1440 and dark at 390 for each path, each a child process, and stops the server:
the review a lead made by hand in four or five commands, while every agent waited. `--before` sets each page beside the run before the
task — its approved work, made in the task's cache and served for the look (`startBeforePreview`) — by `page shot
--compare`, and says what changed, section by section, or that nothing did: what the task moved, and that nothing else
did, where velada-now's designer copied a folder and started two servers by hand for every review. A server on this
machine is compared as the project, its scheme chosen as a visitor's toggle chooses it — and, both sides being the
project's, held to what the project changed: motion reduced, and every picture from another site stood in for on each
side by a square of a colour its address gives it (`standIns`), so the same picture is the same on both and another one
differs (velada-polish: a busy CDN's 429s made 21–31% "differs" at 390, and the same look said 7%, then 0%). The page's
own picture of a comparison is `-after.png`, beside the run before in `-after-compare.png`. Its dress is compared detail
by detail: what there are fewer of, by how many — a kind counted whole listed details still there as lost — and a look
this page lacks is said on the element of ours where the other page wears it (`absentOn`: the named element drawn at
that place of the section — "lacks box-shadow … — at ours: match-result"), here and in `--dress`'s failure. `--width`,
`--scheme` (each width in each) and `--status` (a not-found page, `--status 404`) are `page shot`'s and `page check`'s.
A server of the look that stops under it is said, with why and its last lines (`preview-server.log`,
`before-server.log` in the task's cache): what failed after is no finding of the task's. A task that writes a part of a page
others build too — a section of the home — is looked at as that part (`taskParts.ts`, off the copy's own authoring:
the elements its files write): its pictures clipped to its outermost elements (a provider's children, as it draws no
node), and the page check's findings on other tasks' parts set apart and counted — a stub of theirs is no finding of
its. A whole page, layout or component of its own is pictured whole, as before. A copy its agent's own server still
serves (its `tmp/dev-server.json` answers) is looked at there and left running — a second server would not start on
the copy's state, whose kv lock the first holds; `run preview --task` follows it the same way. So is one a `page shot`
kept (`lingering.ts`), its use marked while it is followed so its watchdog leaves it; and a copy a look serves is said
(`previewed.json`), so a `page shot` in it pictures through that server rather than start a second beside it. `--hover <id>` is
`page check --hover` on each page and one more picture at 1440, light, with the pointer over it (`page shot --steps
"hover …"`, taken apart so a missing element loses only that picture). A copy's server is told from another copy's by
`/health`'s `Instance`, a mark of the folder it serves (`projectMark`): copies share the project's name, and
`page check` in one copy refuses the port another holds, and `task complete` counts a server on the port as its copy's
only when `/health` names the copy. A copy's `start:dev` without `PORT` takes a free port from 8080 and holds it while it
starts (`reservePort`, a lock per port): two copies started at once no longer meet on the same one.

Its pictures are the run's (`<run>/shots/`), and so is a `page shot` taken inside a task's copy (`<run>/shots/<task>/`):
read by the lead while the run is open, gone with it — never left in the project's `tmp/`, which is the person's. An
agent's own files beside its work — a script, a log — go in its copy's `tmp/`, or between tasks in the run's
`scratch/<agent>/`. What appears in the project's `tmp/` while the run is open and is no tool's (`TOOL_TMP`: the runs,
the reports and backups, the dev server's record, `shots/`, `visual/`…) nor an input the lead handed the run is said to
the lead (`left-in-tmp`, `strays.ts`) and at the finish, and to every agent by name once, with its next command
(`task next`, `progress`, `check`, `complete`): whoever left it hears it, whatever it holds. `task next` hands each
agent its scratch, made. Never removed by the run.

## Who works the runs (`team.ts`)

Who works a project's runs is its own choice, in `.plitzi/team.json` (committed: it holds no secret, so it needs no
`.example` as `.env` does). `plitzi create` writes the starter (`STARTER_TEAM`): two developers — one started with the
run, the other on demand — and a designer, since each agent spends tokens; the person grows it when a job asks. It
names every model — the lead (at `"effort": "high"`) and the designer on `claude-opus-5-5`, the developers on
`claude-sonnet-5-5` — because the models are the file's,
never the CLI's (one deprecated is changed there, in sight): one it leaves out is the harness's own, and a lead that
reviews (`lead-2`) starts on the lead's. And an `about` that
says what each field and each role the CLI knows means (`ROLES`: developer, designer, reviewer, tester, writer; any
other name is a role of the project's own), since JSON has no comments; `about` is the CLI's — never read, written as this CLI says it whenever it
writes the file, and brought up by `plitzi upgrade` with the files, the agents left as they are. The file is formatted as the project's Prettier leaves it (`formattedJson`). `run team` lists the roles too. The file
holds the leads' model, effort and count, and each agent — its `effort` too, how hard it thinks (`low` to `max`:
Claude Code's `--effort`, Codex's reasoning effort, `max` its `xhigh`; opencode takes none from the command line), the
harness's own when not said — a name (`dev` is `dev-1`, `dev-2`…), the roles it takes, how many of it and the model to start it with, the
harness's own name for it, nothing checked but that one is named — and its `options`: `designReview`, how closely a
designer reviews another task's UI (`light`: its pages at 1440 and 390 in the default scheme, nothing it does not touch;
`standard`, the default: both schemes and widths, its sections against the reference; `high`: every page that reads its
files, against the run before it too), handed with each review (`DESIGN_LOOK`). A review costs what it looks at:
velada-now's strictest took 83 steps, more than the task it reviewed. The CLI starts no agent; `run plan` says what to start
each with — its roles, its model, the plan's tasks it takes and `task next --role <roles> --follow --take --agent
<name>`. The team's size is how many agents work a run at once — no flag says otherwise; a project made before the starter gets
it at its first run, with an agent for each other role its plan names, said; a team somebody emptied is refused. A task whose role nobody in the team takes
is refused at `run plan`; an agent of one role is held to it in a rehearsal. `run team` shows it; `run team set|unset
<name>` changes one agent, or the leads' model and count (`lead --count`), saying it before and after.

**A model a quality level.** A task says what it asks of its model (`quality`: `light`, `standard`, `high`); where the
plan says none, `run plan` sets one and says why — `high` for what three tasks or more build on, or what other tasks'
files import; `light` for ten minutes on one file; `standard` the rest. An agent's `model` is one name, or one a level
(`{ "standard": "…", "high": "…" }`, `run team set <name> --model standard=…,high=…`): each level is started apart
(`design-1-high`), and `run plan` says which tasks are each one's. An agent started at a level (`task next --quality`,
`PLITZI_QUALITY`) is handed tasks of it or below, never above — and told what waits above it, for the lead to start a
stronger one. The strongest model works only what is worth it (la-velada: the designer, on the harness's own model for
every task, spent the most).

**Agents on demand** (`onDemand.ts`): a group's `min` (1 to its `count`) is how many start with the run; the rest are
on demand (`StartedAgent.onDemand`). `run plan` says to start only the first; `run watch --until lead` tells the lead,
role by role, when work waits — a task of its role ready, a UI review no designer is free for —
and no running agent of it is free (`agents-needed`), naming the next one to start and its command — one on demand
beside one running only when the work waiting, coming and in hand, shared with it, is `TASKS_PER_AGENT` (2) each or
more, as `run plan` counts a team's size (velada-shell's watch asked for dev-2 for two tasks the plan had said were too
few) — coming is a task of the role that waits only for work under way (lx-product's t-buybox, behind t-description in
hand: four cards for one developer, and no dev-2 asked); a
UI review its author alone could make asks whatever the count — and an agent on
demand that waits `ON_DEMAND_IDLE_MS` with nothing for it, and no task of its own that may come back, stops by itself,
said in the activity — the lead starts it again when work waits. **The base goes first** (`freeBaseAgents`): a task ready is offered to an agent on demand only past what the
team's base agents of its roles — there (marked present) and at nothing — take; with them free, it is told so and
waits. **The base stays** while the run is open: `task next` never tells one of it to stop for want of work — it waits
(`--follow`) for a stage the lead stacks or a task sent back, and hears how its own work ended (`worked`); only one on
demand stops, and one stops between two pieces of work for a fresh context (below). A base agent not running is asked for whatever waits
(`agents-needed`, the run open past `STARTING_MS`) — once the run has a task that is not a spike: a run opened on its
scope is the lead's, planned with the person ([runs-plan.md](../../apps/cli/skills/plitzi-cli/reference/runs-plan.md)): encore-2's designers and tester, stopped once every task was done,
were stopped when a stage came. **Running** (`running.ts`, `agentsNow`): an agent the CLI launched runs while its process
does (`launch.ts`); one started by hand, by the log — it said something and has not stopped since, a stop holding until
it comes back for work (`stoppedAgents`: a notice sent on its way out is no sign of life — encore-2's tester read "no
signal" for half an hour after one). The monitor shows one not running as on demand, or stopped, never as idle.

**The keeper** (`keeper.ts`, `plitzi run keep`): with the team's `options.launch`, the run starts the agents it asks for
— the base not running, one on demand for waiting work, one a task was sent back to — by itself, every few seconds,
whatever the lead is doing; `run open`, `run resume`, `run attach` and the lead's `run watch --until lead` start it,
one a run (`cache/keeper.json`, its log `cache/keeper.log`), and it ends with the run. Only the lead's watch started
agents before, so while the lead reviewed or wrote a stage, ready tasks waited with no developer running (encore-2).

**A model one harness does not run** (`harnessRuns`): the team names a model once, for every harness — Claude Code
runs a Claude one (`claude-…`, `sonnet`), Codex any other, opencode `provider/model`. One the harness does not run is
not passed: the agent starts on the harness's own default, and `run agent --launch` says so.

**A fresh context** (`freshStart`, `nextRules.ts`; a team agent's `"session"`, `options.freshContextAt`): the CLI cannot
empty a harness's context, so the agent ends its session instead — always between two pieces of work, a task completed
or a review decided, never in one, so nothing it knows and has not written is lost. Its session is what it did since it
was last launched or stopped (the log's `launch` and `stops`); once a piece of it ended, `task next` tells it to stop,
before its own work is handed back — never while it is in one (`inAPiece`), read off the tasks' state, not the log: a
task it holds at work, waiting or blocked (a `task next` comes from an agent in a task too, its task blocked or given
back), one sent back it took up again, a review it took and has not decided. Past the threshold or not, it stops only
once that piece ends: `"session": "task"` (the default, `DEFAULT_SESSION`) after each piece; `"context"` once its
harness's context — its last turn's, read from the session (`harness/contextNow`, Claude Code, Codex, OpenCode; another
harness's is never read, and its agents are not stopped for it) — passes `freshContextAt` (250k tokens, from 60k);
`"keep"` never. The piece it just completed, sent back already, comes first instead: its context is what that round
needs. The lead that plans never stops for it — the person talks to it — nor an agent outside the team: only the
team's agents and the leads that review are started again by the run. The keeper starts the agent again — of the base, whatever
waits; on demand, when work of its role does — and any task sent back to an agent not running asks for it by name,
which it takes first. Every turn reads the whole context again: encore-2's developers, a session a task, read ~12k
tokens' worth a turn and ended each at 58–113k; its designer and tester, never started again, grew to 400k and read
26–30k a turn — more, the two, than the developers' 49 sessions; a start costs ~40k tokens written, about what a
piece of work carrying 50k more context reads again in ~15 turns. `sessionPerTask` was this rule's `"task"`, for
tasks alone, and asked for; a team file that says it is refused saying to remove it.

**An agent started again after it died** (`launch.ts`). `run agent --launch` keeps what it started in
`scratch/<agent>/agent.json`: the pid, the harness, when, and the session. In Claude Code that is a session id of the
CLI's own (`--session-id`). Started again, the agent is refused while that process still runs as its harness, because
two sessions of one agent read one log. encore's dev-2, started again while its last session was still writing its
stop, read the old completion as its own and stopped. Then, when the team asks it (`"resumeSession": true`,
`run team set dev --resume-session`), it resumes that session (`--resume`). That needs four things: the agent died
with a task in progress, its last word in the log is not a stop, Claude Code still keeps the session
(`<CLAUDE_CONFIG_DIR>/projects/<the folder, dashed>/<id>.jsonl`), and the session is no larger than
`DEFAULTS.resumeMaxBytes` (8 MB). Past that size, reading it again costs more than a fresh session that reads its task
anew. Otherwise the agent starts fresh, and the launch says why. encore's machine went down with four agents mid-task.
Each started again on a fresh session took its task back from its copy within two minutes, and lost only what it knew
and had not written yet, which is what resuming keeps.

**An agent just started is not silent** (`options.startGraceMinutes`, `DEFAULTS.startGraceMs` — 3 minutes — when not
said). For that long after its launch, and until it stops, the tasks it holds do not read "no signal" and it counts as
running. Its harness is loading and its skills are being read. Without it, every agent started again after encore's
crash read "no signal" and "not running" at once, its last word from before, and `run watch` woke the lead for nothing.

## The tester's tasks (`tests.ts`)

A tester reviews the code first: `task next` hands it the tasks in review that wait for no designer, as it hands a lead
that reviews (`leadReviewFor`), its verdict is a lead's — its approval approves the task — and it never reviews what it
worked. While a tester runs, `run watch` wakes the lead only for a review none took in `UNTAKEN_REVIEW_MS`: the testers
the bottleneck. A team with no tester leaves every review to the leads.

A tester in the team gives every developer task a task of its tests, `<id>-tests`, a tester's, after it: tests written
from the task's acceptance, not its code, by an agent that did not write it. Its files are where the project's tests are
— a page's spec in `visual/<page>.spec.ts` when the project has Playwright, a module's test beside it (`<file>.test.ts`,
`node --test`) — and its acceptance runs them against the copy served. A check that names `$PLITZI_URL` or `$PLITZI_PORT`, or runs
`playwright test`, is run with the copy served: the two written into the check (any shell, `cmd.exe` included) and
`PORT` set, which the project's Playwright config reads. The `plitzi` a check calls is this CLI (a `.cmd` too, on
Windows), and the server is stopped as a tree there (`taskkill /T`), a process group elsewhere — a preview's too (`processes.ts`). Two developer tasks whose tests are one file share one task of them; one that says `"tests":
false`, writes nothing a test is written for, or that a tester's task of the plan already waits for, gets none. A test
the work fails is told to the lead, not bent: `complete` with `--known-failure` says why and which task fixes it.

## What the data never shows

A case the project's data never reaches — an age no dog in it has, an empty list, a failed answer — is seen by
nobody: the designer's look, the tester's page specs and the lead's `task look` all show the data as it is. Finding it
is the lead's, when it writes the tasks (the reason the lead is the strongest model): the plan says how such a case
is seen — a row in the data when the demo should show it, or a unit test of the module that decides it, in whose task.
The designer says one it could not look at (`--approve --note`); the tester's derived task holds one with a unit test
and tells the lead; and the lead, reviewing, tests the module's edges itself or sends the task back for the test.

## The designer's review (`design.ts`)

When every designer is at a task of its own, a UI review waits for nobody: the lead's queue offers it too (`uiToo`:
review its UI as well, approve with `--skip-design lead`), and the run's view says it (`ui-waits`: start another
designer, or review it), which wakes the lead.
A ready task whose file another task holds is not offered (its take would be refused, `claimed`): `task next` says whose
it waits for, and `--follow` waits. With a designer in the team — or a plan that says `"designReview": true`; `false` turns it off; a stage stacked on
the run keeps the run's choice, and may only turn it on — the UI another role's
task changes (under `src/space/`, but its data, or a plugin) is looked at by a designer before the lead: at `complete`
its state's `design` is `due`. A designer's `task next` offers it before any task of its own (`--take` makes it theirs:
another designer is not offered it), with what it changed, the pages it is likely drawn at and what to look for; the
designer runs `task look`, then `task review --approve` — the task stays in review, the lead's now — whose review is the complete and strict one, and the final word, the code above all once its UI is approved; the designer's is the UI/UX, as a
designer — and `run watch
--until lead` wakes the lead for it then, not before — or `--changes`, which go back to the task as the lead's would and
count as a round. The lead's approval while it is due is refused, naming the designer, unless `--skip-design <why>`
says why — `lead` (the lead looked at its UI itself, both schemes and the phone width: refused without a `task look` of
the task since its last complete, `lookedSince`) or `no-ui` (it changes nothing
a visitor sees; `task complete --review code` says it from the start) — kept as the state's `design.why` and the log's
`designSkip`. The report, the audit, `run watch` and the monitor say each by its reason ("UI by the lead", "no UI"),
never one "skipped": la-velada's report counted 21 UI reviews the lead made as UI nobody looked at. A designer does not review its own work, and is not finished while a task whose UI it may
review is still to be done. A task asks the review it needs as it is sent: `task complete --review code` goes to the
lead's code review alone (nothing a visitor sees changed), `--review ui` has its UI looked at first — by a designer,
the lead's too when none is free — and left out, the run decides as above; the activity says which (`complete`'s
`review`). The designer's changes are logged as its UI review (`design-review`, `changes`), apart from the lead's; a lead
going past a UI review a designer took tells that designer, who still tells the lead what it found with `task tell
--about <task>` — the way any agent holding no task does.

**What runs once is not run twice.** A passing `task check` is kept under a key — the task's changed files, the run's
approved work, its acceptance, the CLI (`tasks/checked.ts`) — for 30 minutes: a `task check` or `task complete` with the
key unchanged says the result again rather than running it (`--fresh` runs it); the copy is served for the acceptance
while the project's checks run (`serveForAcceptance`), and let go however they end. A look at a task with parts of its
own compares each part alone beside the run before it (`compareLocalPart`, no page aligned), and reads that nothing
else moved with `page same --except <its parts>` (positions read from each element's parent, so a part that grew moves
nothing). Its check, its parts' comparisons and that reading run at once, three at a time (`inTurns`); its check stands
in for another site's pictures (`page check --stand-ins`: a look is of the task's change, not a third party's CDN,
which throttled a look's pages and failed them now and then); the run before it is served once and kept while nothing
is approved (`startBeforePreview`, `before-kept/`); and a look asked again, the task, the run and the ask unchanged,
says that look again (`looked.json`, 30 min; `--fresh` looks anew). The sanity run's look went from 50.5 s to 7.5 s, and
to 0.1 s asked again; its complete from 8.5 s to 0.35 s. `plitzi` starts through `dist/bin.js`, which turns on Node's compile cache first (a start ~30% shorter), and
`task take` prints the project's own `node_modules/.bin/plitzi` (npx adds ~0.2 s a call). `PLITZI_TIMING=1` makes every
command the CLI runs of itself say how long it took.

**A look reads both schemes.** Its `page check` runs with `--themes`: each page read in light and dark at its first
width, and a ground the same in both under a text that follows the theme and reads under 3:1 on it in one of them
fails it (`fixed-ground`, `commands/check/themes.ts`) — velada-fidelity's judges' rows were grey bars with a gold count
at 1.5:1 in light, a scheme the reference did not have and no reviewer read.

**A look pictures what can differ.** The pages a task's own files are drawn at are pictured; the ones only a shared
file of it reaches (the theme, a component) are first read on both servers with `page same` — every element, box,
style and pseudo-element — and only those that differ are pictured, the rest said as "drawn the same as the run before
it" (velada-fidelity: nine pages pictured, 204 s, for two tokens added). A page named on the command is pictured
whatever it reads.

**A review has its time** (velada-fidelity: design-1 held one 16 min, a task queued 18 min behind it, both developers
free). A UI review taken is its designer's for `REVIEW_TIMEOUT_MS` (8 min): past it, `task next --take` hands it to
another designer — the first told on its next command (`review-timed-out` in the log), and its verdict after refused as
`claimed`, saying to keep what it found for the next run (`run notice`) — and `run watch` tells the lead, idle team or
not, to decide it (`slow-review`; under the limit, only while others sit free, from half of it). One due nobody takes
for `REVIEW_QUEUE_MS` (5 min) is the lead's to review now (`ui-queued`). A lead that sends a task back with `--changes
… --skip-design lead` keeps its next round's UI review (`design.reserved`): that round comes due to the lead alone,
`skipped` by `lead` — never offered to a designer (velada-fidelity's t-result-card went to design-1 after the lead said
it was its own); a designer reviewing the round it sent back is told its review ended.

**A round sent back goes to the designer who said the one before** (`design.before`, kept as the round comes due with
its time, `since`): offered to it first, and to another designer only past `SAME_DESIGNER_MS` (3 min) — velada-polish's
t-match-bars had design-2's first round and design-1's second, which brought asks of its own and cost a round. Another
designer taking it is told so in its brief: check what the round before asked, and ask anew only what is broken — the
rest is a notice for the next run. A designer's `task look` of the UI it reviews is set beside the run before it
(`--before`) unless it says `--no-before`, and names the pages its changes are drawn at that were not looked at — a
shared file's: velada-polish's design-2 looked at /combates twice, and the home its card change broke was the lead's to
find. The values a review asks for are measured, not guessed: `plitzi page measure <path> "<ours> => <theirs>" …
--compare <url> --width 390,1440` reads elements' computed styles — type, colours, borders, radii, shadows, size,
spacing, motion, and what their `::before`/`::after` draw (velada's VS fill was there, unseen, and the plan asked it
away) — in a state too, an element hovered or focused on both pages first (`--hover "<ours> => <theirs>"`, its
transitions waited for) — and the other page's elements', and says each property that differs, what both inherit from their parent said
apart. Every element at every width is one call, in one browser, the other page read without a picture and kept 6 h
(`tmp/plitzi-cache/measure`, `--fresh` reads it again): velada-fidelity's ~150 calls of one element at ~18 s each were
most of its developers' time; the designers of velada-polish wrote Playwright
scripts of their own, and read the original's CSS by curl, for each one. `--same <properties>` (`font-size,border`;
shorthands `border`, `font`, `size`) fails unless those are as the other page's — the other page asked as a site is,
again when it says it is busy — so an acceptance holds a value to the reference rather than to the lead's guess, and
`run plan` says a task of a copy (`reference`) whose acceptance names values (a length, a colour) no check of it
measures (`measuredValues.ts`): velada-polish's VS sizes were written 2.35/2.75/3.35rem, the original's 3em, and a round
went to finding it out. A stage stacked — `run extend`, or the scope's tasks — says its plan's notices too, which only a
dry run said. What the designer reads is its own half of the run, `runs-designer.md` (`DESIGN_READING`), handed with its
first review; the developers' `runs.md` points to it in a line.

## Files read whole (`longFiles.ts`)

A file past the space lint's `file-too-long` line (`MAX_LINES`, 400 lines that say something) is one nobody reads at
once, an agent least. Every code file under a copy's `src/` that is past it and longer than in the project is said to
the lead while the task works (`run status`, `run watch --until lead`, once a file), to the agent with each heartbeat
and progress, and held at `complete`: a file the task took past the line — new, or under it in the project — refuses
the completion until it is split. One already past it that the task made longer is said, not refused: the project's
debt is not the task's.

## A plan amended (`amend.ts`)

`run amend` reads the plan file again while the run is open and takes what it asks — titles, acceptance, priorities,
estimates, milestones, the goal, and notes more (sent to every task) — into `plan.json` and each task's `task.json`,
telling each task changed what it now asks. A task nobody took leaves the run when the plan no longer has it — under
the take's lock, refused for one taken, or one another task waits for — and the inventory may change, checked again
over what is left (`inventoryProblems`): the scope narrows, a lead's or a person's choice, never in silence; more work
is a stage (`run extend`). The run's shape otherwise — their files, `touches` — is refused, as is anything of a task
already done but its acceptance, every reason at once: a done task is held at the finish by its acceptance, run again on
the whole result, so a line of the lead's found wrong there is amended — it takes the place of the one its review
accepted (`state.accepted`), marked `amended` until the finish runs it, and is said, not told: nobody is at the task.
A plan is any of the run's: the one it opened with, a stage's as stacked, or several joined by hand — each speaks for the
plans whose tasks it holds, read off the log (`extend`'s `added`), never by the `runId` it says: a task leaves only when
a plan that holds its fellows leaves it out, a plan it does not hold keeps its tasks and the pieces they prove, and the
goal, the inventory and the reference change only with the plan the run opened with. A stage that says the run's own id
is named a stage's (`<run>-stage-<n>`) as it is stacked; who a task is for and when — its `role`, `quality` and `dependsOn` — changes while it is pending
or ready, and is refused once an agent took it, as is a `dependsOn` on a task the run lacks, on itself, or in a circle
(`dependsOnProblems`): the lead's way to free a task held behind one it needs nothing from, which `run watch` says
(`held-up`: a pending task whose every remaining dependency is past its work — in review, sent back, blocked — while
agents of its role have nothing to take; whether they share a file decides what it suggests — and `slow-review`, a
review a designer or another lead took ten minutes ago and has not decided while the team has nothing to take — and
`idle-team`, the run as a kanban: an agent running with no card worked, no review in hand and none of its roles ready,
said with the way to feed it — the backlog's items no task closes, the UI of a card in review a free designer could take
(a send-back with `--skip-design lead` keeps the next look the lead's), a large card to split — or that nothing is left;
never a designer while others' work is under way, which waits for its UI reviews, and said once for the same agents
and the same board (`subject`: which agents, how many cards done), whatever its advice's words — lx-product's lead was
woken eleven times for one waiting designer;
`run plan` says the same of a plan with too few cards for its team); so is a plan that changes nothing. `run plan` says
too each acceptance line a script of the lead's own checks (`ownScripts.ts`: an interpreter given a file, or the file) —
written with Plitzi (`page play`, `page measure --same`, `page check --expect`) any agent reads and reruns it — and the
run's feedback lists them: each round names what Plitzi could not check, or was not known to. Its acceptance is held
to `run plan`'s rules, among them a `page check` whose text the shell would split into a page.

## A plan rehearsed (`rehearse.ts`)

`run rehearse` plays a checked plan out with no run opened: each agent — `--roles` holds some to a role, the rest take
any — takes the best ready task it may, in `task next`'s order (urgency — its own priority or the highest of the tasks that wait on it, however far down — then the longest chain still to do, then id);
a task takes its estimate, then waits for the lead, who reviews one at a time (`--review`); what depends on it is ready
once it is approved. It answers the schedule, each agent's idle time, the critical path, the reviews' queue, what was
ready before an agent could take it, and the files changed by tasks at work at the same time — one holding a file
another touches, two touching one, or two new pages registering in one entry — and plays it again for each number of
agents, `null` where some task is never done. One estimate and one review a task: rounds of changes and questions are
not in it, and it says so.

## The run's folder (`paths.ts`)

Everything lives in `tmp/plitzi-runs/<run>/`. `tmp/` is already out of git, the lint, the formatter and the server's
`--watch-path`s; `.plitzi/` is committed and linted, so nothing of a run is there. Nothing assumes git, and the CLI
never commits.

```
active.json          (in tmp/plitzi-runs/) the project's one run, created exclusively
plan.json            the lead's, as written
run.json             status, machine, agent limit, estimate, pinned versions, reconciliation, brake, merges — under merge.lock
merge.lock take.lock one writer of run.json, approved.json and the project at a time; one take at a time
claim.lock           one claim of a shared file by turns at a time
blobs/<sha256>       every version the run keeps, by fingerprint, written once
base.json            the backup when it opened: every file the plan touches and every shared one
approved.json        the run's work: per file its version, the project's version it came from, its task, the previous,
                     and — when the lead wrote it over a change made outside — the override
shared.json          what was shared when it opened
summary.md           the lead's summary, for the report
merges/merge_N.json  each write into the project: before and after per file; `complete: false` while it is written
log.jsonl            the audit: who did what, every refusal, failed check and conflict — what the report counts
tasks/<task>/
  task.json  state.json (+ state.lock)  owner.json  revoked.json  review.json  reviewed.json
  locks/<path>.lock  requests/<id>.json  proposals/<id>.json  answers/<proposal>.json
  cache/work/  cache/start.json  cache/progress.json  cache/log.jsonl
cache/checks/<tree>.json  a pass of the project's checks on one whole result, by its content: said again within the
                     day rather than run again (the dry run's at `finish --apply`)
```

Inside the project, the plan and its primer are moved into the run's folder when it opens (`inputs/`, a stage's under
`inputs/<stage>/`, `takeInputs`): the lead edits them there for `run amend`, and nothing of the run lies beside it in the
project's `tmp/`. What the lead handed the run — the plan, the primer beside it, an amendment (`run amend`), a stage (`run extend`), the
summary — is kept in `run.json` by path and fingerprint (`inputs`) and removed with the run while it is as the run read it,
with the folder that held only them; one changed since is kept, and said.

While the run goes, everything but `cache/` is essential — with no git it is the only way back — and `run prune` removes
only caches (a run idle 8 hours; the oldest quiet ones above 1 GB). **When the run ends, it goes whole**, backups
included: a finished or aborted run leaves nothing for anyone to clean up but its report. `run finish --apply
--keep-backup` keeps the project's files as they were before the merge in `tmp/plitzi-backups/<run>-<time>/`, as plain
files and a manifest; a file written over a change made outside the run is kept there whatever was asked.

**One writer per file.** `plan.json` is the lead's; `run.json`, `approved.json` and the project are written under
`merge.lock`; a task's `state.json` under its `state.lock`; taking a shared file by turns — `task claim`, `complete`,
a turn handed on — under `claim.lock`, since its locks live in each task's folder and two tasks completing at once
would otherwise both take it; `owner.json`, an answer and `active.json` are created
exclusively (`wx`). Every write is a temp file renamed over the target, retried on Windows' transient `EPERM`/`EBUSY`. A
version is a blob named by its fingerprint and a manifest names it, so the manifest is the one commit point: a cut leaves
an unnamed blob, never a named half-written file.

## A spike: research in the run, a lead's (`spike.ts`, `tasks/spike.ts`)

Research — what the lead reads to know what the work is — is work of the run, seen by the monitor and counted by the
report: a **spike**. It decides what is built, so it is a lead's: the lead, or a lead that reviews, never an agent of the
team (whose model is not a lead's). A spike is research alone: a task with `"spike": "what to find out"` and no files
(`run plan` refuses one with files), whose acceptance is in words — a command would run at a `complete` it never reaches.

**A run starts with one: its scope.** As any project does: the lead scopes the person's ask, and the work flows from
there. `plitzi run open --spike "<the ask>" --run <name>` opens the run on it alone (`scopePlan`: one critical spike,
`s-scope`, the plan written in the project's `tmp/` and moved into the run as any plan is). The lead finds out —
`page shot --compare <original> --dress`, the original's computed styles, the project — and ends it with its result,
the tasks: `plitzi task spike s-scope --done "what was found" --tasks <stage.json>`. The stage is stacked as
`run extend` stacks one (refused, it leaves the spike open), and each task carries what was found for it (`"findings"`,
kept as the run's `TaskState.findings` from its first state, `startingState`): whoever builds it reads it in its brief,
rather than a spike per task — found out by one, built by another, each read twice.

**Later spikes are the lead's to open**, when the work asks for one: a research task stacked with `run extend`, ended the
same way. It starts in `spike`, ahead of `ready` (ready is ready to build), whether or not what it waits for is done —
finding out is reading. No agent is offered it or takes it (`take` refuses one); `run watch --until lead` says each spike
waiting (`spikes`), and `task next --role lead` hands a lead that reviews the most urgent one no other lead took
(`spikedBy`) when no review waits for it. Its findings go into the brief of every task that waits for it, made ready by
it (`readyWhatWaited`), no review.

**An agent whose task needs something found out** says so — `task spike "what"`, from its copy — and the task is
blocked on the lead (`blockedBy.spike`), its files and token its own; the agent takes other work meanwhile. The lead
finds out and lifts the block with the answer, kept as the task's finding (`task unblock <task> --answer "…"`; without
one it is refused), or, when it changes the work, stacks the tasks it makes.

`run rehearse` plays research alone without a review. The monitor gives spikes a column of their own (`◇ spike`) once
the run has one, with the lead at it, and the dev tools' Run tab a group (Finding out).

**An answer is taken up** (`handOver.ts`): a question the lead answered holds its task until its agent has the answer —
at its next command, whatever it is — and that is what puts it at work again, said in the activity ("goes on with
t-fights — m99 answered"); until then the board says it is answered, not asking.

**Who is still there** (`presence.ts`): a wait is said once in the log, so the log alone cannot tell a live agent from
one its harness stopped. Each `task next`, and each turn of its `--follow`, marks the agent present in its scratch; an
agent between tasks with no mark for `PRESENCE_STALE_MS` shows in the monitor as `no-signal`, with the command that
starts it again.

## A task's life (`tasks/`)

One module a step: taking it (`take.ts`), what `task next` hands over (`next.ts`), its files and turns
(`locks.ts`), signs of life and blocks (`signals.ts`), `complete` (`complete.ts`), requests and integration tasks
(`requests.ts`), what an approval writes (`approve.ts`), the review (`review.ts`), reassign and revert
(`reassign.ts`), the brief (`context.ts`), and what they all read (`common.ts`).

- **Take:** under the agent limit, `owner.json` exclusively, with a token `<run>.<task>.<secret>`, so every command of
  the task needs only it. A `.lock` per file at the file's path under `locks/`, readable by any hook or editor;
  `run can-write` answers the same. The copy: the project's files — never `node_modules`, `tmp`, `dist`, `state`,
  `.git`, `.yarn`, a `.env` (its templates — `.env.example`, `.sample`, `.template`, `.dist` — are); `.plitzi/` comes,
  what its checks author with, and no task writes it; the binaries of `public/` and `vendor/` it does not own come
  unread (`served`: told changed by size and time, never read whole for a fingerprint), so its pages draw their
  pictures — cloned copy-on-write where the disk can (`COPYFILE_FICLONE`,
  about 0.3 ms a file), then the run's approved work over it, then, for a task cut before, its last reviewed version.
  `start.json` keeps the fingerprint of every file it started from, and which came from the run. **A copy is kept up to
  the run**: when a file is handed on by turns, on `task discard`, and before `task check`'s and `complete`'s checks,
  every file the run approved since the copy was made — and the task did not touch — is brought in, so a granted entry
  never arrives without the pages it imports; and so is a file a person changed in the project since, that no approval
  holds and the task does not own (told by its time first, then its fingerprint) — an older copy checked against the
  project's files as they were fails on a change it never made. A task may remove the `.gitkeep` of a folder it writes into. Packages resolve from
  the copy by walking up to the project's `node_modules`; a command run inside the copy works on the project it belongs
  to, and as its task: `take` writes the run, task, token and agent into the copy's `tmp/plitzi-task.json`, read when no
  token is said (a token said wins — the lead reviewing from inside a copy is the lead).
- **Check:** `task check` runs in the copy what `complete` would hold it to — the project's checks, the acceptance's
  commands, the files too long — and changes none of its work (the copy is brought up first, as for `complete`): no
  review, no brake. `--fix` first runs the project's own linter and formatter on the files the task changed alone
  (`eslint --fix` when its `lint` script is eslint's, `prettier --write --ignore-unknown` when its `format` is
  prettier's: `fix.ts`), and says what they rewrote; a check that fails on lint or format without it says `--fix` —
  velada-polish's dev-1 ran three checks in twenty seconds, twice, on what a `--fix` writes.
- **A task sent back waits for its agent:** while that agent is at another task of its own, the one sent back is
  parked for it (`parkedFor`, "dev-1 at t-menu first") and handed to it by its next `task next`, before anything new —
  never to a free agent, and never read "no signal — reassign it" meanwhile: the agent that wrote it has the context
  its review asks about (Carlos, after encore-2). It was handed to a free agent after 3 minutes before (velada-polish's
  t-match-bars waited ten minutes with two developers free); a lead who wants that reassigns it (`task reassign`). A
  task's holder reads its own with `task show` (its token's task: another's is the lead's).
- **Handed back, and why:** a task its own agent holds comes back with `task next` first, said as it is — changes
  requested, unblocked by the lead, or held all along (`back`): one held while another was worked was said "unblocked"
  right after `complete` told the agent to take no other step. A `--follow` that ends says one rule whatever the agent
  holds: the wait ended, not the work — run it again; only "You can stop" stops it (and a task of its in review comes
  back to it if sent back). A request of a task not approved yet is in no one's attention — it goes in with the
  approval — so `run watch --until lead` is not woken for it; one left once its task is approved is. `--acceptance` runs only the acceptance's commands, the copy served for them, and says the
  project's checks were not run: la-velada's agents iterated on one failing line with the whole check each time (52 of
  their 88 failed checks were an acceptance line). An agent iterating on a fix checks with it,
  and completes once it passes; it hands over what was said to the task meanwhile, which an agent that only edits
  files would otherwise read only at `complete`. What a task declares for the tasks after it — a component, a token,
  read by none yet (authoring's `unused-*` suggestions) — passes a task's checks as a warning the review sees, and fails
  only the finish's, on the whole result (`CheckOptions.final`). A warning of the space's lint in a file the task
  changed refuses `complete` (`checks-failed`) — there before it or not, a file it hands over has none; one written so
  on purpose says it with `quiet` — where one in a file it did not change is said as there before it.
- **Complete:** refused with a proposal to it unanswered, and with its copy gone (said as gone, with the take that
  starts it again — not as every file removed). The copy against `start.json`: a change to another task's file is
  refused (`claimed`) naming each; to a shared file, or one in no task, taken by turns when nobody holds it and a request
  when someone does; a new file nobody names is the task's. A file of the task turned into a link is refused — what it
  points at (the project's `.env`) would go to review as the file. Then the project's checks — `verify`'s steps, each
  the project's script, run in the copy with the project's binaries: `author` first, alone, and the rest three at a
  time once it passes, every failing one printed — then the acceptance's checks (`acceptance.ts`): each `{ said, check }` line's command run in
  the copy, passing on exit 0, with `plitzi` on the path as this CLI (a shim in the task's cache) and `$PLITZI_URL` the
  copy served by its own start script on a free port while they run. A line that fails runs once more after the others:
  one a busy server failed passes then and says it passed on its second run (`firstFailed`), one that fails twice is
  unmet. What each answered is kept in the state and shown by `task show`. An unmet one refuses like a failing check — and goes to review only as a known failure. Then it goes to
  review, **its files kept as they are now** (`submitted`, by fingerprint): what the review keeps and the approval
  merges, never the copy, which its agent may go on writing — `--note` tells the lead what to look at with it. A sign of
  life of a task in review is answered as one in review. `run plan` refuses a check it could not run: empty,
  reading `.env`, or naming `$PLITZI_URL` in a project with no start script — a lint of what the lead meant, not a
  sandbox: what holds is that a copy has no `.env` and a check's environment none of it.
- **Review:** changes go back to the same task, and after three rounds block it for the lead to decide — three of the
  lead's, or three of the designer's on its UI, counted apart: the lead approves it as it is, answers it (`task
  unblock --answer`), or asks the person, since nobody else in the run talks to them. An agent's own block waits for
  the lead or another task (`--needs lead|task`), never the person directly. Approval keeps the version that
  went to review and merges it into `approved.json`; what its copy holds otherwise — written after `complete` — is not
  merged, and said (`notReviewed`, and `task look` warns that what it serves is not what an approval merges). A UI review
  is a designer's of the team, by the name `team.json` starts it with (`design-1`); `--skip-design` is the lead's. A
  designer's own work with no other designer in the team asks for none — the lead reviews its UI with the rest. **Before
  anything is written, each file is checked**: the run's version moved since the copy was made (`conflict`: redo it on
  the run's), a file it made where another task made one by that name first (two files, never put together), or someone
  changed the project's file while the task worked on it. That one stops the approval, naming the file; the lead decides: `--overwrite` writes the task's
  version over the change at the finish — recorded as an override, said in `run status`, the finish and the report, and
  the other version kept — or `--changes` sends it back to take the project's version and redo. Approved, it lets its
  files go to whoever waits, makes ready what depended on it, and makes the integration tasks due.
- **Waiting** on a file or an answer is a state; `--follow` (`task wait`, `task propose --wait`) stays until it comes,
  giving the task's sign of life meanwhile.
- **Signal:** its commands, progress and heartbeats, and the newest write among its files in its copy. Without one for
  15 minutes (or a quarter of its estimate) it is disconnected; its locks outlive that by 30 minutes, then another may
  take it. A cut — reassign, forced stop, a copy gone — revokes the token; the copy stays where it is until the task is
  taken again (a command running in it does not lose its folder), and the next taker starts from its last reviewed
  version, never from what was written since.
- **The lead takes a task back at any time** (`task reassign <task> [--reason "…"] [--to <agent>|lead]`): its agent is
  told why on its next command, the servers it left listening in the copy are stopped, and it goes to anyone, to the
  agent it is handed to (`state.handTo`: offered to that one first by `task next`, and refused to every other at `take`
  — an agent of the team of its role, else refused before anything is cut), or to the lead, who takes it then, a copy of
  its own. The log keeps who, from whom, to whom and why (`reassign`).
- **A run gone stops what its agents left listening**: `finish`, `abort` and `purge` stop every server whose folder is
  in the run's (`stopListenersUnder`, read off `lsof`) and say so — velada-fidelity's copies' servers listened on after
  the finish removed their folders. A kept server's watchdog stops it once its record is gone with the run.
- **An agent stops a server through the CLI, never by name** (`plitzi server stop [--port <port>]`, `commands/server.ts`):
  what listens from the folder it is run in — its own `tmp/` left out, a run's copies each their own — and says by its
  `/health` that it serves that folder (`projectMark`), stopped with what it started; anything else on the port is said
  and left. encore's agent freed a heredoc hung on stdin with `pkill -f "cat"`, which matched every process whose
  command line held the letters and took the machine down: the prompt's rules forbid `pkill`, `killall` and a kill by
  name, a hung command is the harness's to stop, and files are written with the harness's edit tools.

## Into the project (`merge.ts`)

`run finish` compares each approved file with the project: unchanged since the run knew it → written; already the same
→ left; changed since → a conflict. With `--apply` the person is asked first, before any check, and every check and acceptance
line is said as it runs (`ctx.say`, on stderr) — asked after them, a finish of 23 lines sat silent for minutes and was
stopped as hung (velada-dress). The whole result is materialised (project + run) and checked first — a dry run by
default, listing what is written over a change made outside — and so is what each done task was accepted on: every
`{ said, check }` line that passed at its review runs again on the whole result, so one a later task broke (the print of
a page another task grew) stops the finish, naming both; a pass of either on the very same result (and, for acceptance, the same kept reference) is said again within
the hour, not run again. `--apply` with conflicts writes nothing and puts the run
into **reconciliation**: no task starts and no merge goes in until the lead resolves each file (`--take
project|run|<file>`; the run's or a file of its own is an override, said and kept) and continues. Without conflicts, it
needs the lead's summary, then a person's confirmation, and under `merge.lock` the merge's journal is written
first, a backup of each file it overwrites, then each file; a failure puts back what was written. A journal left
`complete: false` by a cut is undone from its own backups before the next merge or restore goes in. Then the report is
left and the run removed. Undoing the final merge is git's, or `--keep-backup`'s files: the run is gone.

`run restore` puts one project file back, while the run goes, from `base.json` or from before a restore.

## The report (`report.ts`, `taskReports.ts`, `findings/`)

The run reports itself, so the lead keeps no list of problems by hand: encore's lead kept 65 in a journal, each found
by reading the log.

**Each round, as its agent completed it** (`taskReports.ts`). `task complete` keeps the round at
`tasks/<task>/reports/<round>.json` (round 1 is the first sent, as its review counts). It holds:
- its time and its sessions;
- its `task check`s, what failed in them and what each failing step last said (`checks.why`), and what it was refused;
- every command it ran: what each printed and how long it took; for one that failed, its reason and the lines of its
  output that say what failed — a page's console errors and failed requests among them (`errors`, `verdict` when the
  failing is what it says of the work);
- what it asked `explain` and what found no answer;
- what it noticed of Plitzi;
- what it was like to work with Plitzi, in its own words (`experience.ts`; the agent's prompt asks for it, and
  `complete` refuses without the first two, before anything runs):
  - `--ease <1-5>`: 1, it fought Plitzi; 5, Plitzi got out of the way;
  - `--hardest "…"`: what cost the most — time, tries, tokens — and why;
  - `--friction "…"`, again for each: what of Plitzi got in its way;
  - `--helped "…"`, again for each: what helped, which a change must not take away;
- what its harness spent (`harness/`): the harness, its model, effort and version; turns, tokens read fresh, from the
  cache and written, its context at the end; the results that weighed most, by the tokens they were read again for in
  later turns; and Plitzi's own files it read — a skill's, a package's types — and how often.

The harness's spend is read from the sessions it keeps on the machine, summed for the round's window:
- Claude Code's by its session id (`~/.claude/projects/*/<session>.jsonl`, `CLAUDE_CONFIG_DIR` moves it);
- Codex's and OpenCode's by the harness process the commands ran under — the session started within two minutes of it,
  in the project's folder: Codex's `~/.codex/sessions/<y>/<m>/<d>/rollout-*.jsonl` (`CODEX_HOME`), OpenCode's
  `~/.local/share/opencode/opencode.db` (`XDG_DATA_HOME`), read with `node:sqlite`.

Another harness's is said as not read. The lead's own sessions are read the same way, over the whole run.

**The experience, combined** (`experience.ts`). The lead says its own with its summary (`run report --summary <file>
--ease --hardest [--friction] [--helped]`, kept in `lead-experience.json`), and the run puts them all together:
- the ease: the run's median, each agent's, and the hardest rounds (2 or less) with what cost the most;
- what cost the most, what got in the way and what helped, each grouped when several said it alike, the most said
  first, with who said it and at which task.

Frictions are said of Plitzi as notices are, so the findings group the two: the same complaint from three agents is
one finding, live from the second. The bench keeps the ease's median run after run: a change that made Plitzi harder
shows as it falls.

**What every command kept** (`usage.ts`, `session.ts`) makes this possible:
- its session: the one `run agent --launch` started it in (`PLITZI_SESSION`, given to the harness), else the harness's
  own (`CLAUDE_CODE_SESSION_ID`), else the harness process it runs under;
- for a harness that keeps its sessions by its own id, that process (`process`: `<program>:<pid>:<started>`);
- when it failed, the line that said why (`error`) and the lines of its output that say what failed (`output`), tokens
  cut.

A `task check` logs what it ran on (`input`: the copy, the run's approved work, the lines, the CLI — `checkKey`) and,
when it fails, what each failing step said (`why`).

**The findings** (`findings/`) are one list for everyone who reads the run. Each says:
- what went wrong, with its evidence and how many times;
- whose it is: Plitzi's (with its area: CLI, platform, docs), the lead's, the agents', or the machine's;
- what would stop it happening again.

They are read off the log, the usage, the plan, the agents' scratch, their notices and the rounds' reports:
- **Sessions:** an agent with two tasks in progress, one in two sessions at once, a session that went on after "You can
  stop".
- **Checks:** a check answering two ways on one input (flaky; the lead's when it is a line, Plitzi's otherwise), an
  acceptance line failing three checks of a task, a project step failing four, a change breaking what an approved task
  was accepted on, lines rewritten after the run began.
- **Gaps:** questions `explain` had no answer for, and topics one agent asked about in three ways or more; acceptance
  checked by the lead's own scripts (the project's tests are not); scripts the agents wrote in their scratch and
  packages they installed there; what was said of Plitzi — notices and frictions together.
- **Failed commands, by why:** refused as written (an option or command the CLI has not: a doc or a prompt says it), the
  machine's (a port, a permission, a browser not installed), and the same CLI error met twice. A check's verdict on the
  work is not one of these.
- **Cost:** an answer over 12k characters, a call repeated, a task reading 2.5 times the median, a context over 150k
  tokens at a task's end, kinds of result read again for over a million tokens.
- **How the run was worked** (`audit.ts`): an approval missing from the log, a review waiting over ten minutes, a known
  failure, a task sent back three times, a UI review skipped or gone past, a crash, a preview that could not sync, the
  brake, the same refusal three times.
- **What it came to:** a task not done, blocked or cut; one over twice its estimate (the run over 1.5 times); conflicts;
  files written over or joined; stops; unanswered proposals.

**While the run goes**, `run watch` and `run status` say the live ones to the lead, each once, through the attention
kind `finding` (`findings/live.ts`, beside `refused-again`):
- a flaky check, or a line failing try after try;
- a task refused again and again.

What is past leaves the lead's attention — a task gone to review or approved, a line whose last check passed (a
finding's `task`) — and what is Plitzi's (an agent with two tasks or in two sessions, a session working past its stop,
a command refused as written, something two agents said of Plitzi) is the feedback's alone, never the lead's to clear:
encore-2 ended with ten standing, which read as ignored. **The lead closes what it was told first**: every task done,
`run report --summary` is refused while anything waits for the lead (`writeSummary`; an agent to start is the keeper's,
not the lead's) — a lead that said "done" before them stacked a stage after.

`run report` starts with the run at a glance and the problems by whose, numbered, each with its evidence and its fix.
Then it gives the experience combined, the lead's summary, what each review asked when it sent a task back, **each
agent's life** (`agentTimeline.ts`: started, joined, took, completed, reviewed, waited and stopped — with why — and the
minutes at work, stopped and silent; a silence is ten minutes and more with nothing logged while neither waiting nor
stopped: what the board reads as no signal), what each
agent and the lead spent (with what each ran on, and Plitzi's files read the most), and the facts: each task's agents, time against
its estimate, reviews, cuts and blocks; completions, refusals, failed checks and conflicts; overrides, requests,
proposals, a reconciliation, restores. `run finish` prints a few findings of each whose and points at the report.
`run report --summary <file>` keeps the lead's report (logged as `summary`); it adds only what no record says. The final
merge is refused without it, and refused with one written before a task was approved (`summaryBehind`, `report.ts`: its
`summary` line against each done task's reviewed version — a run from before that line by the file's time): the dry run
says which tasks and is not `ready` until it is written again. An approval is logged the moment its task is done
(`review`), and what it let go after — files handed on, tasks made ready — on a line of its own (`handed-on`): written
last, one whose next steps failed was in the run's work and nowhere in the log. When the run ends — finished, or aborted
by a person — the report is left in `tmp/plitzi-reports/<run>-<time>.md`, with what was written or discarded and where a
backup is. Beside it, `<run>-<time>.json` is the whole run as data: the bench line, the report (`version`ed: findings,
indicators, every round's report, each task's review asks, the lead's spend, the metrics), the lead's summary and the
scripts kept. Those are in `<run>-<time>-scratch/<agent>/`: each agent's scripts copied out of its scratch before the
run goes (256 KB at most each; larger ones named as left out). Each is what a command could not do. That folder and the
JSON are what is read to analyse runs side by side.

**The run measured** (`runMetrics.ts`, `reportFlow.ts`): the report says where the time went and what it cost, read off
the log, the messages and the run's usage — what velada-polish's lead computed by hand to find the run's bottlenecks:

- **Flow:** the minutes worked (the open to every task approved), apart from the wait for the person's finish — the
  report said 136 min of a run worked in 50. Each task: from stacked to taken, at work, its rounds (the UI's and the
  lead's), each wait for its UI review and the review's own time, each wait for the lead, each wait for an agent after
  changes were asked, its checks failed, its reworks handed off. Each agent: joined, stopped, its tasks, completes,
  checks failed, refusals, the minutes it waited for work, its reviews (with changes) and their median minutes. Checks
  failed by step (lint, typecheck, author, acceptance, a long file) — the copy's own failures only: a `task check` says
  what failed for nothing of the copy's (`notOwn`, `tasks/notOwn.ts`) — a step the run's work fails the same way, an
  acceptance line nothing could answer (its command exited 2, or could not run; the lead is told once, and a
  `complete` refused for it records no brake) — and those are counted apart; refusals by code, with who and one command; each
  question's wait for its answer. A spike is said as the lead's, by the lead that found it out.
- **Cost** (`usage.ts`): each command run in a run — a task's, the lead's, a `page shot` in a copy — appends to the
  run's `usage.jsonl` who ran it, the command (its tokens' secrets out), what it printed (stdout and stderr: what its
  caller read, a token four characters), how long, its exit. The CLI's own child processes (`task look`'s checks and
  shots, a check's scripts: `PLITZI_USAGE_CHILD`) count none — their output is read by the command, not an agent. The
  report sums it by agent and by command, and lists the calls one agent made three times or more within ten minutes:
  a loop, or an answer it could not use. The harness's own count — the lead is handed it with each agent's end — is said
  with `run report --tokens dev-1=208061,…` (`tokens.json`), by agent, in all, and a task: what a Claude Code subagent
  reports is its context at its end, not what it spent. What it spent is that context read again on every turn: the
  report says it at the least (`reread`: its calls × half its end — a context grown from nothing), and the bench a task
  (lx-product's dev-1 said 310k and read 30.9M again; the estimate gives 26M, the harness's own prompt left out).
- **The bench** (`bench.ts`): the same measures, one line a run, kept as data beside the report
  (`<run>-<time>.json`, with the report whole), ends the report against the five runs before, and `plitzi run bench`
  lists every run: minutes a task, rounds a task, the share of checks failed for the copy's work and how many failed
  for nothing of it ("Not theirs"), refusals (`identity` apart), the median
  waits for a UI review, the lead and a rework, the minutes agents waited, reworks handed off, what was read, tokens a
  task, calls repeated — whether the team gets better from one run to the next. A second table counts the findings'
  patterns (`RunIndicators`): the ease's median, findings by whose, the share of failures not the agents', flaky checks, lines failing,
  session breaks, `explain` misses, what was done beside the CLI, what two agents said, commands refused as written, and
  the harness's tokens a task. A fix holds when its column falls.

## Who calls (`identity.ts`)

A name is anyone's to type. Said, or not said — a shell with no terminal was the lead — it was taken at its word:
velada-polish's design-2 ran `task look` with no `--agent` and the run's log has the lead looking, and one `task review
--approve` the same way would have been the lead's last word. So who calls is proved by a token:

- Every agent of a run has a token of its own, `<run>.@<agent>.<secret>`, made by `run agent <name>` as it is started
  — or, started by hand, at its first command (`--agent <name>` said once) — and the lead's by `run open`. The run
  keeps each one's digest (`identities/<agent>.json`), never the token; the agent's copy is in its scratch folder
  (`scratch/<agent>/token`), and beside it the agent's own CLI (`scratch/<agent>/plitzi`, `writeCli`): the project's,
  run with `PLITZI_TOKEN` read from that file. Its prompt names it, so no command it types carries `--token "$(cat
  …)"` — lx-product: that and the CLI's path were 300 characters of every command, read again on every turn after.
- Each command passes the token (through the agent's CLI, `PLITZI_TOKEN` or `--token`), in a task's copy too: the copy says which task — to its
  holder's token alone, or a person at its terminal — never who calls, and a task's own token (`<run>.<task>.<secret>`)
  says no one. Refused (`identity`, 26): no token, an empty one, a task's, one that is no agent's, a name that has a
  token said without it, a token under another's name or of another run, a name not of the project's team (`team.json`:
  its agents, `lead`, its co-leads), `person` from a shell (a person is a terminal) — except the readings anyone may ask
  (`run status`, `run report`, `task claims`, `task proposals`, `run can-write`: a hook or a script, `unnamed`). The CLI
  makes up no name: velada-fidelity's `--token "$(cat …)"`, read from the wrong folder, came in empty and ran as
  "agent" — it took a task, and the rework sent back to "agent" sat with no one. A holder's step is held to the task's
  owner too (`holderOf`): another agent with its copy's token acts on nothing of it.
- An agent's roles are its team's: `task next --role` and `task take` refuse a role it was not started as.
- What tells an agent to start one again (`run monitor`, `run watch`) names it through its own CLI once it has one, by
  its whole path — the same from a task's copy as from the project: `<project>/tmp/plitzi-runs/<run>/scratch/<agent>/plitzi task next …`.

With who calls proved, the lead's guards hold by name: `requireLead`, `requirePrincipal` and a verdict's guard let in
`lead` and a person (and, for a verdict, a lead that reviews), and refuse every other — an agent of no team included,
which a name alone once let through. `task message` goes out in the lead's voice, so it is a lead's too.

## Who may do what (`run/`)

A person's actions — the final merge, restore, a forced stop, abort, purge, taking a run over, re-pinning it, opening
one above the estimate's threshold — are refused with a task's token and in a shell with no terminal; a person confirms
by typing the run's name. The lead's — opening, stopping, reviewing (and overwriting), reassigning, reverting,
resolving a reconciliation and continuing, answering any proposal, the summary, a message to a task — are refused with
a task's token and to any caller but the lead (`lead-only`); a verdict is a lead's (`lead`, a lead that reviews, a
person) or a designer's on a UI that waits for one. This
is a guard rail, not security: an agent with a shell can give itself a terminal (a pseudo-terminal) and type the run's
name, read another agent's token from its scratch folder (the run's files are the person's user's, as the agents are),
and edit the run's records — `run.json` or a task's `state.json` broken by hand are refused by name, never read
on a guess, but one rewritten whole is the agent's word. What holds is that whatever is written outside the flow is
caught by fingerprint before anything is merged; **what keeps a person's actions a person's is the harness**: deny the
agents `plitzi run finish --apply`, `run abort`, `run purge`, `run restore`, `run allow-finish`, `run stop --force` and
`run attach --take-over` (in Claude Code, `permissions.deny` in the project's `.claude/settings.json`), and let them
run the rest. A token is told apart: one a task was cut from is `reassigned`, one it was never taken with `invalid`
(`revoked.json` keeps the fingerprints of those it lost).

**The final merge can be the lead's**, when a person says so: `run open --lead-finishes`, or `run allow-finish` on an
open run (`--revoke` takes it back), each confirmed by typing the run's name — the lead asks for it before opening, and
never grants it to itself. The record keeps when (`leadFinishes`); `finish --apply` then asks no one, and still needs
the lead's report, a dry run's checks green on the whole result and no conflict with the project; the report says who
wrote it.

The run pins this CLI and every `@plitzi/*` installed; a change refuses every command (`version-mismatch`) until a person
attaches, which re-pins it. **An upgrade loses no work**: on this machine a task in hand keeps its copy, its agent and
its token — its next `complete` runs the checks with what is installed now — and is told so; only a copy that is gone, or
another machine's, starts over from its reviewed version. Meanwhile `task next --follow` waits through it as through a
stop, and `run status` says what the person runs. A run outlives the CLI that opened it, so every change to its files is
additive (`model.ts`): `src/tests/runRecords/<version>/` keeps a run as each CLI wrote it, and `runs-compat.test.ts`
reads, works and finishes every one; one this CLI still cannot read is said as the other CLI's, with the command that
goes on with it (`compat.ts`), never as a hand edit. `run plan` says when the skills the agents read are older than the
CLI (`plitzi upgrade skills --write`). `plitzi upgrade --write` waits for an open run unless told
`--with-open-runs`; **`plitzi run upgrade`** is the way to upgrade under one, a person's: it stops the run gently,
waits until nothing is being written (`writingTasks`: what an agent holds in progress, sent back or waiting — a task in
review is finished work), upgrades (`plitzi upgrade --write --with-open-runs`, or `--install "<command>"`), has the new
CLI re-pin the run (`run attach`, the person typing its name) and resume it — so `node_modules` never changes under an
agent's command; an upgrade that fails resumes the run as it was. A run is active on one machine; another attaches once it is released, or a person takes it over. The
brake: more than 5 failed checks or conflicts — and one more for each agent past the first, each failing on its own way to
a fix (`brakeFailuresFor`) — or more than a fifth of completions refused (over 10 at least), within 30 minutes; `task
check` counts toward none of it — and the run stops as a stop does, its reason in `run status` and the report. `run resume` clears what the brake
saw: it judges what happens from there. A task's commands are logged under the name it was taken with.

## Exit codes (`refusal.ts`)

10 `claimed`, 11 `waiting`, 12 `reassigned`, 13 `version-mismatch`, 14 `stopping`, 15 `forced-stop`, 16
`reconciliation`, 17 `person-only`, 18 `conflict`, 19 `checks-failed`, 20 `invalid`, 21 `not-found`, 22
`other-machine`, 23 `another-run`, 24 `agent-limit`, 25 `lead-only`, 26 `identity`. A refusal carries its code, the message, the next step and its
detail (`--json`).

## Not built, and left out

- **`run replay`** — a run played again step by step on a copy, to debug a failure: the run's `log.jsonl`, each task's
  log and the report say what happened, and the run is gone once applied.
- **Memory from reviews** — the space's memory is the project's `NOTES.md`, handed by `task context`; proposing entries
  from what reviews kept asking is not built.
- **Windows** is held to by the code — renames retried on `EPERM`/`EBUSY`, `$PLITZI_URL`/`$PLITZI_PORT` written into a
  check for any shell, a `plitzi.cmd` beside the shim, the copy's server stopped as a tree (`taskkill /T`) — and not run
  on it yet.
- **Several agents on a space in the cloud**, at once — MCP tools for it, seeing them in the builder, a mode that makes
  an area read-only for people, the run kept on the server: left out because it loads the server with many small writes
  and is the most expensive part to build. A space on Plitzi is pulled, worked by a run as a project and pushed once (the
  line, above); the mechanism here could move to the server without being redesigned.

## Tested

The bench is `apps/cli/src/runs/runs-*.test.ts` (each a part of the run: plan, tasks, shared files, merge, stops,
agreements, the team, the lead, the leads that review beside it, acceptance, the first real runs, the primitives, what
an agent can do around the rules — a write after its review, a link, a token not its own, two completes at once on one
shared file — and a run each released CLI wrote, read and finished by this one, `runs-compat`) with its steps
in `src/tests/runSteps.ts`: a seeded project (`src/tests/runProject.ts`), scripted agents over one clock the test moves,
a person who confirms or not, checks that fail on `BROKEN` — no model and no network, so every run is the same run.
`apps/cli/src/commands/runs.test.ts` runs the CLI as processes: the exit codes, the token through the environment, a
person's action from a shell with no terminal, and a command run from inside a task's copy.

**A run played whole** (`runs-flow.test.ts`): one story, agent by agent, as a real run went — the base agent and one
on demand, a shared file held while another task's request on it is approved, a question a lead that reviews answers
and its agent takes up, the reviews, the finish — with a simulated `author` (a page reading a token its theme does not
declare fails), so the rules meet where no test of one of them looks. velada-dress's failures were each rule right
alone and wrong together. **A change to how a run behaves adds its step to the story** — beside its own unit test — and
a run's post-mortem adds what it found there.
