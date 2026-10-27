# Finding out: a scout's research cards

A **research card** (a spike) is a card like any on the board: a question, no files of its own. `plitzi task next`
takes the next one for you, as any card — the run's scope (`s-scope`) as it opens, a research card of the plan or of a
stage — with its copy, where you run its commands. An agent's question is a block, the lead's to answer, not yours; with
none left, `task next` says you can stop. The lead decides what you propose with the person; the agents build what you found — so what you
find is said with its evidence, never guessed. The agents' half is [runs.md](runs.md).

- **Find out, write nothing of a task's:** read the code, the data and the pages — `page check`, `page outline`,
  `page measure <path> <elements…> --width 390,1440`, `page shot <paths…> --width 390,1440`; copying a site,
  beside it (`--compare <original>`, `--dress`), its sections named as the reference has them. A value you give is one
  you measured, with the command that measured it.
- **It ends with the tasks it makes:** `plitzi task complete --found "what you found" --tasks <stage.json>`, in its
  copy — a stage: a plan's `tasks`, each with what you found for it in `"findings"` (the values, the files, the
  reference's sections), its acceptance with a line a command proves (`{ said, check }`) — refused without. **See it
  first: `plitzi task check --tasks <stage.json>`** — checked as the lead stacks it, each line run once on the run's
  work; `run extend` is the lead's, never yours. It is checked whole and goes to the lead's
  review, decided with the person: nothing is stacked until it approves. Sent back, `task next` hands it to you again
  with what the lead asked — complete it again with that. Findings alone, no tasks: `--found "…"`, reviewed too:
  **every research card is the lead's to approve**, and adding or taking out tasks the lead's alone.
- **Spend it as the run's time:** the scope is the big one (30 minutes); a later card answers one question an agent
  met — 10 minutes, the tools measuring (`page measure|play|check`), never a whole Playwright suite. Past it the lead
  asks where you stand: answer at once (`plitzi task tell --standing …`).
- **Reproduce with the CLI, not a script:** what two people do on one page — one closes a room, the other comes back —
  is `plitzi page play <path> --as <account> --steps "as <other> action room-close {…}; goto <path>; shot after"`:
  each step read, pictured where you ask, the accounts signed in for you.
- **Measure on the run's work, apart:** `plitzi run preview --copy` makes it a folder of your scratch, its state its own — serve
  it on a port of yours (`PORT=<free> npm start` there), never the project's own server nor its `state/`.
- **Size the tasks for the team:** one task ten minutes of an agent's work (`run open --dry-run` says one past it), its files its own; what
  two tasks share named as shared; a task that waits for another says it (`dependsOn`). The plan's rules:
  [runs-plan.md](runs-plan.md).
