# Reviewing a task of a run

How a task in review is judged — at the tester's step of the review its card names (none named: the tester's alone), its
QA and its approval the task's; by the lead only when the team has no tester, what is escalated to it, or what nobody
else may take. One no tester may take (a tester's own) is a developer's that worked neither it nor what it tests. A task
of tests is reviewed as tests: of what was asked, both sides. A designer's step before yours is [runs-designer.md](runs-designer.md); what it saw
comes to you with the review (`passed`); the
lead's half is [runs-lead.md](runs-lead.md), the agents' [runs.md](runs.md).

- **Against the inventory, not only the picture:** every section and piece the task's acceptance names is there, as the
  reference has it — a difference you accept is one you say (`--note`); one a visitor would see is sent back. Judge the
  version that went to review, on a page several tasks build only its part.
- **Read it:** `plitzi task show t-home` is all of it, its diffs cut short (`--full`: as many whole as one answer holds;
  `<file> --diff`: one file's whole diff); `plitzi task look t-home
--before` serves its copy, checks and pictures its pages beside the run before (its options:
  [runs-designer.md](runs-designer.md)) — once: after the designer's, unchanged, it repeats it. Your read of a task in
  review takes your step, so no two testers decide one. What an acceptance proves is `plitzi task prove`, one way at a time. A fix — a test's, a bug's — is proved by its
  acceptance failing without it: `plitzi task prove t-home --before` runs each line on the run before it and on its copy, and says which
  proves the change and which passes on both (proves nothing). A task of tests holds what it tests when a change to
  that code fails it: `plitzi task prove t-home-tests --mutate src/functions/shows.ts --from "slice(0, 6)" --to
  "slice(0, 7)"` runs its acceptance on its copy and on that mutant, and says which line catches it — a behaviour held
  in two places takes both changed (`--mutate … --from … --to …` again); never a copy of `src/` changed by hand. A task that changes no page has no look: that is its review.
- **What the data does not show, you test:** a case the acceptance asks for that no page reaches — a module's function,
  its edge cases (the project's `test` script runs every `*.test.ts` at complete), `node -e` in the copy; a probe (two calls at once) is a `node --test` file in your scratch importing
  the copy's code by its absolute path, never a file in the copy, run with `plitzi task run "…"` — or send it back for
  the test it needs. A finding is read from its page,
  measured — never from another page or memory. A fix for light is looked at in light, one for the phone at 390
  (`task look --scheme light --width 390`).
- **A state the cold copy lacks** (an empty room someone made) is set up by the measure's own steps — `page measure
  /rooms room-card --steps "as dax: action room-create {…}"` (`--as` reads it as another) — never a script of yours.
  **What you change, you put back** before your verdict — `plitzi server reset` in the copy: the next step's reviewer
  reads the same copy (a designer closed a room, and the tester's claps were refused).
- **The verdict:** `plitzi task review t-home --approve`, or `--changes "doesn't fit at 390" --on hero-title`. A round
  sent back starts its review again from its first step. Past three rounds (any step's)
  it is the lead's: approve as it is, answer, or ask the person. **What you cannot decide** — what was asked reads two
  ways, a change past the task, a disagreement with its developer — is the lead's: `--escalate "…"` instead of a verdict. A `task complete --known-failure` says why and which task fixes it —
  weigh that. The approval merges what went to review, not the copy as it is. Two in review that read each other's
  files: `--approve --with <the other>` puts both in as one change.
- **Someone changed a file while the agent worked on it** → the approval stops, naming it: `--approve --merge` when the
  changes go together line by line (the refusal says so), `--approve --overwrite` (its version wins, said, the other
  kept) or `--changes` (redo it on the project's version).
- **Never your own:** a task you wrote is reviewed by another — a tester's by another tester or a developer. What the team
  told the lead of a task comes with its review (`✉`): a designer's finding on its code is yours to weigh.
