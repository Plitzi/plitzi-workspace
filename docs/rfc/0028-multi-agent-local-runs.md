# RFC 0028 — Multi-agent runs on a local project

- **Status:** Accepted — built in `apps/cli`, unreleased; the final tests with real subagents pending (§0)
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-19
- **Scope:** the CLI (`apps/cli`: new `plitzi run` and `plitzi task` groups, `plitzi space overview` and `impact`), the
  skills the CLI installs. Nothing in `sdk-authoring`, `apps/mcp`, the builder, `apps/server`, plitzi-sdk-server or
  MongoDB changes.

---

## 0. As built (2026-10-20)

How it works now is owned by `docs/en/agent-runs.md`; how to use it by the CLI's README and the `plitzi-cli` skill
(`reference/runs.md`). This RFC stays until the final tests with real subagents pass, then it is deleted. Where the
build departs from the draft below, the build is right:

- **One plan and one run at a time** per project (`another-run`), and **an agent limit** set when it opens (`--agents`,
  3 when left out, usually 2–5; above 5 a person confirms) that `task take` holds (`agent-limit`).
- **The run lives in `tmp/plitzi-runs/<run>/`**, not `.plitzi/runs/` (§7.1), with a blob store by fingerprint under
  every manifest. **When it ends it goes whole, backups included** — nothing left to clean up — and leaves its report in
  `tmp/plitzi-reports/`. `run finish --apply --keep-backup` keeps the files it overwrote in `tmp/plitzi-backups/`. There
  is no rollback of the final merge from the CLI (§9.10): that is git's, or `--keep-backup`'s files. `run restore` puts
  one file back while the run goes.
- **The coordinator closes the run with a report** (`run report --summary`): the CLI's facts — tasks, times against the
  estimate, reviews, cuts, refusals, failed checks, conflicts, overrides, requests, agreements — under its summary. The
  final merge waits for it.
- **Before anything is written, the file is checked:** a file someone changed in the project while an agent worked on
  it stops that task's approval; the coordinator decides — `--overwrite` (the task's version wins, said everywhere and
  the other kept) or `--changes`. Reconciliation is the coordinator's to resolve, not only a person's.
- **Tasks agree with each other** (new, not in the draft): `task propose` / `task answer` (accept, reject, counter —
  three rounds, then the coordinator), waits on an answer in the same wait graph, agreements checked at review.
- **Files, not scopes:** a plan and `task claim` name project paths (a plugin's folder too), never `page:/es/launch`;
  `run plan` expands a unit with what it owns (§2).
- **The CLI does not see writes as they happen.** "Refused with `claimed`" is said at `task complete`, by fingerprint,
  naming each file; `task discard <file>` puts one back. `run can-write` is there for any hook that asks earlier.
- **A request is the task's own version** of the shared file, recorded at `complete` (with `task request` adding the
  why); the integration task gets each as a diff. A new page registers itself in the entry the same way.
- **The token names its run and task** (`<run>.<task>.<secret>`) and travels as `--token` or `PLITZI_TASK_TOKEN`.
- **Exit codes** 20 `invalid`, 21 `not-found`, 22 `other-machine`, 23 `another-run`, 24 `agent-limit` were added;
  `task wait` exits 11 on success.
- **The space's memory** is the project's `NOTES.md`, handed by `task context`; proposing entries from reviews is not
  built. Nor are `run rehearse` and `run replay`.
- **Windows is untested** (§7.1). Phase 3's success number — wall time against the same job done serially — needs the
  final tests with real subagents.

## 1. Summary

Several agents, and subagents in parallel, working at the same time on one Plitzi project without stepping on each other
and without any way to leave the user's project corrupt. Everything happens locally, through the CLI. A cloud space is
pulled, worked on locally and pushed back once, at the end.

Plitzi provides the tools; the orchestration stays in the agent's harness (Claude Code, OpenCode or any other). The CLI
reserves files, isolates each task in a copy, checks, merges, keeps backups, and shows progress. The harness decides how
many agents to run, with which model, and pays for them.

The safety comes from the design, not from trusting the agents: subagents write into copies; only one checked merge,
approved by a person, writes into the project; every file is backed up before it is touched; anything that leaves the
flow puts the run into reconciliation, like a `git merge` with conflicts.

## 2. Decisions

These were settled with Carlos and are not reopened without him. Command names, field names and file formats below are
proposals for this RFC to settle.

- **Everything is local, through the CLI.** The cloud MCP, the builder, the server and plitzi-sdk-server do not change,
  and agents working in parallel put no load on the platform.
- **A cloud space is pulled, worked on and pushed.** `plitzi space pull` before and at the end, one `plitzi space push`
  with the result. Both exist.
- **The harness orchestrates; Plitzi provides the tools.**
- **The user's project is never left corrupt.** Copies, a checked final merge, dry runs for whatever changes a lot, and a
  backup of every file before it is touched.
- **One agent per file, owners read off the imports.** A page or layout of `src/space/` is rarely one file: it is a
  folder (`pages/home/index.ts`, `hero.ts`…) and it imports modules other pages import too (`tokens.ts`, `theme.ts`,
  `components/`). So a root owns the modules only it reaches from the space's entry; a module two roots reach is
  **shared**; the entry (`src/space/index.ts`) is shared. Each function, data file and plugin folder is its own unit.
  Shared things go by turns or, when several tasks want them at once, through an integration task.
- **A `.lock` per reserved file**, in its task's folder, like the lock an editor leaves: any harness, editor or hook
  knows what not to touch without knowing Plitzi.
- **Copies, not git branches.** Git is the model, not a dependency: a project may not use it, and nothing here assumes
  it. The CLI merges per file with fingerprints, the way `space pull` already does, and keeps its own backups.
- **The guarantee is at the merge, for every harness.** The CLI does not see a harness's writes, so it does not stop them
  as they happen: whatever a task wrote — inside its copy or not — is checked by fingerprint when it completes and when it
  merges, and anything out of place is refused or put into reconciliation. `plitzi run can-write` answers any hook that
  wants to ask earlier; the CLI installs no hook of any harness.
- **The coordinator writes the plan; the CLI holds it to the rules.** `plitzi run plan` reads a plan the coordinator
  wrote (JSON), refuses one that repeats a file, has a cycle or names what is not in the project, adds what is shared by
  the imports, and estimates it. The CLI never interprets a goal.
- **A run lives in `tmp/plitzi-runs/<runId>/`**, the folder a project already keeps out of git, the lint, the formatter
  and the server's watch. Nothing of a run is in `.plitzi/` (committed, linted).
- **Shared things by turns or by integration; wait instead of replanning.** A task that needs another task's file waits
  for it. A shared file (the stylesheet, tokens, a layout) is taken by turns when it is free or one task is ahead;
  when several want it at once, each leaves a request and one integration task applies them together.
- **The project only receives the final merge,** approved by a person. Pushing to the cloud and publishing are a
  person's too.
- **Stopping means finishing the current task.** A forced stop is enforced by the CLI, without waiting for the harness.
- **A task that is cut goes back to its last reviewed version.** Half-written code is never resumed: the next agent
  would not have the context it was written in.
