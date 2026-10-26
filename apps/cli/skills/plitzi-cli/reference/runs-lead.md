# Leading a team of agents: the lead's half of `plitzi run`

What the lead does; the agents' half, refusals and exit codes: [runs.md](runs.md) — read both. **Before anything
starts, plan it with the person**: [runs-plan.md](runs-plan.md) — the goal, their decisions, the summary before it opens. **Start**, when the person asked for a team:
`plitzi run start "<the ask>"`; the team starts by itself (below).

## The lead

**You manage; the agents read.** Never started again, you read again every turn whatever you read once (a lead spent
68% of a run). The spikes are a scout's, the reviews a tester's, in fresh contexts: you decide what they bring.

0. **Inventory what the job asks, before a line of the plan.** Built after something — a site, a design, a brief —
   list every page, section and piece a visitor would miss (a logo, what moves, a control, a size) as the plan's `inventory`
   (`[{ id, piece, page }]`). Each is covered by a line a command proves, in the task that draws it (`{ said, check:
"page check … --expect …", covers: ["<id>"] }`), or waits with its reason (`"leftOut": "…"`): `run plan` refuses a
   piece that is neither. A copy names its site (`"reference"`): `plitzi run reference` keeps it for `page shot --compare`, naming sections no piece covers. **Research is a spike** (no files), a scout's; **you approve every spike's result**, and only you add or take out tasks. **The run opens on its scope** (`run start`): the scout proposes the tasks, each with its `"findings"`; `task next --role lead` hands them to you — decide them with the person: `task spike s-scope --approve | --changes "…"` (`run extend <stage> --dry-run` reads them). An agent's `task spike` is yours to answer: `task unblock --answer`. With no scout, the spikes are yours too: `task spike s-scope --done "…" --tasks <stage.json>`. **What waits is said to the person before opening**: their choice too. Prepare what every task reads first — the data complete with every
   field the reference uses, formatted — and nothing declared before a task uses it.
1. **Map the space:** `plitzi space overview [unit]` — who owns which file. A page owns the modules only it imports;
   what two pages import (tokens, classes, a layout, a component) is **shared**, as is every entry. `space impact
   <file>`: what depends on it.
2. **Write the plan** (JSON, best in the project's `tmp/`: the run removes it and its inputs, unless changed since):

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

   **Acceptance a command can tell** is `{ said, check }`: it runs in the task's copy at `complete`, passing on exit 0 —
   `plitzi` is this CLI, `$PLITZI_URL` the copy served. `page check --expect "<id>~<text>"` fails when no copy of that element (any row of a list) shows the text, `"!<id>"` when one is shown — check what a
   page shows, not a file's text. Else, text — and only text holds at your review alone:
   a later task can undo it unseen (`run plan` names a task with no check). A check runs again on the whole result at
   the finish. **`notes`** hold for the whole run;
   `plitzi run note "…"` adds one. **`primer`** (beside the plan, ≤ 16 KB; past 6k `run plan` says what it costs): what you
   learnt reading the project — every brief starts with it, and the references its files need. **The team** is the project's,
   `.plitzi/team.json` — grow it as the job asks (`plitzi run team set dev --count 3 --min 1 --model <m>`): its
   size is how many work at once; past `min`, on demand — `run watch` says when to start one (through its own CLI,
   after its first start). Agents start fresh after each task or review, never in one
   (`--session context|keep`); `--resume-session`: one that died mid-task resumes; one just started is
   not "no signal" for `options.startGraceMinutes` (3). A designer reviews the others' UI (`options.designReview`;
   `false` turns it off); a tester reviews every task — its QA, the approval — and brings `<id>-tests`, a developer's (`"tests":
   false`: none); more testers when reviews queue (`run team set test --count 2`). **Yours is what a tester escalates, past
   its review rounds** (blocked on you), or nobody else may take: `task review <task> --approve`, or `task unblock <task> --answer "…"`, which
   sends it back with your word. With no tester every review is yours ([runs-review.md](runs-review.md)). Take a task
   back: `task reassign <task> --reason "…" --to <agent>`.

   **Keep a person's actions a person's in the harness**: deny the agents `run finish --apply`, `run abort`, `run purge`,
   `run restore`, `run finish --lead-finishes`, `run stop --force`, `run attach --take-over`.

   **Quality** (`"quality": "light" | "standard" | "high"`): `run plan` sets it where you say none. Ids: lowercase letters, digits, `-`, `_`; **classes and provider ids by area** (`pronosticos-card`, `topBoxers`):
   two tasks that name one class differently meet only at the approval. **Foundations go to different agents**: the
   shell and the components as two tasks two agents take at once — else one agent works them in turn while every page
   waits. **A file other tasks import is their contract**: a task that changes what
   it exports (a component's params) changes it compatibly — a new param optional — or the plan says who follows it
   (`run plan` names each). **Read what a task changes before you write it**: asking for what is not there costs a
   round. **And what its data shows**: a case the project's
   data never reaches (a dog under two, an empty list, a failed answer) is seen by nobody. The plan says how it is seen: a row in the data, or a unit test of the module that decides it — in
   whose task. What several tasks need is a task they depend on. A new page is a file that does not exist yet: loaded
   by folder (`pagesIn`) it touches nothing shared; otherwise it registers in the entry. A task that will change
   a file it does not hold says so (`"touches": ["src/space/tokens.ts"]`).

3. `plitzi run plan plan.json` — refused, every reason at once; otherwise expanded, shared files and overlaps
   listed, estimated — and skills older than the CLI said (`plitzi upgrade skills --write`). `plitzi run rehearse plan.json` plays it out:
   who works what when, the critical path, your review queue.
4. **The summary first** ([runs-plan.md](runs-plan.md) § 5), who applies it among it — the person, or you if they open it
   `--lead-finishes` (or `plitzi run finish --lead-finishes` later); never you. `plitzi run open plan.json` backs up every file
   it touches and prints **your own CLI** (`scratch/lead/plitzi`, with your token): run every command after through it.
5. **The team starts by itself** (`options.launch`): start none yourself. With no launch: `plitzi run agent <name>
   --launch --harness <yours>` each. Follow:
   `plitzi run watch` in the background ends when something needs you — a proposal, a question, a block, an escalation, a
   file a task takes past 400 lines (ask for the split), the run standing still (what holds each task), a ready task held by another's claim (`held-ahead`: review that one
   first) — each said once. **Talk:** answer a question with `plitzi
