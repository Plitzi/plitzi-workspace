# RFC 0033 — WS4 briefs: authoring, MCP, CLI, skills

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

Read [`00-how-to-work.md`](00-how-to-work.md) first, then `plitzi-workspace/docs/en/improving-the-cli.md` — its rule
governs this workstream: **the CLI gets better by fewer surprises, not more features**; a finding from a run is a
fact, not yet a task. Repository: `plitzi-workspace` unless said.

Rules that are easy to break here: nothing of a seed, a run or an experiment by name in the CLI, the MCP or their
docs (`apps/cli/src/noRunNames.test.ts` enforces part of it); the CLI stays general — what is true of a space lives
in `sdk-authoring`; skills and references stay under their budgets (a reference ≤ 3,500 tokens) and never lose an
example to fit; the MCP's budget is watched, never met by dropping a field an agent needs.

---

## T4.1 — A standing score

- **Finding:** A1. **Size:** L.
- **Read first:** `bench/README.md`, `bench/agents/`, `bench/targets/`, `bench/baseline/`, `bench/results/`,
  `docs/en/agent-runs.md`, `docs/en/agent-tooling.md`.
- **Steps:**
  1. **Step 0, in writing:** what `bench/` already scores, how it is run, what it keeps. If it already holds a task
     set with success/calls/tokens/time, the task becomes "extend and schedule", not "build".
  2. A fixed set of twelve tasks over three project shapes (a brochure site; a site with a form and an action; a site
     with functions and visitors), each with a check a script runs and no judgement: add a page from a written brief;
     wire a form to an action; change a style across breakpoints; fix a seeded lint finding; add a function and call
     it from a flow; `space push` after a remote edit; rename a component's prop compatibly; add a flag and a rule;
     make a page pass `page check`; fix a failing space test; translate a page; remove an element and what only it
     used. Generic projects — no seed's name.
  3. Run it on a schedule with one model per tier, alone and as a team; keep per task: passed, tool calls, tokens,
     wall time, refusals met (by code). Results by commit in `bench/results/`.
  4. A report that names a change in success beyond the set's own noise (run the baseline five times to know it).
- **Do not:** use a model as the judge of success; let the set drift — a changed task is a new task.
- **Verify:** two scheduled runs on the same commit agree within the noise; a deliberately broken CLI command lowers
  the score and the report names it.

## T4.6 — What a refusal cost

- **Finding:** A1. **Size:** S. **After T4.1 has two weeks of results. Changes no code.**
- **Steps:** from T4.1's records: the ten refusals and lints agents met most, and for each whether the next call
  fixed it (the message was enough) or not. Those that were not go through `improving-the-cli.md`'s line — is it
  Plitzi's to change? — and become tasks only then. Deliver a list with counts.

## T4.9 — The run skills, on a diet

- **Findings:** A8, A9. **Size:** L. **After T4.1** (the score is the proof).
- **Read first:** `apps/cli/skills/plitzi-cli/reference/runs.md` (13 KB), `runs-lead.md` (19.5 KB — past the 3,500
  tokens a reference may hold), `runs-plan.md`, `runs-review.md`, `runs-designer.md`, `runs-scout.md`; how a role is
  handed its reading (`apps/cli/src/runs/agents/agentPrompt.ts`, `runs/plan/reading.ts`).
- **Steps:**
  1. For **every sentence** of those six files, classify it in a table: **enforced** (a refusal or an exit code makes
     it impossible to get wrong — name the refusal), **said in time** (a command prints it when it matters —
     `--dry-run`, `task next`, `run watch`, `task check` — name where), or **only here**.
  2. Sentences of the first two classes leave the skill; add a test that lists each removed rule beside the refusal
     or output that carries it, so it cannot be lost twice.
  3. What stays is ordered by how often runs met it (the reports' findings, `runs/findings/`), **one rule per line**,
     in plain imperative sentences — a bullet holds one command and one condition, not six and five.
  4. A glossary of the run's words opens `runs.md`: card, line, stage, copy, look, brake, hold, step — one line each.
  5. Never remove an example to fit (the maintainer's rule: quality before budget).
- **Verify:** `runs-lead.md` under 3,500 tokens; `apps/cli/src/runs/runs-lead.test.ts` and
  `runs/tasks/runs-reviewers.test.ts` green; T4.1's score as a team **no lower** than before, on two runs.