- **If something leaves the flow, the run enters reconciliation:** resolved file by file, then continued or aborted.
- **A run is a cache** in `tmp/plitzi-runs/<runId>/`: removed when the run finishes or is cancelled, purged after 8 hours
  without activity. Only the essentials (`plan.json`, the backups and the reviewed versions) stay, so a run can be
  resumed and undone.
- **The Plitzi version is pinned** while a run is active.
- **An estimate before starting**, and a person's confirmation above a threshold.
- **Unit and e2e tests are mandatory.** Every bug gets a test first.

## 3. Starting point

| What exists | What it does today | What it lacks for several agents |
| --- | --- | --- |
| A project as files (`src/space/`, `src/functions/`, `src/plugins/`, `src/data/`) — see `docs/en/projects-from-spaces.md` | One file per page or layout | Nothing stops two agents from writing the same file |
| Fingerprints (`apps/cli/src/commands/spaceOrigin.ts`: `digest`, `digestsOf`, `digestsOnDisk`) and `space pull` / `space push` | Tell what changed on each side; never write a file that changed on both; a push is refused when the cloud draft moved | Used between the project and the cloud, not between tasks |
| `npm run author`, `plitzi check`, `plitzi verify` | Check the whole space and the code | Run on the project, not on a task's copy |
| `--dry-run` (`apps/cli/src/commands/dryRun.ts`) | Says what a command would do | Not yet for merging, reverting or restoring |
| `plitzi space activity --follow --json` | Follows what happens on a cloud space | Knows nothing of local tasks, locks or runs |
| Skills installed by the CLI (`apps/cli/src/scaffold/skills.ts`) | Teach the API from the first session | Do not teach how to split work between subagents |
| `definition.rootId` and `elementsByRoot` (`packages/sdk-schema/src/helpers/elementTree.ts`) | Every element names the page or layout it belongs to | — |
| Harness subagents | Already split and launch work in parallel | Do not know which files of a space each one may touch, or how to join them without breaking it |

## 4. Principles

- **Plitzi provides the tools; the harness orchestrates.** Plitzi does not run agents or decide how work is split; it
  provides what a harness cannot do alone: know the space, reserve, isolate, check, merge, protect and show progress.
- **Proactive, not reactive.** An agent reserves before writing; a conflict is avoided, not discovered.
- **Visible to everyone.** Who holds what, for which task and since when, in the terminal and as JSON.
- **Reversible per task.** What one task did can be undone without touching the others.
- **Defensive by default.** Neither an agent that fails half-way, nor several at once, nor one that disconnects or
  writes where it should not, nor a rollback can leave the project broken: what is not checked as valid does not go in.
- **People in charge.** The final merge, pushing, publishing and overriding a lock are a person's. If a person and an
  agent change the same file, the person wins.
- **The same for people and agents.** A person can also reserve, take a task and merge.

## 5. The model

A coordinator, in its harness, splits a large job (a translated version, a whole new section) into tasks over disjoint
files and starts one subagent per task. Each works in its own copy, with its locks and a small context: its part and the
shared contracts. Reviewed and approved work merges into the run's copy; at the end, the whole run enters the project in
one merge that a person approves.

```
coordinator ──▶ subagent A (pages 1–4, its copy) ─┐
            ──▶ subagent B (pages 5–8, its copy) ─┼─▶ review ──approved──▶ run copy ──▶ person: final merge
            ──▶ subagent C (menu + data)         ─┘      │
                                                         └──changes requested──▶ back to the same subagent
shared contracts (layouts, components, tokens, data shapes): one owner; the rest read them as fixed
```

Total time goes from the sum of the tasks to the longest one, plus planning and merging.

## 6. Pieces

| # | Piece | Problem it solves | Phase |
| --- | --- | --- | --- |
| 1 | Conflicts: one agent per file, fingerprint merge, reconciliation | Two agents write one file; a person and an agent change the same thing unaware | 1 and 2 |
| 2 | Locks with expiry | Two agents start the same thing without knowing | 1 |
| 3 | Working copies: per task and per run | Agents write on everyone's project; half a job sits in it | 2 (task), 3 (run) |
| 4 | Identity and scope per task | Nobody knows which agent wrote what, or can bound it | 2 |
| 5 | Per-task log and revert | One task cannot be undone without losing the others | 2 |
| 6 | Task plan: priorities, dependencies, blockers, waiting | Duplicated work; urgent behind easy; agents waiting silently | 3 |
| 7 | Orchestration from the harness | A large job runs serially, and is lost if the harness dies | 3 |
| 8 | Notes, handoffs and review comments | What an agent knew is lost when the task moves on | 3 |
| 9 | Space rules and memory | Two correct changes that break something together; the same mistakes every run | 3 (rules), 4 (memory) |
| 10 | Defence against corruption: dry runs, backups, rollback | A failing agent, a bad merge or many agents at once break the project | From 1 |
| 11 | Following the run and each task | Nobody sees how a split job goes or what needs a person | 3 |

## 7. Implementation plan

Almost everything goes in the CLI (`apps/cli/src/commands`); the checks over a task's copy lean on `@plitzi/sdk-authoring`;
the skill goes in the CLI's scaffold. Each phase closes when its tests pass on the test bench.

### 7.1 Before phase 1: the spike (done, 2026-10-19)

