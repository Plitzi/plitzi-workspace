# Leading a team of agents: the lead's half of `plitzi run`

What the lead — team lead and software architect — does; the agents' half, the refusals and their exit codes are
[runs.md](runs.md), which every agent reads. The lead reads both.

## The lead

0. **Inventory what the job asks, before a line of the plan.** Built after something — a site to copy, a design, a
   brief — list every page and, on each, every section and every piece a visitor would miss: a hero's logo, a live
   video, an interactive tool (a tier list), a page linked from the footer, and the details: what moves, how a
   control behaves, a size — as the plan's `inventory`
   (`[{ id, piece, page }]`). Each is covered by a line a command proves, in the task that draws it (`{ said, check:
   "page check … --expect …", covers: ["<id>"] }`), or waits with its reason (`"leftOut": "…"`): `run plan` refuses a
   piece that is neither. A copy names its site (`"reference"`): `plitzi run reference` keeps it for `--compare`, naming sections no piece covers. **Research is a spike, yours** (no files). **Start with the scope**, `run open --spike "<ask>" --run <name>`; find out (`page shot --compare <original> --dress`) and end it with the tasks, each with what you found (`"findings"`): `task spike s-scope --done "…" --tasks <stage.json>`. Later: stack one (`run extend`); an agent's `task spike` is a block you lift with the answer (`task unblock --answer`). **What waits is said to the person before opening**: their choice too. Prepare what every task reads first — the data complete with every
   field the reference uses, formatted — and nothing declared before a task uses it.
1. **Map the space:** `plitzi space overview` — who owns which file, read off the imports. A page owns the modules only
   it imports; what two pages import (the tokens, the classes, a layout, a component) is **shared**, and so is every
   entry (`src/space/index.ts`). `plitzi space impact <file>` — what depends on a file.
