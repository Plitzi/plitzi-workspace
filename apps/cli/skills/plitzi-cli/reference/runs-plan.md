# Planning a run with the person, before anything starts

The person hears what the run will do — what is built, what they decided, what is left out, how long, who works — before
an agent starts or a token is spent. The lead's half after it: [runs-lead.md](runs-lead.md).

## 1. The goal, asked

- Read what is open first: `plitzi run backlog`, the last run's `.plitzi/plitzi-reports/runs/<run>/report.md` (**What is left**).
- Ask the goal as a choice — two to four options, yours recommended first, each with its size (tasks) and what it tests
  of the project. One open question is not asked when a choice would do.

## 2. Read before you write a task

- `plitzi space overview` (who owns which file), then the code every task will change — its model, its actions, the
  pages it lands on — and the demo data each state is seen with: a state the data never reaches is seen by nobody.
- The platform's API each task uses and its limits: `plitzi explain <name>` (a member: `explain ctx.later`), the skills,
  the installed `.d.ts`. A limit found is a constraint the tasks are written around — and Plitzi's to fix: say it to the
  person, and once the run is open `run notice --plitzi "…"`. A job that must survive a restart, when the scheduler
  keeps it in memory, is kept in kv with its time and caught up by a clock.

## 3. The person's decisions, before the tasks

- Ask what changes the tasks and is theirs: what a visitor sees (local time or UTC), how they are told (a notice, an
  email), limits and defaults (2 pending, 140 characters, where an accepted request goes). Each with its options and
  your recommendation; never a technical choice — that is yours.
- An answer that is none of the options is read as it is said ("ambas, según la sala" — a rule of the room).
- Their answers go in the primer in their words, and what they rule out in `leftOut`.

## 4. The primer and the plan

- **Primer** (≤ 16 KB; every task's first brief carries it, so keep it under 6k — `run open --dry-run` says the cost past it):
  what is true of the project, the decisions, the constraints found (time, what survives a restart), and the demo data
  that shows each state; the rest named where it is (a file, a skill).
- **Plan**: one contract task first when several share a model; each task's `findings` from what you read; the ids its
  checks expect named in a note, so no agent names them otherwise; `leftOut` as lines.
- `plitzi run open <plan> --dry-run` until nothing it flags is left to fix (a file read by one no task holds, a check on an id
  nothing makes); `plitzi run open <plan> --dry-run --rehearse` — the critical path, the reviews, how many agents are worth it.

## 5. The summary, said before opening

In the person's language, short, from the plan — never a list to read in the JSON:

- **What is built**, by feature: its tasks in a line each, the tests and specs that prove it.
- **What they decided**, and **what is left out**.
- **How long**: the critical path, and at the project's pace (`run open --dry-run` says it); the reviews; the team — who starts
  with the run, who on demand.
- **What you found** of Plitzi (step 2).
- **Who applies the result** — the person (`run finish --apply`), unless they let you (`run open --lead-finishes`).
- **How to open and follow it**: the open command — a run past 5 agents or 120 minutes is the person's to confirm in
  their terminal — `plitzi run monitor` (130 columns for its sidebar; its `p` serves the approved work on 8300 and `x` stops it, its output in the panel; `m` switches simple and advanced).

Opened by `run start`, its scope spike is this planning: only a scout starts while the run holds the spike alone, and
the summary is said before the lead's `task review s-scope --approve` (with no scout, `task complete s-scope --found …
--tasks`), which makes the work.
