# Several agents on one project

How `plitzi run` and `plitzi task` keep several agents — the subagents of one harness, or harnesses of different kinds —
from stepping on each other on one project, and why nothing they do can leave it broken. How to use them is the CLI's
README and the `plitzi-cli` skill (`reference/runs.md`, every agent's; `reference/runs-lead.md`, the lead's); this page is for whoever changes them. The code is
`apps/cli/src/runs/`, the commands `apps/cli/src/commands/runs/` (registered in `commands/runs/register/`).

## The line

Plitzi provides the tools; the harness orchestrates. The CLI never runs an agent, picks a model or interprets a goal: the
lead writes the plan, starts the subagents, reviews them and closes the run with its report. The CLI reserves
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
(`yours`), so an agent waiting for work hears it. **The run's notes** — the plan's `notes`, and each `run note` — are
messages to every task (`*`): each task reads every one once, with its take or its next sign of life, and `task context`
(the brief an agent starts from) lists them beside its acceptance, what a review asked and what was agreed.

**More leads for a larger team** (`leads.ts`). One lead reviews for four agents (`AGENTS_PER_LEAD`): past that, tasks
waited for its review in v12. A team of five or more has `lead-2`, `lead-3`… beside `lead` — `"lead": { "count" }` in
`team.json` says another number — recorded in `run.json` (`leads`) when the run opens or a stage raises them. Two levels
and one queue, no lead with agents of its own — **started only when the reviews queue up**, since one waiting for
reviews it is never handed spends tokens on nothing: `lead` reviews every task, taking each from the queue (`task next
--role lead --take`), until two wait and the oldest waited five minutes (`REVIEW_BACKLOG_MS`) — then `run watch --until
lead` names the one to start; one handed nothing for ten minutes (`IDLE_LEAD_MS`) is told it can stop, and a lead that
asked within the last minute (`leads-asking.json`) is running. A lead that reviews waits with `task next --role lead --follow --take`,
which offers it a task in review no other lead took (`TaskState.reviewer`, for the round) — one it sent back first, then
the one that waited longest — and reviews it as `lead` would, as strictly; a review another lead took is refused to it
(`claimed`). Everything else — planning, amending, stacking a stage, answering, notes to every task, unblocking,
reassigning, reverting, reconciling, the summary and the finish — is `lead`'s, refused to a lead that reviews and to an
agent of the team (`lead-only`), so two never do it twice. `lead` may review any task; while one of them runs, `run watch
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
who has it and who reviews it, what needs someone; no other server answers it. `run monitor` is the same run, live, for
a person in a terminal of their own: it only reads (nothing marked read, nothing the lead is woken for touched) and
refuses a shell with no terminal, an agent's, whose is `run watch`. `task show` (`show.ts`) gathers the rest of a review —
acceptance, checks, agreements, notes, what was said, each file's diff against where the copy started, the commands that
act on it.

**No task ends with failing checks**: `complete` refuses. `--known-failure "why" --fixed-by <task>` takes it to review
anyway — said in the review, `run status` and the report, and to the task that fixes it; the final merge still needs
every check green.

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
a plugin's. It says — never refuses — a file of a task that other tasks' files import (what it exports is their contract:
change it compatibly, or say in the plan who follows it), and the tasks whose acceptance no command proves (they hold at
their review only; a check runs at `complete` and again at the finish). A task holds its plan's files only until it is done: then a shared one among them (the entry a shell task
split up) is requested like any other, and the rest are taken by turns. Shared files are taken **by turns** (`task
claim`, `task wait`: a `turn` lock, handed to the next waiter by priority when the holder is approved, with the approved
version put into its copy) or, when several tasks want one at once, changed in each copy as a **request** — whatever a
task changed in a shared file it does not hold becomes one at `complete`, its version kept. When every task that
requested a change on a file is approved, the CLI makes one integration task over it, depending on all of them; `task
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

`run extend <run> <plan>` adds the next plan's tasks to an open run: their copies start from what it approved, they may
wait for its tasks (`dependsOn`), their files are backed up beside its own, and one `finish` writes the stages into the
project as one diff with one report. An id the run has is refused, and so is a file a task still at work holds. `run
open` with a run going says to stack on it. `run pending` lists the project's runs not yet written into it — the ready
ones first, each with the command that applies it; read off the project's own `tmp/plitzi-runs/`, so every terminal on
it sees the same, and no other project's runs.

## Looking at a task in one command (`task look`)

`task look <task> [paths…]` serves a task's copy as it went to review, runs this CLI's `page check` from the copy at
1440 and 390 and `page shot` light at 1440 and dark at 390 for each path, each a child process, and stops the server:
the review a lead made by hand in four or five commands, while every agent waited.

## Who works the runs (`team.ts`)

