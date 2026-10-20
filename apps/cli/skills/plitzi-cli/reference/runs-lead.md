# Leading a team of agents: the lead's half of `plitzi run`

What the lead — team lead and software architect — does; the agents' half, the refusals and their exit codes are
[runs.md](runs.md), which every agent reads. The lead reads both.

## The lead

1. **Map the space:** `plitzi space overview` — who owns which file, read off the imports. A page owns the modules only
   it imports; what two pages import (the tokens, the classes, a layout, a component) is **shared**, and so is every
   entry (`src/space/index.ts`). `plitzi space impact <file>` — what depends on a file.
2. **Write the plan** (JSON, anywhere: the run removes it with itself when it ends unchanged):

   ```json
   { "version": 1, "runId": "es-launch", "goal": "Spanish version",
     "tasks": [{ "id": "t-home", "title": "Translate home", "files": ["src/space/pages/home/index.ts"], "role": "writer",
                 "dependsOn": [], "priority": "high", "estimateMinutes": 30,
                 "acceptance": ["Reads in Spanish",
                   { "said": "The hero is in Spanish", "check": "plitzi page check / --url $PLITZI_URL --expect hero-title~Bienvenidos" }] }],
     "notes": ["Dates are UTC: use lib/today.ts"], "primer": "primer.md" }
   ```

   **Acceptance a command can tell** is `{ said, check }`: the check runs in the task's copy at `complete`, beside the
   project's checks, and passes on exit 0 — `plitzi` in it is this CLI, `$PLITZI_URL` the copy served by its own start
   script on a free port. `page check --expect "<id>~<text>"` fails when that element does not show the text — check what a
   page shows, not a file's text (a grep pins where the code is). Else, text. **`notes`** hold for the whole run;
   `plitzi run note "…"` adds one. **`primer`** (beside the plan, ≤ 16 KB): what you learnt reading the project — every
   brief starts with it, and the few references its files need. **The team** is the project's,
   `.plitzi/team.json` (`plitzi run team set dev --roles developer --count 2 --model <model>`; the first run writes one
   the plan needs, with `team.json.example` beside it): its size is how many work at once, a role nobody takes is refused, and `run plan` says how to start each agent. A tester in it adds `<id>-tests` after each
   developer task (`"tests": false` for none); a designer reviews the others' UI before you (`"designReview": false` in
   the plan turns it off). Theirs is the UI/UX, as a designer; yours is the complete and strict review — code,
   acceptance, edge cases, the page — and the final word, after it (or before, with `--skip-design`).

   Ids: lowercase letters, digits, `-`, `_`. **Read what a task changes before you write it**: one asking for what is not
   there (a shadow to lighten, an id per row of a list) costs a round. What several tasks need is a task they depend
   on. A new page is a file that does not exist yet: where the space loads its pages by folder (`pagesIn`, a project with
   a server, `nav` for the menu) it touches nothing shared; otherwise it registers in the entry, one line each. A task that will change
   a file it does not hold says so (`"touches": ["src/space/tokens.ts"]`).
3. `plitzi run plan plan.json` — refused, every reason at once (a repeated file, a cycle, an unknown task, a
   path outside the source, a check it cannot run, another run going); otherwise expanded, shared files and overlaps
   listed, estimated. `plitzi run rehearse plan.json` plays it out with the team as `task next` would:
   who works what when, the critical path, your review queue (`--review 5m`), files changed at once, and the length for
   each number of agents. Nothing is opened.
4. **Ask the person first** who applies the run at the end — they, or you: then they open it in their terminal with
   `--lead-finishes` (or `plitzi run allow-finish` later). Never you.
   `plitzi run open plan.json` backs up every file it will touch; as many agents at once as the team has (above 5 a
   person confirms). `plitzi run preview` serves the run's work.
5. Start one agent per ready task (`plitzi task next --run es-launch --json`), each with a free port, and follow:
   `plitzi run watch --until lead` in the background ends when something needs you — a review, a question, a block, a
   file a task takes past 400 lines (ask for the split) — each said once; run it again after acting. **Talk:** answer a question (`run status` shows it) with `plitzi
   task message t-home "…" --reply-to m3`; `task message all "…"` tells every task in hand, `task message @dev-1 "…"`
   an agent by name, between tasks too. A mistake in the plan (a check that cannot pass): edit it and `plitzi run amend
   plan.json` — titles, acceptance, priorities, notes; each task changed is told. Its files and dependencies stay.
6. **Review:** `plitzi task show t-home` is all of it (acceptance, checks, agreements, what was said, diffs);
   `plitzi task look t-home /` serves its copy, page checks it and pictures it light and dark — one command. Then
   `plitzi task review t-home --approve`, or `--changes "doesn't fit at 390" --on hero-title`. Three rounds go to a
   person. A `--known-failure` says why and which task fixes it — weigh that.
7. **Someone changed a file while the agent worked on it** → the approval stops, naming it: `--approve --merge` when
   the changes go together line by line (the refusal says so), `--approve --overwrite` (its version wins, said, the
   other kept) or `--changes` (redo it on the project's version). A change after approval puts the finish into
   **reconciliation**: `plitzi run resolve <run> <file> --take project|run|merge|<file>`, then `plitzi run continue`.
   **The brake** stops a run whose completions keep being refused: `run status` says why; `plitzi run resume`.
8. **Close it:** write the summary (done, wrong, left): `plitzi run report --summary summary.md`; then `plitzi run
   finish` (the diff, checked). `--apply` is the person's, or yours if they allowed it. The next plan need not wait:
   `plitzi run extend <run> next.json` stacks it, one finish for both. `plitzi run pending` lists what awaits applying.
