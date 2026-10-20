# Several agents on one project

How `plitzi run` and `plitzi task` keep several agents — the subagents of one harness, or harnesses of different kinds —
from stepping on each other on one project, and why nothing they do can leave it broken. How to use them is the CLI's
README and the `plitzi-cli` skill (`reference/runs.md`); this page is for whoever changes them. The code is
`apps/cli/src/runs/`, the commands `apps/cli/src/commands/runs.ts`.

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
how many agents work at once (`--agents`, 3 when left out, above 5 a person confirms): `task take` counts the agents
holding a task in progress — one holding two is one, and a take by one of them adds none — and takes one under the run's
`take.lock`, so two takes never pass the limit together (`agent-limit`).

## The team

The lead — team lead and software architect — is whoever runs the run without a task's token: it plans, starts the
agents, answers them, reviews and closes. A task names the role that works it (`role`, a developer's when left out), and
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

**Connected as it goes.** A shared file a task changed — or any file no task at work holds: a done task's, one in no
task — is taken by turns at `complete` when nobody else holds it, so it merges with the task instead of waiting for an
integration task — an integration task holds its file only while it is worked, and there is one a file: what is
requested while it waits joins it; when the run's version moved since the copy was made, the two changes are put
together line by line (`merge3.ts`: changes to different lines both go in; two additions at one place one after the
other, the run's first; the same edit to a line with different additions after it — a trailing comma, then each its own
entry — joined, the separator carried; the same lines changed two ways, a conflict). A merge made at approval goes in
only after the project's checks pass over the whole result. `run preview` serves the run's work in the run's cache with
the project's dev server, and each approval writes into it; `run preview --task` serves a task's copy while it is in
review, so the lead looks at the pages before approving them, and `task show` (`show.ts`) gathers the rest of a review —
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
a plugin's. A task holds its plan's files only until it is done: then a shared one among them (the entry a shell task
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

## Models by role (`models.ts`)

Which model works which role is the project's choice, in `.plitzi/models.json` (committed): a model — the harness's
own name for it, nothing checked but that one is named — and an effort, by role, `lead` for the lead and `default` for
any role not named. The CLI starts no agent; `run plan` says what to start each with — the lead's, then each role's
tasks with their model and `task next --role <role> --follow --take`, so an agent of a model chosen for a role works
only its tasks. `run models` shows them; `run models set|unset <role>` changes one, saying it before and after.

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
blobs/<sha256>       every version the run keeps, by fingerprint, written once
base.json            the backup when it opened: every file the plan touches and every shared one
approved.json        the run's work: per file its version, the project's version it came from, its task, the previous,
                     and — when the lead wrote it over a change made outside — the override
shared.json          what was shared when it opened
summary.md           the lead's summary, for the report
merges/merge_N.json  each write into the project: before and after per file; `complete: false` while it is written
log.jsonl            the audit: who did what, every refusal, failed check and conflict — what the report counts
tasks/<task>/
  task.json  state.json (+ state.lock)  owner.json  review.json  reviewed.json
  locks/<path>.lock  requests/<id>.json  proposals/<id>.json  answers/<proposal>.json
  cache/work/  cache/start.json  cache/progress.json  cache/log.jsonl
```

While the run goes, everything but `cache/` is essential — with no git it is the only way back — and `run prune` removes
only caches (a run idle 8 hours; the oldest quiet ones above 1 GB). **When the run ends, it goes whole**, backups
included: a finished or aborted run leaves nothing for anyone to clean up but its report. `run finish --apply
--keep-backup` keeps the project's files as they were before the merge in `tmp/plitzi-backups/<run>-<time>/`, as plain
files and a manifest; a file written over a change made outside the run is kept there whatever was asked.

**One writer per file.** `plan.json` is the lead's; `run.json`, `approved.json` and the project are written under
`merge.lock`; a task's `state.json` under its `state.lock`; `owner.json`, an answer and `active.json` are created
exclusively (`wx`). Every write is a temp file renamed over the target, retried on Windows' transient `EPERM`/`EBUSY`. A
version is a blob named by its fingerprint and a manifest names it, so the manifest is the one commit point: a cut leaves
an unnamed blob, never a named half-written file.

## A task's life (`tasks.ts`)

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
- **Complete:** refused with a proposal to it unanswered. The copy against `start.json`: a change to another task's
  file, or to one in no task, is refused (`claimed`) naming each; to a shared file not held, a request. Then the
  project's checks — `verify`'s steps, each the project's script, run in the copy with the project's binaries, the
  failing ones printed — then the acceptance's checks (`acceptance.ts`): each `{ said, check }` line's command run in
  the copy, passing on exit 0, with `plitzi` on the path as this CLI (a shim in the task's cache) and `$PLITZI_URL` the
  copy served by its own start script on a free port while they run; what each answered is kept in the state and shown
  by `task show`. An unmet one refuses like a failing check — and goes to review only as a known failure. Then it goes to
  review. `run plan` refuses a check it could not run: empty, reading `.env`, or naming `$PLITZI_URL` in a project with
  no start script.
- **Review:** changes go back to the same task, and after three rounds to a person. Approval keeps its reviewed version
  and merges it into `approved.json` — and **before anything is written, each file is checked**: the run's version moved
  since the copy was made (`conflict`: redo it on the run's), or someone changed the project's file while the task
  worked on it. That one stops the approval, naming the file; the lead decides: `--overwrite` writes the task's
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
default, listing what is written over a change made outside. `--apply` with conflicts writes nothing and puts the run
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

## Who may do what (`run.ts`)

A person's actions — the final merge, restore, a forced stop, abort, purge, taking a run over, re-pinning it, opening
one above the estimate's threshold — are refused with a task's token and in a shell with no terminal; a person confirms
by typing the run's name. The lead's — opening, stopping, reviewing (and overwriting), reassigning, reverting,
resolving a reconciliation and continuing, answering any proposal, the summary — are refused with a task's token. This
is a guard rail, not security: what holds is that whatever is written outside the flow is caught by fingerprint before
anything is merged.

**The final merge can be the lead's**, when a person says so: `run open --lead-finishes`, or `run allow-finish` on an
open run (`--revoke` takes it back), each confirmed by typing the run's name — the lead asks for it before opening, and
never grants it to itself. The record keeps when (`leadFinishes`); `finish --apply` then asks no one, and still needs
the lead's report, a dry run's checks green on the whole result and no conflict with the project; the report says who
wrote it.

The run pins this CLI and every `@plitzi/*` installed; a change refuses every command (`version-mismatch`) until a person
attaches, which re-pins it and cuts the tasks in hand. `plitzi upgrade --write` waits for an open run unless told
`--with-open-runs`. A run is active on one machine; another attaches once it is released, or a person takes it over. The
brake: more than 5 failed checks or conflicts, or more than a fifth of completions refused (over 10 at least), within 30
minutes — and the run stops as a stop does, its reason in `run status` and the report. `run resume` clears what the brake
saw: it judges what happens from there. A task's commands are logged under the name it was taken with.

## Exit codes (`refusal.ts`)

10 `claimed`, 11 `waiting`, 12 `reassigned`, 13 `version-mismatch`, 14 `stopping`, 15 `forced-stop`, 16
`reconciliation`, 17 `person-only`, 18 `conflict`, 19 `checks-failed`, 20 `invalid`, 21 `not-found`, 22
`other-machine`, 23 `another-run`, 24 `agent-limit`. A refusal carries its code, the message, the next step and its
detail (`--json`).

## Tested

`apps/cli/src/runs/runs.test.ts` is the bench: a seeded project (`src/tests/runProject.ts`), scripted agents over one
clock the test moves, a person who confirms or not, checks that fail on `BROKEN` — no model and no network, so every run
is the same run. `apps/cli/src/commands/runs.test.ts` runs the CLI as processes: the exit codes, the token through the
environment, a person's action from a shell with no terminal, and a command run from inside a task's copy.