Who works a project's runs is its own choice, in `.plitzi/team.json` (committed: it holds no secret, so it needs no
`.example` as `.env` does). `plitzi create` writes the starter (`STARTER_TEAM`): a developer and a designer — two
agents, since each spends tokens; the person grows it when a job asks — the harness's own models, and an `about` that
says what each field and each role the CLI knows means (`ROLES`: developer, designer, reviewer, tester, writer; any
other name is a role of the project's own), since JSON has no comments; `about` is the CLI's — never read, written as this CLI says it whenever it
writes the file, and brought up by `plitzi upgrade` with the files, the agents left as they are. The file is formatted as the project's Prettier leaves it (`formattedJson`). `run team` lists the roles too. The file
holds the leads' model, effort and count, and each agent — a name (`dev` is `dev-1`, `dev-2`…), the roles it takes, how many of it and the model to start it with, the
harness's own name for it, nothing checked but that one is named. The CLI starts no agent; `run plan` says what to start
each with — its roles, its model, the plan's tasks it takes and `task next --role <roles> --follow --take --agent
<name>`. The team's size is how many agents work a run at once — no flag says otherwise; a project made before the starter gets
it at its first run, with an agent for each other role its plan names, said; a team somebody emptied is refused. A task whose role nobody in the team takes
is refused at `run plan`; an agent of one role is held to it in a rehearsal. `run team` shows it; `run team set|unset
<name>` changes one agent, or the leads' model and count (`lead --count`), saying it before and after.

## The tester's tasks (`tests.ts`)

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

With a designer in the team — or a plan that says `"designReview": true`; `false` turns it off — the UI another role's
task changes (under `src/space/`, but its data, or a plugin) is looked at by a designer before the lead: at `complete`
its state's `design` is `due`. A designer's `task next` offers it before any task of its own (`--take` makes it theirs:
another designer is not offered it), with what it changed, the pages it is likely drawn at and what to look for; the
designer runs `task look`, then `task review --approve` — the task stays in review, the lead's now — whose review is the complete and strict one, and the final word; the designer's is the UI/UX, as a
designer — and `run watch
--until lead` wakes the lead for it then, not before — or `--changes`, which go back to the task as the lead's would and
count as a round. The lead's approval while it is due is refused, naming the designer, unless `--skip-design`: the state
and the report say which. A designer does not review its own work, and is not finished while a task whose UI it may
review is still to be done.

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
telling each task changed what it now asks. The run's shape — its tasks, their files, `dependsOn`, `role`, `touches` —
is refused, as is a task already done, every reason at once; so is a plan that changes nothing. Its acceptance is held
to `run plan`'s rules, among them a `page check` whose text the shell would split into a page.

## A plan rehearsed (`rehearse.ts`)

`run rehearse` plays a checked plan out with no run opened: each agent — `--roles` holds some to a role, the rest take
any — takes the best ready task it may, in `task next`'s order (priority, then the longest chain still to do, then id);
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
                     hour rather than run again (the dry run's at `finish --apply`)
```

What the lead handed the run — the plan, the primer beside it, an amendment (`run amend`), a stage (`run extend`), the
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

## A task's life (`tasks/`)

One module a step: taking it (`take.ts`), what `task next` hands over (`next.ts`), its files and turns
(`locks.ts`), signs of life and blocks (`signals.ts`), `complete` (`complete.ts`), requests and integration tasks
(`requests.ts`), what an approval writes (`approve.ts`), the review (`review.ts`), reassign and revert
(`reassign.ts`), the brief (`context.ts`), and what they all read (`common.ts`).

- **Take:** under the agent limit, `owner.json` exclusively, with a token `<run>.<task>.<secret>`, so every command of
  the task needs only it. A `.lock` per file at the file's path under `locks/`, readable by any hook or editor;
  `run can-write` answers the same. The copy: the project's files — never `node_modules`, `tmp`, `dist`, `state`,
  `.git`, `.plitzi`, `.yarn`, a `.env` (its templates — `.env.example`, `.sample`, `.template`, `.dist` — are), nor the
  binaries of `public/` and `vendor/` it does not own — cloned copy-on-write where the disk can (`COPYFILE_FICLONE`,
  about 0.3 ms a file), then the run's approved work over it, then, for a task cut before, its last reviewed version.
  `start.json` keeps the fingerprint of every file it started from, and which came from the run. **A copy is kept up to
  the run**: when a file is handed on by turns, on `task discard`, and before `complete`'s checks, every file the run
  approved since the copy was made — and the task did not touch — is brought in, so a granted entry never arrives
  without the pages it imports. A task may remove the `.gitkeep` of a folder it writes into. Packages resolve from
  the copy by walking up to the project's `node_modules`; a command run inside the copy works on the project it belongs
  to, and as its task: `take` writes the run, task, token and agent into the copy's `tmp/plitzi-task.json`, read when no
  token is said (a token said wins — the lead reviewing from inside a copy is the lead).
- **Check:** `task check` runs in the copy what `complete` would hold it to — the project's checks, the acceptance's
  commands, the files too long — and changes nothing: no review, no brake. An agent iterating on a fix checks with it,
  and completes once it passes; it hands over what was said to the task meanwhile, which an agent that only edits
  files would otherwise read only at `complete`. What a task declares for the tasks after it — a component, a token,
  read by none yet (authoring's `unused-*` suggestions) — passes a task's checks as a warning the review sees, and fails
  only the finish's, on the whole result (`CheckOptions.final`).
- **Complete:** refused with a proposal to it unanswered, and with its copy gone (said as gone, with the take that
  starts it again — not as every file removed). The copy against `start.json`: a change to another task's file is
  refused (`claimed`) naming each; to a shared file, or one in no task, taken by turns when nobody holds it and a request
  when someone does; a new file nobody names is the task's. A file of the task turned into a link is refused — what it
  points at (the project's `.env`) would go to review as the file. Then the project's checks — `verify`'s steps, each
  the project's script, run in the copy with the project's binaries: `author` first, alone, and the rest three at a
  time once it passes, every failing one printed — then the acceptance's checks (`acceptance.ts`): each `{ said, check }` line's command run in
  the copy, passing on exit 0, with `plitzi` on the path as this CLI (a shim in the task's cache) and `$PLITZI_URL` the
  copy served by its own start script on a free port while they run; what each answered is kept in the state and shown
  by `task show`. An unmet one refuses like a failing check — and goes to review only as a known failure. Then it goes to
  review, **its files kept as they are now** (`submitted`, by fingerprint): what the review keeps and the approval
  merges, never the copy, which its agent may go on writing — `--note` tells the lead what to look at with it. A sign of
  life of a task in review is answered as one in review. `run plan` refuses a check it could not run: empty,
  reading `.env`, or naming `$PLITZI_URL` in a project with no start script — a lint of what the lead meant, not a
  sandbox: what holds is that a copy has no `.env` and a check's environment none of it.
- **Review:** changes go back to the same task, and after three rounds to a person — three of the lead's, or three of
  the designer's on its UI: counted apart, so a task with a designer is not at a person after one round of the lead's. Approval keeps the version that
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

## Into the project (`merge.ts`)

`run finish` compares each approved file with the project: unchanged since the run knew it → written; already the same
→ left; changed since → a conflict. The whole result is materialised (project + run) and checked first — a dry run by
default, listing what is written over a change made outside — and so is what each done task was accepted on: every
`{ said, check }` line that passed at its review runs again on the whole result, so one a later task broke (the print of
a page another task grew) stops the finish, naming both; a pass of either on the very same result is said again within
the hour, not run again. `--apply` with conflicts writes nothing and puts the run
into **reconciliation**: no task starts and no merge goes in until the lead resolves each file (`--take
project|run|<file>`; the run's or a file of its own is an override, said and kept) and continues. Without conflicts, it
needs the lead's summary, then a person's confirmation, and under `merge.lock` the merge's journal is written
first, a backup of each file it overwrites, then each file; a failure puts back what was written. A journal left
`complete: false` by a cut is undone from its own backups before the next merge or restore goes in. Then the report is
left and the run removed. Undoing the final merge is git's, or `--keep-backup`'s files: the run is gone.

`run restore` puts one project file back, while the run goes, from `base.json` or from before a restore.

## The report (`report.ts`)

The lead closes the run. `run report` gathers what the CLI saw — each task's agents, time from its first take to
its approval against its estimate, reviews, cuts, a block; every completion, refusal, failed check and conflict, read
off the log; overrides; requests and their integration; proposals and their answers; a reconciliation; restores — and
derives the problems from it (a task not done or blocked, more than one review, a cut, a task over twice its estimate,
failed checks, refusals, conflicts, overrides, unanswered proposals, the run over 1.5 times its estimate).
`run report --summary <file>` keeps the lead's summary on top; the final merge is refused without it. When the
run ends — finished, or aborted by a person — the report is left in `tmp/plitzi-reports/<run>-<time>.md`, with what was
written or discarded and where a backup is.

## Who may do what (`run/`)

A person's actions — the final merge, restore, a forced stop, abort, purge, taking a run over, re-pinning it, opening
one above the estimate's threshold — are refused with a task's token and in a shell with no terminal; a person confirms
by typing the run's name. The lead's — opening, stopping, reviewing (and overwriting), reassigning, reverting,
resolving a reconciliation and continuing, answering any proposal, the summary — are refused with a task's token; a
verdict is a lead's (`lead`, a lead that reviews, a person) or a designer's on a UI that waits for one, refused to any
other agent of the team even without a token (`lead-only`). This
is a guard rail, not security: an agent with a shell can give itself a terminal (a pseudo-terminal) and type the run's
name, and edit the run's records — `run.json` or a task's `state.json` broken by hand are refused by name, never read
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
`other-machine`, 23 `another-run`, 24 `agent-limit`, 25 `lead-only`. A refusal carries its code, the message, the next step and its
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
