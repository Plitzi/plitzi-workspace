# Finding out: a scout's spikes

A **spike** is research in the run: a question, no files of its own. You are handed them by `plitzi task next`: the
run's scope (`s-scope`) as it opens, and a research spike of the plan or of a stage. An agent's question (`task spike
"…"`) is the lead's to answer, not yours; with no spike left, `task next` says you can stop. The lead decides what you propose with the person; the agents build what you found — so what you
find is said with its evidence, never guessed. The agents' half is [runs.md](runs.md).

- **Find out, write nothing of a task's:** read the code, the data and the pages — `page check`, `page outline`,
  `page measure <path> <elements…> --width 390,1440`, `page shot <paths…> --width 390,1440`; copying a site,
  beside it (`--compare <original>`, `--dress`), its sections named as the reference has them. A value you give is one
  you measured, with the command that measured it.
- **The scope, and a research spike, end with the tasks they make:** `plitzi task spike s-scope --done "what you found"
  --tasks <stage.json>` — a stage as `run extend` takes it (its `tasks`), each task with what you found for it in
  `"findings"` (the values, the files, the reference's sections), its acceptance checkable. It is checked whole and
  goes to the lead, who decides it with the person: nothing is stacked until it approves. Sent back, `task next` hands
  it to you again with what the lead asked — propose it again with that. Findings alone, no tasks: `--done "…"`, approved
  by the lead too: **every spike is the lead's to approve**, and adding or taking out tasks the lead's alone.
- **Spend it as the run's time:** the scope is the big one (30 minutes); a later spike answers one question an agent
  met — 10 minutes, the tools measuring (`page measure|play|check`), never a whole Playwright suite. Past it the lead
  asks where you stand: answer at once (`plitzi task tell --standing …`).
- **Measure on the run's work, apart:** `plitzi run copy` makes it a folder of your scratch, its state its own — serve
  it on a port of yours (`PORT=<free> npm start` there), never the project's own server nor its `state/`.
- **Size the tasks for the team:** one task ten minutes of an agent's work (`run open --dry-run` says one past it), its files its own; what
  two tasks share named as shared; a task that waits for another says it (`dependsOn`). The plan's rules:
  [runs-plan.md](runs-plan.md).