2. **Write the plan** (JSON, best in the project's `tmp/`: the run removes it and its other inputs with itself, unless
   changed since):

   ```json
   {
     "version": 1,
     "runId": "es-launch",
     "goal": "Spanish version",
     "tasks": [
       {
         "id": "t-home",
         "title": "Translate home",
         "files": ["src/space/pages/home/index.ts"],
         "role": "writer",
         "dependsOn": [],
         "priority": "high",
         "estimateMinutes": 30,
         "acceptance": [
           "Reads in Spanish",
           {
             "said": "The hero is in Spanish",
             "check": "plitzi page check / --url $PLITZI_URL --expect hero-title~Bienvenidos"
           }
         ]
       }
     ],
     "notes": ["Dates are UTC: use lib/today.ts"],
     "primer": "primer.md"
   }
   ```

   **Acceptance a command can tell** is `{ said, check }`: the check runs in the task's copy at `complete`, beside the
   project's checks, and passes on exit 0 — `plitzi` in it is this CLI, `$PLITZI_URL` the copy served by its own start
   script on a free port. `page check --expect "<id>~<text>"` fails when that element does not show the text — check what a
   page shows, not a file's text. Else, text — and only text holds at your review alone:
   a later task can undo it unseen (`run plan` names a task with no check). A check runs again on the whole result at
   the finish. **`notes`** hold for the whole run;
   `plitzi run note "…"` adds one. **`primer`** (beside the plan, ≤ 16 KB): what you learnt reading the project — every
   brief starts with it, and the few references its files need. **The team** is the project's,
   `.plitzi/team.json` (by hand: `plitzi run team check`) — a developer and a designer to start, each role said inside; grow it when the job asks
   (`plitzi run team set dev --count 3 --min 1 --model <model>`, `… set test --roles tester`): its size is how many work at once — past `min`, on demand: `run watch` says when to start one, and it stops when idle — a role nobody takes is refused, and `run plan` says how to start each agent. A tester in it adds `<id>-tests` after each
   developer task (`"tests": false` for none); a designer reviews the others' UI before you (how closely: `options.designReview` there; `"designReview": false` in
   the plan turns it off). Theirs is the UI/UX; yours is the complete, strict review — code,
   acceptance, edge cases, the page (UI approved: the code first) — and the final word, after it (or before, saying why: `--skip-design lead|no-ui`,
   as yourself: no `--agent`, or `lead`). **One lead for every four agents**: a team of five or more has `lead-2`… beside you
   (`run team set lead --count N`) — **not at the start**: you review, each review from
   the queue (`plitzi task next --role lead --take`), and `run watch --until lead` says when the reviews queue up  and which to start. Each takes the next review no other lead took, reviews it as you
   would — tell them how strict you are (`@lead-2`) — and stops once the queue is empty. The rest
   is yours alone. A lead's own files go in `tmp/plitzi-runs/<run>/scratch/<name>/`, gone with the run.

   **Keep a person's actions a person's in the harness**: deny the agents — not you, unless the person said so — `plitzi run finish --apply`, `run abort`,
   `run purge`, `run restore`, `run allow-finish`, `run stop --force` and `run attach --take-over` (Claude Code:
   `permissions.deny` in `.claude/settings.json`).

   **Quality** (`"quality": "light" | "standard" | "high"`): `run plan` sets it where you say none (what many tasks build
   on `high`, a one-file few minutes `light`) and says which agent starts at which level. Ids: lowercase letters, digits, `-`, `_`; **classes and provider ids by area** (`pronosticos-card`, `topBoxers`):
   two tasks that name one class differently meet only at the approval. **Foundations go to different agents**: the
   shell and the components as two tasks two agents take at once — one role allowed to only one agent works them one
   after the other while every page waits. **A file other tasks import is their contract**: a task that changes what
   it exports (a component's params) changes it compatibly — a new param optional — or the plan says who follows it
   (`run plan` names each). **Read what a task changes before you write it**: asking for what is not there costs a
   round. **And what its data shows**: a case the project's
   data never reaches (a dog under two, an empty list, a failed answer) is seen by nobody. The plan says how it is seen: a row in the data, or a unit test of the module that decides it — in
   whose task. What several tasks need is a task they depend on. A new page is a file that does not exist yet: loaded
   by folder (`pagesIn`) it touches nothing shared; otherwise it registers in the entry. A task that will change
   a file it does not hold says so (`"touches": ["src/space/tokens.ts"]`).

3. `plitzi run plan plan.json` — refused, every reason at once; otherwise expanded, shared files and overlaps
   listed, estimated — and the skills said when they are older than the CLI (`plitzi upgrade skills --write` first). `plitzi run rehearse plan.json` plays it out with the team as `task next` would:
   who works what when, the critical path, your review queue (`--review 5m`), files changed at once, the length for
   each team size.
4. **Ask the person first** who applies the run at the end — they, or you: then they open it in their terminal with
   `--lead-finishes` (or `plitzi run allow-finish` later). Never you.
   `plitzi run open plan.json` backs up every file it will touch; as many agents at once as the team has (above 5 a
   person confirms). Tell the person how to watch it: `npm run start:preview` serves the approved work as it goes,
   its dev tools' Run tab saying who builds what; `plitzi run monitor` follows it live.
5. Start one agent per ready task (`plitzi task next --run es-launch --json`), each with a free port, and follow:
   `plitzi run watch --until lead` in the background ends when something needs you — a review, a question, a block, a
   file a task takes past 400 lines (ask for the split) — each said once. **Talk:** answer a question with `plitzi
task message t-home "…" --reply-to m3`; `task message all "…"` tells every task in hand, `task message @dev-1 "…"`
   an agent by name, between tasks too. **The scope changes while it runs** — yours to see, or the person's to ask: edit
   the plan in the run's folder (`inputs/plan.json`) and `plitzi run amend` — acceptance, priorities, notes, the
   inventory, what a task nobody took waits for (`dependsOn`), one removed; more work is a stage, `plitzi
   run extend <run> next.json`; say each to the person. **You manage it:** no agent idle while work could move — a task
   held behind one in review, or a review dragging while others have nothing, is said: chase or decide that review,
   settle a last cosmetic round yourself, or amend away a dependency it does not need.
6. **Review against the inventory, not only the picture:** every section and piece the task's acceptance names is
   there, as the reference has it — a difference you accept is one you say (`--note`); one a visitor would see is sent
   back. Judge the version that went to review (`task show` says its round), and on a page several tasks build, only
   this task's part. `plitzi task show t-home` is all of it (acceptance, checks, agreements, what was said, diffs; `<file>` after it, that file whole);
   `plitzi task look t-home [--click id | --hover id] [--element id]` (a part of a page others build: its part alone) serves its copy, page checks its pages (headings, names,
   contrast; the state asked for) and pictures them light and dark. What the acceptance asks and the data does not show, you test yourself
   (a module's function, its edge cases, `node -e` in the copy) — or send it back for the test it needs. Then
   `plitzi task review t-home --approve`, or `--changes "doesn't fit at 390" --on hero-title`. Three rounds of yours —
   or three of the designer's, counted apart — are yours: approve as it is, answer, or ask the person. A `--known-failure` says why and which task fixes it — weigh that. The approval merges what went to review,
   not the copy as it is: `look` and the approval warn of anything written in it since — ask why, or send it back.
   Two tasks that made one file: the second approval is refused — send it back.
7. **Someone changed a file while the agent worked on it** → the approval stops, naming it: `--approve --merge` when
   the changes go together line by line (the refusal says so), `--approve --overwrite` (its version wins, said, the
   other kept) or `--changes` (redo it on the project's version). A change after approval puts the finish into
   **reconciliation**: `plitzi run resolve <run> <file> --take project|run|merge|<file>`, then `plitzi run continue`.
   **The brake** stops a run whose completions keep failing; `run resume`. Agents
   iterate with `task check`, which it does not count. **Plitzi upgraded mid-run** (`version-mismatch`, said in `run
status`): ask the person to run `plitzi run attach <run>` — the agents keep their work and wait. To upgrade on
   purpose, the person runs `plitzi run upgrade` — never an install under the open run.
8. **Before you close, look at the coverage:** the finish runs each covering check on the result; look at what a
   check cannot see (`plitzi run preview`) — what is missing, or nobody's (`run notice`), is a stage (`run extend`). **Close it:** write the summary (done, wrong, left) last: `plitzi run report --summary summary.md`; then `plitzi run
finish` (the diff, checked). `--apply` is the person's, or yours if they allowed it. The next plan need not wait:
   `plitzi run extend <run> next.json` stacks it, one finish for both. `run pending`: what awaits applying.