task message t-home "…" --reply-to m3`; `all` or `@dev-1` in place of the task: every task in hand, or
   one agent. **The scope changes while it runs** — yours to see, or the person's to ask: edit
   the plan in the run's `inputs/` (`run open` says which; the run's own `plan.json` is what amend compares it to,
   never edited) and `plitzi run amend` — acceptance, priorities, findings, notes, the inventory, what a task nobody took waits for (`dependsOn`), one
   removed; more work is a stage, `plitzi
run extend <run> next.json`; say each to the person. **You manage it** (§ The run's time): no agent idle while work
   could move; chase a review that drags. Nothing waits for you? Wait.
6. **Decide what reaches you**, reading only that: an escalation's `task show`, a spike's proposal.
7. **A change after approval** puts the finish into
   **reconciliation**: `plitzi run resolve <run> <file> --take …`, then `plitzi run resolve <run>` (no file) goes on.
   **The brake** stops a run whose completions keep failing; `run resume`. **Plitzi upgraded mid-run**
   (`version-mismatch`): the person runs `plitzi run attach <run>`. Upgrading on purpose is the person's (`plitzi run upgrade`): rebuild,
   then ask — never put a CLI in `node_modules` yourself.
8. **Before you close, look at the whole once:** `plitzi run look` checks and pictures every page the run changed (1440
   and 390, light and dark); `run finish` asks for it after the last approval. What is missing is a stage (`run extend`), or the next run's: `run notice "…"
