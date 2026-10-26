# Reviewing a task of a run

How a task in review is judged — by a tester, its QA and its approval the task's; by the lead only when the team has
no tester, what is escalated to it, or what nobody else may take. One no tester may take (a tester's own) is a developer's
that worked neither it nor what it tests. A task of tests is reviewed as tests: of what was asked, both sides. A designer's look at the UI first is [runs-designer.md](runs-designer.md); the
lead's half is [runs-lead.md](runs-lead.md), the agents' [runs.md](runs.md).

- **Against the inventory, not only the picture:** every section and piece the task's acceptance names is there, as the
  reference has it — a difference you accept is one you say (`--note`); one a visitor would see is sent back. Judge the
  version that went to review, on a page several tasks build only its part.
- **Read it:** `plitzi task show t-home` is all of it, its diffs cut short (`--full`: as many whole as one answer holds;
  `<file> --diff`: one file's whole diff); `plitzi task look t-home
--before` serves its copy, checks and pictures its pages beside the run before (its options:
  [runs-designer.md](runs-designer.md)) — once: after the designer's, unchanged, it repeats it. Your read of a task in
  review takes its review, so no two testers decide one.
- **What the data does not show, you test:** a case the acceptance asks for that no page reaches — a module's function,
  its edge cases (the project's `test` script runs every `*.test.ts` at complete), `node -e` in the copy; a probe (two calls at once) is a `node --test` file in your scratch importing
  the copy's code by its absolute path, never a file in the copy — or send it back for the test it needs. A finding is read from its page,
  measured — never from another page or memory. A fix for light is looked at in light, one for the phone at 390
  (`task look --scheme light --width 390`).
- **The verdict:** `plitzi task review t-home --approve`, or `--changes "doesn't fit at 390" --on hero-title`. A round
  that asks for code alone (a refactor, one source for a value) is `--changes "…" --skip-design reviewer`: the next round's UI
  is yours, never a designer's review offered, then decided past it. Past three rounds (yours or the designer's)
  it is the lead's: approve as it is, answer, or ask the person. **What you cannot decide** — what was asked reads two
  ways, a change past the task, a disagreement with its developer — is the lead's: `--escalate "…"` instead of a verdict. A `task complete --known-failure` says why and which task fixes it —
  weigh that. The approval merges what went to review, not the copy as it is. Two in review that read each other's
  files: `--approve --with <the other>` puts both in as one change.
- **Someone changed a file while the agent worked on it** → the approval stops, naming it: `--approve --merge` when the
  changes go together line by line (the refusal says so), `--approve --overwrite` (its version wins, said, the other
  kept) or `--changes` (redo it on the project's version).
- **Never your own:** a task you wrote is reviewed by another — a tester's by another tester or a developer. What the team
  told the lead of a task comes with its review (`✉`): a designer's finding on its code is yours to weigh.
