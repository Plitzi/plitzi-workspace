# Improving the CLI from what runs report

For whoever changes `apps/cli` — an agent or a person — from what a run left: its `feedback.md`
(`.plitzi/plitzi-reports/runs/<run>/`, how it is made is [agent runs](./agent-runs.md) § The report). The question this
page answers is the one that comes before any code: **is this Plitzi's to change, and is a change what it needs?**

Every change to the CLI has a price the run does not show: the agents relearn a command, a skill grows towards its
budget, a message that worked reads differently, an option is one more thing to choose between. The CLI gets better by
**fewer surprises, not more features** — the more stable it is, the better the agents work. A finding is a fact about a
run; it is not yet a task.

## What `feedback.md` hands you

Plitzi's findings come in four groups (`runs/findings/plitziClass.ts`), taken up in this order:

1. **Plitzi got it wrong** — a crash, a command error, a run's machinery out of step, or a word that was not true.
2. **No way through Plitzi** — the agents went round it: a script beside the CLI, the same call again and again,
   `explain` that did not answer.
3. **Plitzi in the way** — a command line refused though its meaning was plain, an answer too long to act on.
4. **Said — to triage** — what an agent or the lead wrote in their own words (`--friction`, `--hardest`,
   `run notice --plitzi`). The run cannot tell these apart: you do, with the questions below.

The first three are measured, and each is still a symptom: read its evidence before deciding what it is.

## The line

**Plitzi's — fix it at the root, in general:**

- **Plitzi said something untrue.** A "success" for a refused action, a count read backwards, advice that breaks the
  page, "it proves the change" for a copy that never ran. First, always: an agent believes it and builds on it.
- **What an agent needed has no way through Plitzi**, and it cost a detour: a script of its own, a burst of calls, a
  value read indirectly (each crate's shadow for "how many are picked"). Give it to the command closest to the need.
- **Something written that does nothing, and says nothing.** A rule holding a template, a source named short: a lint
  that refuses it, and the reference that says why.
- **A plain intent refused, or an answer too long to act on.** Read it as meant and say so, or keep what is acted on
  first and the rest one option away.

**Not Plitzi's — note it, change nothing:**

- **The project's.** Its data and seed (an account with a 40-character name), its components (a key's fixed height),
  its tests. A run on another project would not meet it.
- **Iterating.** Measuring after each edit, a `--help`, a wrong flag fixed by the next call. A burst is Plitzi's only
  when the answers did not settle what was asked — look at what changed between them.
- **A decision Plitzi already warned of.** A plan's `touches` left short after the dry run named the file: the lead's.
- **What it costs by nature.** A tester's queue, mutation proofs, a context read again by the harness.

**Correct by design, and surprising:** say it where it happens — the answer, a notice, a line of the skill — and keep
the behaviour (`page play` plays its steps again at each width, an action once, and says so).

## Questions for a finding

1. **Is it already fixed?** `feedback.md` names the CLI the run used. Look at what changed since (the changeset,
   `git log apps/cli`): a run on an older CLI reports what the newer one answers.
2. **Did Plitzi say something untrue?** Then it is a bug, and first.
3. **Is there already a way?** `explain`, the command's `--help`, the skill. If the agent missed it, the fix is the line
   that would have led there — a hint under a refusal, a word `explain` answers to — never a second way to do it.
4. **How often, and how hard?** Met by two agents, in two runs, or worth a detour — change it. Met once and recovered
   from in the next call — note it.
5. **Is it general?** It would hold for any project and any run. A fix that names one project's pages, data or seed is
   that project's.
6. **What do the records say?** Not the agent's summary: `records/usage.jsonl` has every command with its answer, exit
   code and time; `scratch/` the scripts it wrote. An agent's account of a problem can be wrong — read the code too.

dev-1's 44 `page measure` calls in one run were one need — the page's state between steps — and became
`page play --read state.<key>`; its friction "`when` rules do not read a list's item" was a template in the rule, and
became a lint and a line of the reference, not a change to rules.

## When you change it

- The smallest change at the root: an option of the command that is closest, a better answer, a hint — before a new
  command. Never a second way to say the same thing (the repo's `AGENTS.md`, one source of truth).
- A test that fails without it, written from the run's case.
- Every surface in the same change: the skill (within its budget), the README, `explain`, the changeset.
- The next run shows whether it held: the finding's subject is not "met before".