--on <where>` keeps it in the project's backlog (`.plitzi/backlog.json`), which `run plan` and `run open` list (`run
backlog add "…"` keeps one with no run open); a task of your plan that does one says so — `"closes": ["b-3"]` — and the
   applied run closes it; else `run backlog done <id> --note "…"`; `run report --plitzi` is what the run says of
   Plitzi so far. **Close it:** `plitzi run report` lists the problems
   by whose from the agents' round reports and the records (`--full`: each with its evidence and fix) — keep no list by hand; your summary adds what
   no record says, how it felt, where next starts: `plitzi run report --summary summary.md --ease <1-5> --hardest "…"`
   (it combines the agents'; refused while anything waits for you: settle each — a finding by what you did,
   `run settle <finding> --note "…"`); then `plitzi run finish` (the
   diff, checked). `--apply` is the person's, or yours if they allowed it — every server you started on the project stopped first, with `plitzi server stop` (one
   serves the project as it was and holds its `state/kv.json`). `run state`: what awaits it.

## The run's time is yours

- **A piece of work takes 10 minutes** (`run plan` says a task estimated past it: split it). Past it `run watch` wakes
  you: ask where it stands (`task message @<agent> --standing`) and decide at once — near done, on; else narrow it,
  split what is left into a task (`run extend`), or `task reassign`. A run's 60-minute task took 148, nobody cutting it.
- **A bug found inside a task is another task**, or `run notice`: never its scope growing round by round.
- **Specs, a task's own**: a line runs the specs of what it changes, never a whole suite (`run plan` says one) — a suite
  holds the machine, the CLI queues the next; the finish runs it whole, once.
- **The scope spike is the big one** (30 min); a later spike answers one question an agent met — 10 minutes, measured with
  the tools, never a suite. Its findings without its tasks: `task spike <s> --approve --findings-only`.
- **A known failure you accept is the agent's flag** — `task complete --known-failure "…" --fixed-by <task>` — never a
  message: its reviewer reads it in `task show`.
- **Every task approved: close now** (`run watch` says so) — look, report, finish.

## Where leads went wrong

- **A check you write, you run once** on the run's work first: a 404 page is `page check … --status 404`, a guest
  sent to sign in `--redirects-to /sign-in`, a `page shot … --clip` names an id the page has. One that cannot pass costs every try
  of the task's: `run extend <run> <stage.json> --dry-run --lines` runs each line of a stage once and says what it is —
  what the task changes, a part it builds, or a line that cannot pass.
- **One look, one task**; its files are where its elements are built, and what reads what it changes (a fake's tests).
- **A question first**: it holds an agent. `run watch` in the harness's background (never `&`), one at a time.
- **Say what is so, read from its source** (a copied site's CSS, `task show`, the run's approved version), never from a
  copy, a class name or memory; never answer one way and tell another — a file a task holds is no one else's.
- **A value is measured, never typed**: `plitzi page measure <path> <elements…> --width 390,1440` (`--hover`,
  `--click`; `page outline <path>` names them; a copy's `"<el> => <sel>" … --compare <reference>`), held by one line
  (`--same …`). A stage may be its `tasks` alone.
- **The scope, before it ends** — most rounds are its: each element measured whole (box, pseudo-elements, a hover)
  at 390 and 1440; a value grepped where it is written before a finding says "one class holds it"; each line run once
  on the run's work — failing for the value, never for a selector that finds nothing; a line per width.
- **The team the work is worth**: `run plan` says when it is too big — the base runs while the run is open; one on
  demand only when work waits — the run starts it; never prompts of your own.
- **Your files** — a stage, a summary — in your scratch (`tmp/plitzi-runs/<run>/scratch/lead/`), never the project's
  `tmp/`, where the agents are told of strays.
- **The page's own type is the page's**: `<page> => body` measures the body's font and background — a line on an
  element of the page makes a task invent a wrapper to carry it.
- **A piece the scope gives no number** is one the agents guess.
- **What two tasks share is the base task's, declared once**: a page's section styles and the space between sections,
  a format (a date), the whole palette — tasks adding tokens at once name one colour three ways.
- **What must hold at `complete` is an acceptance line** (`run amend`), never a message: a message has no hold on it.
- **A line reads what a cold start holds**: the copy's seeded data, a state set by its own steps (`page play --steps
"state …"`, `--clock`) — never what moves while it runs (the busiest room's track): `run finish` runs a failed line
  once more, and live data fails it twice. `plitzi server reset` puts a copy back to its cold start.
- **What a task builds on is in its `dependsOn`**, not only in its words: a finding naming another task's component is a
  dependency `run plan` cannot see.
- **A stage reads `run status`, not memory**: a task that merges a file one not done holds waits for it (`dependsOn`).
- **A line nothing can answer is yours at once**: its command exits 2 (an element not there — a copied site's too —
  nothing served), you are told, and every try of the task fails on it until you amend it — never the agent's to bend.
- **A command you hand an agent you ran**, as a line you write: one `--same` refused cost a round.
- **A link's line follows it** — present proves nothing: `page play … --steps "click <link>"` says `→ <path>`; that
  page answers.
- **Your look covers every state the task names** — signed in, open, empty, at 390: a `task look --click/--as` or a
  `page play` each before you approve; the state at rest misses the one the task is about.
- **A control is used there and back, not pictured** (an arrow, a pager, a drawer): its line is a `page play <path>
  --steps "…" --read <el…> --width 390,1440` (a copy's: `"ours => theirs" --compare <reference> --same
  moved,shown,enabled`) — never a script of yours.
- **The board is a kanban; keeping the team busy is yours**: a card ready beside each in review — stack the backlog
  (`run extend`, tasks that `closes`), split a card by what changes apart. `run watch` says an agent with nothing to
  take (`idle-team`).
- **The designer's own task off the critical path** while it is the only one reviewing UI: what waits on it waits on
  every review too: a refactor with nothing to see is a developer's.
- **A line of yours found wrong is amended** (`plitzi run amend`), never left red — a done task's too: the finish holds
  it to the amended line. The plan you amend is any of the run's — the one it opened with, a stage's, or several joined:
  each changes only the tasks of the plans it holds.
- **Every problem of Plitzi, noted as it happens** — the CLI, the platform, a skill or doc that misled, a workaround a
  limit forced: `run notice --plitzi "…"`, one each with what it cost; never fixed mid-run. The run's `feedback.md` joins
  them to the agents' reports.
- **A round trimmed is said**: what it leaves goes to the backlog (`run notice`), not one more round.

## When the run copies a site

Its plan names the site (`"reference"`); what the rules above say of it, and these besides.

- **A line names the copied site's counterpart**, and the finding says which element each id is (the button, not the row
  it sits in): an id the task builds otherwise bends its markup, or never passes. A line moved to
  another task once its elements exist is run on them first.
- **A copy is compared section by section**: each section's height at 390 against the original's, one `page measure`
  call, before you approve a page — a section laid out another way on a phone passes a review looked at 1440.
- **A line measures the design, never the data it shows**: a section's height only where its content is the
  original's — over example texts or other data it is passed only by tuning boxes (a margin to the sub-pixel, a
  min-height); measure its parts there (a gap, the order of its lines). A check asks what the original has: run it on the
  original too (what is empty there is empty here).
- **The scope follows every link** of the pages it keeps — a 404 here that answers there is a task — and measures each
  section's box at 1920 too, where a column the original centres stretches here.