1. **A task's copy is a whole copy, not an overlay.** An overlay would need module resolution to prefer the copy over the
   project — fragile with TypeScript imports. A copy of the project's files inside `tmp/plitzi-runs/…/work/` is authored
   by `projectSpaceAt(work)` as it is (tried on Café Lumen: the copy's edit reaches the authored space, the project's
   files stay byte for byte), and its packages resolve by walking up to the project's `node_modules`. Files are cloned
   (`COPYFILE_FICLONE`: copy-on-write on APFS and btrfs, a plain copy elsewhere) at ~0.3 ms a file — 770 files in a
   quarter of a second. Left out: `node_modules`, `tmp`, `dist`, `state`, `.git`, `.plitzi`, every `.env*` (an agent
   never reads credentials), and the binaries of `public/` and `vendor/` no check reads (the task's own are copied).
   The checks over a copy are the project's own scripts — what `plitzi verify` runs — run in the copy with the
   project's binaries first on the path; the pages (`plitzi check`) need the server and are the reviewer's, after a
   merge.
2. **Exclusive creation and atomic rename hold on macOS and Linux:** 8 processes racing 200 `open(…, 'wx')` each — every
   file one winner; 1 600 renames over one file read meanwhile — no torn read (Linux in `node:22-alpine`). **Windows is
   untested here** (CI has no Windows runner): `wx` is `CREATE_NEW` there, and a rename over a file another process holds
   open fails with `EPERM`/`EBUSY`, so every rename retries with backoff before it fails, and says so.
3. **The stylesheet is code, not a file of its own:** classes in a module (`theme.ts`, `styles.ts`), tokens in another,
   element defaults in the entry. It is a shared module like any other — read off the imports, by turns or by request.
4. **`.plitzi/` is committed and linted** (`eslint .`, `prettier --check .`); `tmp/` is ignored by git, the lint, the
   formatter and the server's `--watch-path`s. A run lives in `tmp/`.
5. **`plitzi verify`** runs `author`, `lint:space`, `typecheck`, `lint`, `test` and `format --check`, then the pages;
   `plitzi check` renders pages against a running server.

### 7.2 Phase 1 — Don't step on each other

**Goal:** several agents and people on one project, without stepping on each other or corrupting it.

1. **The test bench first:** scripted agents running CLI commands on a seeded project, in CI, with the first scenarios
   red. Everything else is written against it.
2. **Locks per file** (pieces 1 and 2): a `.lock` per file of the task (root, component, data file, function); shared
   things by turns or by request; the CLI checks every write against them.
3. **Basic defence** (piece 10): backups of what will be touched, `--dry-run`, atomic and idempotent writes, the
   project's checks.
4. **The workflow skill**, first version: lock before writing, and what to do with `claimed`.

**Exits when:** zero lost edits, no refusal without overlap, and the project always valid in every locking scenario.

### 7.3 Phase 2 — Working apart

**Goal:** each task works in its copy, it is known who did what, and one task can be undone alone.

- Per-task copies (piece 3) and the fingerprint merge (piece 1), with checks running over project + copy.
- Identity and scope per task (piece 4); per-task log and revert (piece 5).
- The Plitzi version pinned while copies are open, and the `version-mismatch` refusal.

**Exits when:** a task is reverted without touching the others, and a person editing the project meanwhile never loses
an edit.

### 7.4 Phase 3 — Splitting the work

**Goal:** a coordinator, from its harness, splits a large job across parallel subagents, and nothing is lost or
corrupted if something fails.

- Plan (piece 6) and orchestration (piece 7): `plitzi run plan` with its estimate, `plitzi task`, `plitzi run`.
- The run copy and the final merge, approved by a person.
- The run folder (§9.7): essentials, cache, locks, `prune`, one active machine.
- Stop, forced stop, replacing an agent without a signal, and rollback of the whole run.
- Waiting between tasks, turns on shared things, requests and integration tasks.
- Notes and review comments (piece 8); space rules on the result (piece 9).
- Following (piece 11) in the terminal and as JSON; the full skill and `plitzi run rehearse`.

**Exits when:** 12 pages across 4 subagents finish in a time close to the longest task, the final merge passes the space
rules, and every stop, disconnect, rollback and cache scenario passes. Set a success number before starting this phase —
for instance, at least 40 % less wall time than the same job done serially; if it is not reached, phases 1 and 2 stand
on their own.

### 7.5 Phase 4 — Cloud and memory

**Goal:** the same flow on a cloud space, and each run learning from the previous ones.

- Pull, work and push (§11), with what was edited in the builder meanwhile resolved file by file.
- The space's memory (piece 9).

**Exits when:** a split job on a cloud space arrives in one push, without overwriting what was edited in the builder
meanwhile.

## 8. Permissions

Agents never do the final merge, never push to the cloud, never publish, and never widen their own permissions.

| Action | Who may |
| --- | --- |
| Start a split run | An agent proposes it with its estimate; above the threshold, a person confirms |
| Write in a task | Only the subagent holding it, in its copy and within its locks |
| Lock a file | The task that has it in its share of the plan, or a person |
| Override a lock | A person; it is logged |
| Approve a task in review | The coordinator or a reviewer agent; for what affects everyone, a person |
| Change something shared (layout, component, plugin, tokens, runtime) | Its owner |
| Final merge of the run into the project | A person |
| Push to the cloud (`space push`), publish | A person; never an agent, let alone with `--force` |
| Stop a run | The coordinator or a person; the automatic brake too |
| Force a stop | A person, or the defence on something very serious |
| Reassign a task | The coordinator or a person |
| Rollback | A person; the defence alone, only back to the last good point |
| Purge a run | A person; it is also purged on finish, on cancel, or after 8 hours without activity |
| `--take-over` of a run | A person |
| `plitzi upgrade` with active runs | Waits; forcing it is a person's, and it migrates the copies |

**How the CLI tells who is who.** An agent always works with its task's token: `plitzi task take` answers it, and every
command of that task carries it (`--token`, or `PLITZI_TASK_TOKEN` in the command's environment — a command cannot set
its caller's). A person's actions are refused when a task token is present, or when there is no interactive
terminal in which the person confirms by typing the run's name. This is a guard rail, not security: locally an agent with
disk access could get round it. So when the CLI detects a person's action done out of place, the run enters
reconciliation (§9.1), and the backups undo it.

## 9. Design of each piece

Every command accepts `--json` for the harness, and `--dry-run` when it changes something. Every command exits with a
distinct code per reason (§9.12). All timestamps are ISO 8601 in UTC.

### 9.1 Conflicts: one agent per file, fingerprint merge, reconciliation

Nothing is lost silently: a change either goes in by a clear rule or becomes a visible conflict with what is needed to
resolve it.

- **One agent per file.** Each root (`definition.rootId`; a file of `src/space/` in a project), component, data file and
  function has one agent at a time, so merging inside a file is never needed between agents.
- **Fingerprint merge.** Each copy keeps the starting fingerprint of each file, as `space pull` does. On merge: changed
  only in the task → goes in; changed only in the project → stays; changed on both (a person edited it meanwhile, or an
  agent wrote outside its copy) → conflict, and that file is not written.
- **Three lines of defence:** avoid conflicts (locks, disjoint files, contracts fixed before starting), let in only what
  is clear, make the rest visible.

| Kind | Example | Resolution |
| --- | --- | --- |
| Same file changed on both sides | A person edits the page a task has in its copy | Visible conflict with both versions; the person wins; the agent's version is kept |
| Write outside the lock | An agent writes another task's file | Refused with `claimed`; if written straight into the project, the fingerprint catches it at merge |
| Delete against use | A task deletes a file another uses | Visible conflict; never a silent delete |
| Rename against use | A task renames a component or a route; another uses the old name | References follow a rename; otherwise integrity fails (§9.10) |
| Shared against its users | A task changes the props of a component another uses | The contract change needs an impact review (`plitzi space impact`) |
| Semantic | Two correct changes that together break the design or a link | Caught by the space rules (§9.9) on the result |

A refusal names the file, who changed each side and when. Conflict markers are never written into the project:

```
{ "refused": "conflict", "file": "src/space/launch.ts",
  "theirs": { "by": "person", "at": "2026-10-19T12:31:00Z" }, "yours": { "by": "t_12" } }
plitzi task resolve src/space/launch.ts --take theirs | yours
```

**Reconciliation, like a git conflict.** When the CLI detects something that left the flow — a project file changed
outside a merge, an agent writing outside its copy, a person's action done without confirmation, or a conflict while
merging or pulling — the run enters reconciliation, like a `git merge` with conflicts:

- **It stops:** no new task starts and no merge goes in until it is resolved.
- **It says what happened:** each affected file with its three versions (the starting one, from the backups; the
  project's; the task's) and who changed each.
- **It is resolved file by file:** keep one version, the other, or write a new one. The versions live in the run's
  folder; markers are never written into files.
- **Continue or abort:** `continue` checks the project and goes on, like `git merge --continue`; `abort` restores
  everything from the backups, like `git merge --abort`.
- **Who resolves it:** a person; the coordinator only for what is not a person's.

```
plitzi run status es-launch
plitzi task resolve src/space/precios.ts --take project | task | <file>
plitzi run continue es-launch
plitzi run abort es-launch
```

Rules: the same input always gives the same merge; no silent last-write-wins; conflicts are counted by kind (one that
repeats means the plan splits badly). Later, if needed: merging inside a file, by element and field, for a person and an
agent on the same page.

### 9.2 Locks with expiry

```
plitzi task claim page:/es/launch --task t_12 --intent "Translate to Spanish"
plitzi task claims            # which files each task locks, why and until when (reads the locks/ folders)
plitzi task release page:/es/launch
```

- **Scopes:** a root (page or layout), a component, a data file, a function or a flag. The unit is the file: a page is
  never split between agents. Shared things go by turns or by request (§9.6).
- **A reservation, not a padlock:** it lasts while its task has a signal (writes, progress or heartbeat), expires some
  time after losing it, and a person can always override it.
- Writing inside another task's lock is refused with `claimed`, its holder and until when.
- **Crossing files** (moving an element from one page to another) needs every lock; a new page is locked by its route
  before it exists.
- **People first:** a person may edit any file at any time. If they change a locked one, the CLI sees it through the
  fingerprint and says so in `plitzi run watch`; the task rereads and adapts, or the conflict is resolved at merge in
  the person's favour.
- **Where locks live:** one `.lock` per locked file, in the `locks/` folder of its task (§9.4). Nothing is locked in the
  cloud.

### 9.3 Working copies: per task and per run

- **Per-task copy:** taking a task copies its files into the run's cache, with their fingerprints; the subagent writes
  only there. Its checks run over the project plus that copy, without touching the project.
- **Backup of what will be touched:** taking a task also keeps an untouched backup of every file it will touch, and
  every merge first backs up each project file it will overwrite. If something goes wrong (an agent writes where it
  should not, a merge is cut, a file turns up broken or deleted), that file goes back to how it was, one by one,
  without touching the rest. It is cheap: only what is touched is kept.
- **Run copy:** approved work merges here, not into the project. At the end, `plitzi run finish` shows the whole run's
  diff as a dry run, and a person approves; only then is it written into the project, file by file. Half a run never
  sits in the project, and undoing it before the end is discarding the copy.
- **Up to date:** the run copy is brought up to date with the project often, with the fingerprint merge, so the final
  merge never arrives large all at once.
- **No git needed:** if the project uses git, the CLI makes no commits of its own; git stays as the person's safety net.

```
plitzi task take t_12                # locks its files and opens its copy
plitzi run finish es-launch          # the whole run's diff, as a dry run, for a person
plitzi run finish es-launch --apply  # writes it into the project
```

### 9.4 Identity and scope per task

- **A token per task,** given by the CLI when the task is taken: its name, whom it works for, which files it may touch
  and until when. Everything it writes is recorded under its task.
- **Scope:** the CLI accepts a task's writes only inside its copy and its locks; reassigning or a forced stop revokes
  the token.
- **Limits per task:** maximum time and size written. The model's cost belongs to the harness.
- **Honestly:** locally the harness has disk access and could write straight into the project. Protection therefore
  does not rest on the token but on the fingerprint merge: anything written outside the copy is caught as a conflict,
  and nothing is lost.
- **A `.lock` per file, for any harness:** like the lock an editor leaves while someone edits, each locked file has
  its own under its task's folder, at the same path (`tmp/plitzi-runs/<runId>/<taskId>/locks/src/space/precios.ts.lock`).
  It says which task holds it and until when, it is the reservation itself, and it goes away with the task. Any harness,
  editor or hook checks `tmp/plitzi-runs/*/*/locks/<path>.lock` before writing, or asks the CLI
  (`plitzi run can-write <file> --task t_12`, which answers yes or no with the reason). Blocking does not depend on any
  particular harness.
- **Locking never competes:** the plan gives tasks disjoint files, and a task only locks its own. If it needs another
  task's file, it waits (§9.6); if it is shared, it goes by turns or by request. With a second run opened by a person,
  the CLI also checks that run's locks before creating one.

### 9.5 Per-task log and revert

- **Log:** the run's cache records what each task wrote, file by file, with its fingerprint before and after.
- **Revert a task:** `plitzi task revert t_12` puts its files back; if another task or a person changed them since, it is
  listed as a conflict.
- **Replay a run:** while its cache lives, a run can be replayed step by step on a copy (`plitzi run replay <runId>`), to
  debug a failure without touching the project.
- **After the cache is purged,** history is the project's: git, if it uses it.

### 9.6 Task plan: priorities, dependencies, blockers and waiting

Tasks live in the run's plan (`plan.json`), not in a conversation: they survive a session closing and anyone can read
them. A plan is a graph: each task says what it depends on, and what depends on nothing goes first.

```
plitzi task create "Translate /launch" --scope page:/es/launch --priority high --depends t_a,t_b --estimate 30m
plitzi task next                 # the ready task with the highest priority
plitzi task take t_12            # locks its files and opens its copy
plitzi task block t_12 --reason "API key missing" --needs person
plitzi task handoff t_12 --note "…"
plitzi task complete t_12        # goes to review
```

| Field | What for |
| --- | --- |
| Priority | Critical, high, medium or low: among ready tasks, the highest goes first |
| Depends on | Tasks that must be merged before this one starts |
| Blocked by | Something outside the plan: a person, a decision, a credential; with the reason |
| Acceptance criteria | What review checks: checks that pass, how it must look, what it must say |
| Estimate | For the critical path and to warn when a task runs long |
| Milestone | Groups tasks that ship together |
| Files, owner and copy | What it touches, who does it, where |

States: pending → ready → in progress → in review → done; from review it can go back to changes requested and then in
progress, as many times as needed; plus blocked, waiting and failed. Rules:

- **Ready** = all dependencies done and nothing blocks it. Only ready tasks are taken.
- **The independent goes first.** If C depends on A and B and D depends on nothing, D starts alongside A and B.
- **The dependent starts by itself** when its dependencies merge.
- **Critical path first** among ready tasks of equal priority.
- **A blocker is said, not waited on silently;** whoever can unblock it is told, and the agent takes another ready task.
- **If a dependency fails, what depends on it does not start;** the coordinator replans or hands it to a person.
- **No cycles:** a plan with a circular dependency is refused when created, naming it.

**Waiting: when a task needs another task's file.** Instead of replanning, the task waits for the other to release it:

- **The wait is written in the task's own state** ("waits for t_7 on `precios.ts`"), which only it writes; the CLI
  gathers every wait by reading, and `run watch` shows who waits for what and on whom.
- **The file passes when the other finishes:** when t_7's work is approved and enters the run copy, t_7 releases the
  `.lock` and the next in line gets it, by priority. The waiting task's copy is refreshed with the approved version.
- **The agent is not left idle:** while its task waits, it can take another ready task. The waiting task keeps its copy
  and notes; if another agent resumes it, it starts from its last reviewed version.
- **No cycles:** the CLI keeps the wait graph and refuses the wait that would close a cycle (A waits for B, B for A),
  naming it; the coordinator decides.
- **Long waits:** a wait past twice the estimate of the task holding the file is reported to the coordinator.

```
plitzi task wait t_12 --for src/space/precios.ts   # waiting; gets it when t_7 releases it
```

**Shared things: turns, requests and integration tasks.** When a task needs something shared (a style class, a token, a
layout, a component, a data shape, a text catalogue):

- **By turns, the normal case:** if it is free, or one task is ahead, the task takes it like any file and waits its
  turn. No new task is created.
- **By request, when several want it at once** (queueing waits would be slower than doing it together): none touches
  it; each leaves a request in its folder (`requests/`) — the resource, the change, why, and where it is used — and
  carries on. Its checks accept what it requested as pending of that request.
- **One integration task per resource:** when the last requesting task is approved, the CLI creates a task that depends
  on all of them (the coordinator may only reorder it). One agent applies every change together; contradictory requests
  go to the coordinator or a person.
- **It gets the related tasks' context and carries on:** `plitzi task context` hands it the requests and their
  summaries, what each related task did (its last reviewed version and diff), where each uses what it asked for, their
  notes and review comments, the plan's contracts, the space's memory, and the shared file as it stands. Only that, so
  its context stays small. It applies the changes, checks those tasks' pages against them, and goes to review.
- **The final merge does not go in while a request is not integrated.**
- **Blocking requests do not wait for the end:** what cannot stay pending (a component or plugin that does not exist
  yet) creates its shared task at once, and the requesting task waits only for that one. A task and its integration
  can therefore never wait for each other.
- **Why:** the stylesheet is flat and cannot be split per task, and the same goes for tokens, text catalogues or a data
  file many pages read. One path serves every flat or shared thing.

```
plitzi task request styles:.badge-es --summary "Language tag on cards; used by p. 3 and p. 7"
plitzi task integrate styles        # one task with every request on the styles (the CLI creates it by itself)
plitzi task context t_20 --json     # requests, related work, notes, contracts and the current file
```

**Shared things decided upfront** follow the same idea: if two tasks need the same new plugin (or function, component,
data shape), the coordinator makes it its own task with an owner. The two either wait for it, or move ahead against its
contract (declaration fixed first, a placeholder meanwhile) while another agent builds it.

### 9.7 Orchestration of parallel subagents

**The coordinator sees the whole:** the goal and its limits; the map of the space (pages, layouts, components, tokens,
data, functions, flags, and what uses what); the current state (runs, tasks, locks, who is on what); what cuts across
tasks (navigation, languages, design system, accessibility, SEO); the impact of each change.

```
plitzi space overview              # the map of the space and what uses what
plitzi run state                   # runs, tasks, locks and who is on what
plitzi space impact component:nav  # what depends on it
plitzi run plan "Spanish version: 12 pages and the menu" --agents 4 --json
  → { tasks: [{ id, files, dependsOn }], shared: ["component:nav", "tokens"], estimate }
plitzi run open <plan>             # opens the run: its folder and its backups
plitzi task progress t_12 --fraction 0.6 --step "page 3 of 5"
```

1. **Plan:** tasks over disjoint files, with priorities, dependencies and blockers; what depends on nothing starts now.
2. **Contracts:** what is shared is decided first — built by one agent first, or owned by one and read as fixed.
3. **Split:** the harness starts the subagents; each takes its task with its token, its locks and its copy, and a small
   context.
4. **Progress:** each subagent reports its fraction and step; the CLI stores it and `run watch` shows it.
5. **Merge:** only approved work enters the run copy, in dependency order; at the end the whole run enters the project
   in one merge approved by a person, after the space rules pass.
6. **Limits:** time per task and per run; stop at the end of the current task; the coordinator never does the final
   merge.

**Review and iteration.** A finished task goes to review — by the coordinator or a separate reviewer agent; a person for
what affects everyone — against its acceptance criteria, the space rules, `page check`, the page as actually rendered
(mobile and desktop captures), and how it fits the rest. Approving moves it to the run copy; requesting changes sends it
back with comments anchored to elements; after a set number of rounds, it goes to a person.

```
plitzi task review t_12 --changes "doesn't fit on mobile" --on hero-title
plitzi task review t_12 --approve
```

**The orchestration lives in the harness:**

| The harness | The CLI gives it |
| --- | --- |
| Makes a plan and splits it into phases or tasks | The map, the impact of each change, the estimate; the plan stored to outlive the session |
| Starts subagents | A token per task, its locks and its copy |
| Isolates each one | A working copy per task, with or without git |
| Waits for and follows subagents | `plitzi run watch --json` and each task's progress |
| Reviews the work | The project's checks, the rendered page, the space rules, `plitzi task review` |
| Stops at the end of a phase | `plitzi run stop`, with what is pending kept in the plan |
| Dies and comes back | The plan's state, the locks and the copies, to resume where it was |

Commands are few and compose; each answer carries what the next step needs (who holds a lock, which task is ready, which
check failed and where). A harness that uses only some — locks and copies without a plan — also works.

**Teaching the harness:** a multi-agent workflow skill installed by the CLI (lock before writing, write only in your
copy, report progress, check `run watch` before each task, honour "stop", know that what was written since the last
review is discarded on a cut, never do the final merge nor push); refusals that say what is missing and how to go on; and
`plitzi run rehearse`, which runs the flow on a sample project with simulated cuts and stops.

**Estimate before starting:** `plitzi run plan` returns how many tasks and agents, how long, and how many review rounds
are expected. Above a threshold set by the person, the run does not start without confirmation; during the run, following
compares spent against estimated.

**Stop at the end of the task, never half-way.** Like Claude Code following a plan by phases and stopping when one ends,
stopping lets each subagent finish its current task, leave it in review, and take no other. What is pending stays in the
plan for the person to continue, change or delete. A forced stop is different: the CLI revokes the tasks' tokens, so the
cut does not depend on the harness obeying; nothing merges, and what the cut tasks wrote since their last review is
discarded.

```
plitzi run stop es-launch          # after the tasks in progress
plitzi run stop es-launch --force  # now: revokes tokens, discards what was cut
```

**If the coordinator or the whole harness dies,** everything is in the run's folder: plan, tasks, locks, copies and log.
Another coordinator (same harness or another) or a person attaches and goes on: done tasks are not repeated; tasks in
progress return to their last reviewed version. If it comes back after 8 hours without activity, the cache was purged
but the essentials remain, and the run resumes from them.

```
plitzi run attach es-launch        # → plan, tasks, locks, copies and history
```

**The run's folder.** Everything a run owns lives together, split in two. **Essentials**, small and readable: `plan.json`,
`run.json`, the backups (`base/`, `merges/`) and, per task, its state, requests, verdict and `reviewed/`. Never purged
while the run exists: with no git, they are the only way back. **Cache and locks:** the `cache/` folders (copies, the run
copy, log, progress, signal) and the `locks/` folders; the run copy is rebuilt from the project and the reviewed work of
the tasks done. All of it under `tmp/`, which the project already keeps out of git, the lint and the formatter — nothing
is added to a `.gitignore`, and nothing assumes there is one.

**One writer per file.** Each task has its folder and only its agent writes there, so several agents using the CLI at
once do not collide.

```
tmp/plitzi-runs/<runId>/
  plan.json                # the plan and each task's files; only the coordinator writes it
  cache/
    merge.lock             # one merge at a time, with expiry
    base/                  # backups taken when the run opens
    run/                   # the run copy; only whoever merges writes it
    conflicts/             # the three versions of each file under reconciliation
  <taskId>/
    state.json             # state and notes; only its task writes it
    locks/<path>.lock      # one .lock per file of the task
    requests/              # its requests on shared things, with their summaries
    review.json            # the verdict; only the reviewer writes it
    reviewed/              # its last reviewed version
    cache/
      owner.json           # who took it, created exclusively
      work/                # its working copy
      backup/              # the backup of what it will touch
      progress.json        # step, fraction and heartbeat
      log.jsonl            # its log
```

Only two things are shared between tasks, and neither needs a global lock (locking files is not one of them: the plan
already splits them): **taking a task** (`owner.json`, created with `wx` — atomic everywhere, Windows included: the first
wins, the other moves to the next) and **merging into the run copy** (one at a time, with `merge.lock` created with `wx`
and an expiry in case the merger is cut). `plitzi run watch` gathers everything by reading, writing nothing.

The run is removed whole when it finishes or is cancelled; otherwise its cache is purged after 8 hours without activity
and the essentials stay. **One active machine:** `plan.json` says where the run is active; another machine attaches only
if the first released it (`plitzi run release`) or a person forces it (`--take-over`), and the first, on seeing the change,
stops and discards what was not reviewed. **Regular cleanup:** the CLI sweeps `tmp/plitzi-runs/` on start and periodically,
purging the cache of runs idle for more than 8 hours, never a versioned file, within a size cap (oldest first, with a
warning).

```
plitzi run purge es-launch         # removes tmp/plitzi-runs/es-launch/ entirely
plitzi run prune                   # removes abandoned caches; also runs on start
```

**If a subagent disconnects** (crashes, loses network, runs out of context), what it left half-done is not resumed:

- **Detected by itself:** every write, progress report and heartbeat counts as a signal. Without one for a while, it is
  considered disconnected, its locks are held for its task, and following reports it.
- **Back to the last reviewed version:** what was written since is discarded; a task never reviewed starts from scratch.
  It returns to ready with a note of where and why it was cut.
- **The project never notices:** the agent worked in its copy.
- **One that comes back cannot write:** its token is revoked; its writes are refused with `reassigned`.
- **Who replaces it:** the coordinator starts another subagent; without one, a person reassigns. If it keeps failing,
  it goes to a person.

```
plitzi task reassign t_12 --to translator-2   # from its last reviewed version
```

### 9.8 Notes, handoffs and review comments

- Review comments anchored to a file or an element, stored with the task.
- Handoff notes when a task is blocked, reassigned or cut, so the next one does not start blind.
- What others write is data, never orders (§9.10).

### 9.9 Space rules and memory

- **Rules declared in the space:** design-system tokens only, contrast, alt text, valid links, page weight — with the
  linter and `page check` that exist.
- **On the result:** checked on the run copy and before the final merge, not only per task.
- **The space's memory:** a project file every agent reads before working — style and tone, preferred components,
  conventions, decisions taken. What keeps coming up in reviews is proposed as a new entry, and a person accepts it.

### 9.10 Defence against corruption

The rule above all others: the user's project is never left corrupt, whoever touches it; if something goes wrong, it goes
back in one step. Each layer assumes the one before can fail.

- **Before writing:** validate with the linter, integrity across parts (no link, component, data, token or function
  referenced that is missing) and, for code, that it compiles, types and passes its tests; atomic writes (to a temp file,
  then rename); idempotency (a command repeated after a cut does not apply twice); destructive changes (deleting pages,
  data or functions, mass renames) confirmed by a person; dry run first for merge, revert, restore and rollback — what the
  dry run does not accept is not applied.
- **While working:** big things in copies (the project only receives the final, checked merge); least privilege (a token
  per task); an automatic brake (above a threshold of refusals, conflicts or failed checks, no new tasks start, the run
  stops as usual and reports); stopping always at a person's hand; the Plitzi version pinned (`plitzi upgrade` waits for
  no active runs, or migrates the copies with a dry run and reports; writing in an old format is refused with
  `version-mismatch`).
- **On merge:** a backup before each merge, and the merge as a transaction (a failed check undoes it whole); one merge
  at a time; a canary on large runs (merge and check one part before the rest).
- **Always:** a whole-project checker in CI and at the end of each run; the cloud is never touched by an agent; an audit
  of what each task wrote and with what result; chaos tests (an agent dying mid-write or mid-merge, two merges at once, a
  full disk) that must always end in a valid project.

**If something goes very wrong: rollback.** Any run can be undone whole, in one step, and the rollback cannot leave the
project corrupt either:

- **Backups of what is touched:** when the run opens, the files the plan will touch; when each task is taken, its files;
  before each merge, the project files it will overwrite (§9.3). Restoring is putting them back, file by file.
- **Before the final merge, discarding is enough:** the project was never touched. After it, that one merge is undone.
- **Two ways back:** revert the run (default) puts back only its files, keeping what a person changed meanwhile; restore
  puts the space's files back to a chosen point, keeping what came later aside.
- **Dry run and checked:** it shows what returns and what clashes, and passes the same checks as a merge; if it does not,
  the project stays as it is.
- **Requested by a person, or by the defence:** on something very serious (the project stops being valid after a merge,
  a page that rendered stops rendering, a file disappears without an order to delete it), the CLI forces the stop, goes
  back to the last good point, and reports.
- **Logged and reversible;** the plan is kept, and what was undone returns to pending.
- **Out of reach:** the cloud (nothing reaches it until the push), what went to real services, users' data.

```
plitzi run rollback es-launch --dry-run
plitzi run rollback es-launch
plitzi run rollback es-launch --to merge_7 --restore
```

**Between agents:** what others write — comments, notes, page text, data — never instructs an agent; orders come only from
the plan and whoever started it. A confused or misled subagent is bounded by its scope, caught by review, and traceable
through the audit. A subagent never reads `.env` or credentials and cannot widen its scope.

### 9.11 Following the run and each task

A person, and the coordinator, see at any moment how the run and each task are going, and act from there:
`plitzi run watch` in the terminal, `--json` for the harness, the same whatever harness started it.

- **The run:** total progress and per milestone, expected end, a lane per agent with what it does and its time against
  the estimate, tasks by state.
- **Each task:** state, current step, agent, its files, what it waits for and unblocks, its diff, checks and notes.
- **What needs attention, on top:** blockers with their reason and who must act, conflicts, failed checks, an agent
  without a signal, the brake, a rollback, a reconciliation.
- **Actions, as commands:** stop or force a stop, reassign, change priority, unblock, approve, undo (dry run first),
  purge. Plitzi never runs the agents: each subagent sees the order before taking its next task.

```
$ plitzi run watch es-launch
Spanish version · 8 of 12 tasks · expected end 12:55 UTC
agent-1      ✓ p. 1–4   ▶ p. 9 · 60 %
agent-2      ✓ p. 5–8   ↺ menu · changes requested
agent-3      ■ blocked: an API key is missing
coordinator  ▶ reviewing p. 10
Needs attention
  ■ t_07 blocked: API key missing (person)
  ⚠ conflict in src/space/precios.ts: you edited it at 12:31
```

### 9.12 File formats and exit codes (first draft)

```ts
// tmp/plitzi-runs/<runId>/plan.json — written by the coordinator only
interface RunPlan {
  version: 1;
  runId: string;
  goal: string;
  plitziVersion: string; // pinned for the run (§9.10)
  activeOn: { machine: string; since: string };
  contracts: { resource: string; owner: string; note: string }[];
  tasks: PlannedTask[];
}

interface PlannedTask {
  id: string;
  title: string;
  files: string[]; // disjoint across tasks: a plan that repeats a file is refused
  dependsOn: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimateMinutes: number;
  acceptance: string[];
  milestone?: string;
}

// <taskId>/state.json — written by its task only
interface TaskState {
  status: 'pending' | 'ready' | 'in-progress' | 'waiting' | 'in-review' | 'changes-requested' | 'done' | 'blocked' | 'failed';
  waitingFor?: { file: string; task: string };
  blockedBy?: { reason: string; needs: 'person' | 'coordinator' | 'task' };
  cutAt?: { step: string; reason: string };
  notes: string[];
}

// <taskId>/review.json — written by the reviewer only
interface TaskReview {
  round: number;
  verdict: 'approve' | 'changes';
  comments: { file: string; element?: string; note: string }[];
  by: string;
  at: string;
}

// <taskId>/locks/<path>.lock — created with `wx`; the reservation itself
interface FileLock {
  runId: string;
  taskId: string;
  agent: string;
  intent: string;
  since: string;
  heartbeatAt: string;
}

// <taskId>/requests/<n>.json
interface SharedRequest {
  resource: string; // e.g. "styles:.badge-es"
  change: string;
  why: string;
  usedIn: string[];
  blocking: boolean; // true creates its shared task at once (§9.6)
}
```

| Exit code | Meaning | What the harness does |
| --- | --- | --- |
| 0 | Done | Go on |
| 10 | `claimed` — the file is another task's | Take another task, or `task wait` |
| 11 | `waiting` — queued for a file | Take another ready task meanwhile |
| 12 | `reassigned` — this task is no longer yours | Stop working on it |
| 13 | `version-mismatch` | Re-read; the run was migrated |
| 14 | `stopping` — the run is stopping | Finish the current task; take no other |
| 15 | `forced-stop` | Stop now |
| 16 | `reconciliation` — the run is paused | Wait; a person resolves it |
| 17 | `person-only` | Ask a person |
| 18 | `conflict` | Report it; never write markers |
| 19 | `checks-failed` | Fix what the output names |

## 10. Whole project, not only pages

| Part | Locked by | Checked before merging |
| --- | --- | --- |
| Pages and layouts | Root, which is its file | `npm run author`, the space rules and `page check` |
| Styles | By turns when demand is low; by request and integration when several tasks want them | The same, on the pages that use what changed |
| Functions (tasks, routes, jobs, OAuth) | File | Compiles, types, its tests and a test with cases |
| Runtime | File, one owner | Starts isolated and its routes answer; its tests |
| Plugins | Whole folder; its declaration is a contract | Compiles, renders on the server and in the browser, and `page check` of the pages using it |
| Actions and connectors | Action or connector | A dry test, with no effect outside |
| Data | File | Its shape, and that nothing reading it breaks |
| Flags and page permissions | Entry | Nobody loses access by mistake; permissions with a person |
| Credentials and secrets (`.env`) | Never touched by an agent | — |
| Files (images, fonts) | File | Type and size |

Code, with more care: each copy is tested whole with its functions, runtime and plugins, in isolation (outside calls go
to a test environment; nothing from a task runs against production data or credentials); after merging code, the whole
project is compiled and tested; impact follows the whole chain (`plitzi space impact`); live state is never touched from
a task; deploying or publishing code is always a person's.

## 11. Cloud spaces: pull, work, push

Work with several agents never happens in the cloud. A cloud space is pulled, worked on locally and pushed, with what
exists:

1. **Pull:** `plitzi create --from` the first time, or `plitzi space pull`.
2. **Work locally** with everything in this RFC.
3. **Pull again before pushing:** `space pull` compares each file on both sides. What was edited in the builder on other
   pages comes in by itself; if the same page changed on both sides, nothing is written, the file is named, and a person
   decides.
4. **Check and push:** the project's checks and one `plitzi space push`, by a person. If the draft moved in between, the
   push is refused and step 3 repeats.

For the cloud, a run of four subagents is one change: the server never receives many agents writing at once, nobody
publishes half a run, and the draft is untouched while the run lasts. None of this needs a change in the MCP, the builder
or the server.

## 12. Testing and measuring

**Tested or it does not go in.** Unit and e2e tests are mandatory; CI refuses a merge that lacks or fails them.

- **Unit tests per piece:** locks (expiry, override), the fingerprint merge, the plan graph (cycles, unblocking,
  priorities), task states, tokens and revocation, the wait graph, backups and rollback. And a property for `--dry-run`:
  what it says is exactly what it then does, and a dry run changes nothing.
- **E2E end to end:** every scenario below is a test, with scripted agents running CLI commands on a seeded project; the
  cloud flow against a test space with `space pull` and `space push`.
- **Chaos and random sequences:** thousands of random sequences of tasks, people's edits, cuts and merges, each checked
  for a valid project and every change that did not go in recorded as a conflict.
- **Every bug, a test first;** every defence path covered; each phase exits with its tests green.

No real models on the bench: deterministic agents running concrete commands, so every run is reproducible.

| Scenario | Expected |
| --- | --- |
| Two agents ask for the same file | The second gets `claimed` with holder and time, and takes another task |
| Two agents on different files at once | Both merge with no refusal |
| A task writes a file that is not its own | Refused with `claimed`; nothing written |
| An agent writes straight into the project | The fingerprint catches it, the run enters reconciliation, nothing is lost |
| Moving an element between two pages | Needs both locks; without them, refused |
| A task needs a file outside its share | It waits until the holder releases it, and gets the approved version |
| A waits for B's file and B for A's | The wait closing the cycle is refused, naming it; the coordinator decides |
| A wait exceeds twice the holder's estimate | The coordinator is told |
| While a task waits, its agent is free | It takes another ready task; the waiting one keeps its copy and notes |
| Two tasks change the styles | The first takes them, the second waits its turn; no integration task |
| Four tasks want the styles at once | None touches them; they request and one integration task applies all |
| A task uses a class it requested that does not exist yet | Its checks accept it as pending; the task can finish |
| Contradictory requests on the same thing | The integration task does not pick alone: the coordinator or a person decides |
| A task needs a new component it cannot do without | Its shared task is created at once and it waits only for that |
| Final merge with a request not integrated | Refused, naming the request |
| An agent takes an integration task | Gets the requests, the related reviewed work, notes and the current file; applies and checks |
| An agent changes a layout it does not own | Refused; it asks the owner |
| A person edits a file a task has in its copy | The task is told; otherwise, at merge, the person wins and the agent's version is kept |
| Revert one task | The others' work untouched |
| Plan with dependencies (C after A and B; D free) | D runs in parallel; C starts by itself when A and B merge |
| Two tasks need the same new plugin | One task for the plugin; both wait or work against its contract; never two plugins |
| A task's plugin breaks server rendering | Not merged; review names the failing pages |
| An action tried in a task | Reaches no real service: goes to the test environment |
| A task blocked by a person | Whoever can unblock is told; the agent takes another ready task |
| A task fails its criteria | Specific changes requested; it iterates in its copy; after the round limit, a person |
| 12 pages across 4 subagents | Finish in parallel; the final merge passes the space rules |
| The same plan with two different harnesses | The same commands suffice; same checks pass |
| Page text with instructions for the agent | Not followed; review flags it |
| A run above the estimated cost | Does not start without confirmation; deviations are reported |
| A harness writes without locking or skips review | Refused, saying what is missing and how to go on |
| Rehearsal on the sample project | The harness passes the simulated cuts and stops |
| Stop with three tasks in progress | All three finish and go to review; none starts; pending stays in the plan |
| Forced stop mid-task | Tokens revoked; nothing merges; the task returns to its last reviewed version, or to scratch |
| The harness dies and returns within 8 hours | It attaches and goes on; no done task repeats |
| The harness returns after 8 idle hours | The cache was purged; the essentials remain; the run resumes from the plan |
| A subagent disconnects mid-task | What it wrote since its last review is discarded; another continues from the reviewed version |
| The disconnected subagent returns and writes | Refused with `reassigned` |
| A task is cut during a round of requested changes | Back to the version that passed its last review |
| A long task thinks or runs tests for 40 minutes without writing | Its heartbeat keeps it alive; it keeps its locks |
| An agent dies mid-write or mid-merge | Nothing half-done; the project is as before and valid |
| A project file turns up broken or deleted during a run | Restored from its backup, that file only |
| The merger dies holding `merge.lock` | The lock expires; the half merge is undone from backups; the next goes in |
| Two agents take the same task at once | Only one does; the other moves to the next ready one |
| Eight agents using the CLI at once | None writes another's file; no state is lost or mixed |
| A run starts failing a lot | The brake stops new tasks, stops the run as usual and reports |
| A merge leaves the project invalid | Forced stop, back to the last good point, reported |
| Undo a run before its final merge | The run copy is discarded; the project never changed |
| Rollback as a dry run | Shows what returns and clashes; nothing changes |
| Rollback with a person's changes on top | Only the run's work is undone; the person's stays |
| A rollback that fails the checks | Not applied; the project stays valid |
| Undo a rollback | The project returns to how it was before it |
| Reconciliation aborted | Everything is restored from the backups |
| Reconciliation resolved, then continue | The project is checked and the run goes on |
| An agent tries a person's action with its token | Refused, saying it is a person's |
| A hook asks whether it may write a file with another task's `.lock` | `can-write` says no, with the task and until when |
| A person opens a second run wanting a file of the first | The CLI sees the other run's lock; `claimed` |
| `plitzi upgrade` during a run | Waits, or migrates the copies with a dry run and reports |
| An agent writes in an old version's format | `version-mismatch`; nothing written |
| A run finishes or is cancelled | Removed whole, plan included |
| A run active for more than 8 hours | Its cache stays while there is activity |
| Abandoned caches | Removed on start or by the sweep; never a versioned file |
| Caches above the size cap | Oldest removed first, with a warning |
| A project without git | Everything works the same |
| A project with git | The CLI makes no commits; `cache/` and `locks/` never appear in git |
| Resuming a run on another machine | `attach` reads the plan, rebuilds the cache and goes on |
| Two machines attach to the same run | The second is refused until the first releases it |
| A cloud space: pull, work, push | One push at the end |
| The cloud draft changed during the run | The push is refused; the pull brings other pages; the same page is a conflict a person decides |
| An agent tries to push to the cloud | Refused: pushing is a person's |

Metrics on every release: lost edits (always 0, like invalid projects after chaos tests or a rollback); refused and
repeated writes per 100; total time of a split run against the same job done serially; conflicts reaching a person per
run; disk held by abandoned caches after each sweep, and what a run leaves in the project outside its cache (a few KB,
and nothing once finished).

## 13. Ideas taken from git

| In git | Here |
| --- | --- |
| Don't work two on the same file | One agent per file: root, component, function or data file; shared things by turns or by request |
| Small commits with author and message | Small writes, each with its task and purpose |
| Short branches, sync often | Copies that live as long as their task and catch up with the project |
| Three-way merge | Fingerprint merge, like `space pull` |
| Pull request and review | Review with requested changes |
| CODEOWNERS | Owners of what is shared |
| Protected branch | The project: only the final merge, approved by a person |
| Required CI checks | Space rules, integrity, compilation, unit and e2e tests before merging |
| `git revert` and `reflog` | Revert per task, and backups |
| `git bisect` | Replaying a run step by step |
| Worktrees | Working copies per task |
| `git merge --continue` / `--abort` | Reconciliation's `continue` / `abort` |

Not copied: writing conflict markers into files. A conflict is shown aside, and the project is always valid.

## 14. Defaults

Starting values, tuned by what the test bench measures. They assume few subagents and long tasks: a slow task is not a
dead task, and no timer ever cuts a task that is alive.

| Value | Default |
| --- | --- |
| Run cache | Purged after 8 hours without activity from any of its tasks |
| Cleanup of abandoned runs | On CLI start and every 30 minutes; 1 GB cap across caches |
| Lock (`.lock`) | Lasts while its task has a signal; expires 30 minutes after losing it |
| Agent without a signal | 15 minutes without writes, progress or heartbeat, or 25 % of its task's estimate if longer; the harness beats at least every 2 minutes (`plitzi task heartbeat`), and any command of the task counts |
| Task beyond its estimate | A warning at twice the estimate; never cut by time |
| Turns on shared things | Wait for the turn with at most one task ahead; with more, request and integration |
| Long wait | The coordinator is told at twice the estimate of the task holding the file |
| Review rounds | 3; then the task goes to a person |
| Automatic brake | More than 20 % of writes refused, or 5 failed checks or unresolved conflicts, within 30 minutes |
| Cost confirmation | Runs with more than 4 subagents or more than 2 estimated hours |
| "Very serious" (automatic rollback) | The project stops being valid after a merge, a page that rendered stops rendering, or a file disappears without an order to delete it |

## 15. Closed questions

- **The stylesheet is not split:** it is flat; it goes by turns or, when several tasks want it at once, an integration
  task changes it — like every flat or shared thing.
- **How a harness hears "stop" and "reassign":** `plitzi run watch --json` and a distinct exit code per reason
  (§9.12), with the protocol written in the skill.
- **The server does not change:** `space push` already refuses a draft that moved. Only if phase 4 shows a need — for
  instance, the push arriving as one change with its own restore point — is that decided then.

Nothing in the design is open; what is missing will come out of the spike (§7.1) and the test bench. Command names, file
formats and exit codes are this RFC's first draft, to be confirmed with Carlos before code is written.

## 16. Out of scope, for now

Agents working in parallel directly on the cloud: new MCP tools, seeing them in the builder, an exclusive mode that makes
an area read-only for people, a run cache in MongoDB, identity and permissions on the server, and load limits. It was set
aside because it would load the server with many small writes and is the most expensive part to build; cloud spaces are
worked on by pulling and pushing. If it is ever needed, the mechanism here can move to the server without redesigning it.
