# Leading a team of agents: the lead's half of `plitzi run`

What the lead does; the agents' half, refusals and exit codes: [runs.md](runs.md) — read both. **Start**, when the
person asked for a team:
`plitzi run start "<the ask>"`; then `plitzi run agent <name> --launch` each agent.

## The lead

0. **Inventory what the job asks, before a line of the plan.** Built after something — a site, a design, a brief —
   list every page, section and piece a visitor would miss (a logo, what moves, a control, a size) as the plan's `inventory`
   (`[{ id, piece, page }]`). Each is covered by a line a command proves, in the task that draws it (`{ said, check:
"page check … --expect …", covers: ["<id>"] }`), or waits with its reason (`"leftOut": "…"`): `run plan` refuses a
   piece that is neither. A copy names its site (`"reference"`): `plitzi run reference` keeps it for `--compare`, naming sections no piece covers. **Research is a spike, yours** (no files). **Start with the scope** (`run start` opens on it); find out (`page shot --compare <original> --dress`, `page measure`) and end it with the tasks, each with what you found (`"findings"`): `task spike s-scope --done "…" --tasks <stage.json>`. Later: stack one (`run extend`); an agent's `task spike` is a block you lift with the answer (`task unblock --answer`). **What waits is said to the person before opening**: their choice too. Prepare what every task reads first — the data complete with every
   field the reference uses, formatted — and nothing declared before a task uses it.
1. **Map the space:** `plitzi space overview` — who owns which file. A page owns the modules only it imports; what two
   pages import (tokens, classes, a layout, a component) is **shared**, and so is every entry. `plitzi space impact <file>` — what depends on a file.
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

   **Acceptance a command can tell** is `{ said, check }`: it runs in the task's copy at `complete`, passing on exit 0 —
   `plitzi` is this CLI, `$PLITZI_URL` the copy served. `page check --expect "<id>~<text>"` fails when that element does not show the text — check what a
   page shows, not a file's text. Else, text — and only text holds at your review alone:
   a later task can undo it unseen (`run plan` names a task with no check). A check runs again on the whole result at
   the finish. **`notes`** hold for the whole run;
   `plitzi run note "…"` adds one. **`primer`** (beside the plan, ≤ 16 KB): what you learnt reading the project — every
   brief starts with it, and the few references its files need. **The team** is the project's,
   `.plitzi/team.json` — grow it when the job asks (`plitzi run team set dev --count 3 --min 1 --model <model>`): its
   size is how many work at once; past `min`, on demand — `run watch` says when to start one (by its token, after its
   first start). A tester adds `<id>-tests` after each developer task (`"tests": false` for none); a designer reviews
   the others' UI before you (`options.designReview`; `"designReview": false` turns it off). Yours is the complete,
   strict review — code, acceptance, edge cases, the page — and the final word (before the designer only saying why:
   `--skip-design lead|no-ui`; with `--changes`, `lead` keeps the next round's UI yours). A UI review held 8 min, or
   queued 5, is yours: decide it. Take a task back any time: `task reassign <task> --reason "…" --to <agent>|lead`. **One lead for every four agents**: `lead-2`… beside you, started when `run watch
--until lead` says the reviews queue up; each reviews from the queue as you would (tell it how strict, `@lead-2`) and
   answers the questions it is handed, and stops when nothing is left. A lead's own files go in `tmp/plitzi-runs/<run>/scratch/<name>/`, gone with the run.

   **Keep a person's actions a person's in the harness**: deny the agents `run finish --apply`, `run abort`, `run purge`,
   `run restore`, `run allow-finish`, `run stop --force`, `run attach --take-over`.

   **Quality** (`"quality": "light" | "standard" | "high"`): `run plan` sets it where you say none. Ids: lowercase letters, digits, `-`, `_`; **classes and provider ids by area** (`pronosticos-card`, `topBoxers`):
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
   listed, estimated — and the skills said when they are older than the CLI (`plitzi upgrade skills --write` first). `plitzi run rehearse plan.json` plays it out:
   who works what when, the critical path, your review queue.
4. **Ask the person first** who applies the run at the end — they, or you: then they open it in their terminal with
   `--lead-finishes` (or `plitzi run allow-finish` later). Never you.
   `plitzi run open plan.json` backs up every file it touches and prints **your token** (`scratch/lead/token`): pass it
   on every command after. Tell the person how to watch it: `plitzi run monitor`, and the approved work as it goes: `npm run start:preview`.
5. Start each agent: `plitzi run agent <name> --launch` (alone: its prompt, for a subagent), and follow:
   `plitzi run watch --until lead` in the background ends when something needs you — a review, a question, a block, a
   file a task takes past 400 lines (ask for the split) — each said once. **Talk:** answer a question with `plitzi
task message t-home "…" --reply-to m3`; `task message all "…"` tells every task in hand, `task message @dev-1 "…"`
   an agent by name, between tasks too. **The scope changes while it runs** — yours to see, or the person's to ask: edit
   the plan in the run's `inputs/` (`run open` says which; the run's own `plan.json` is what amend compares it to,
   never edited) and `plitzi run amend` — acceptance, priorities, findings, notes, the inventory, what a task nobody took waits for (`dependsOn`), one
   removed; more work is a stage, `plitzi
run extend <run> next.json`; say each to the person. **You manage it:** no agent idle while work could move — chase
   or decide a review that drags, settle a last cosmetic round yourself, amend away a dependency it does not need.
6. **Review against the inventory, not only the picture:** every section and piece the task's acceptance names is
   there, as the reference has it — a difference you accept is one you say (`--note`); one a visitor would see is sent
   back. Judge the version that went to review, on a page several tasks build only its part. `plitzi task show
t-home` is all of it (`<file> --diff`: one file's whole diff);
   `plitzi task look t-home --before` serves its copy, checks and pictures its pages beside the run before (its options:
   [runs-designer.md](runs-designer.md)) — once: after the designer's, unchanged, it repeats it; code is `task show`. What the acceptance asks and the data does not show, you test
   (a module's function, its edge cases, `node -e` in the copy) — or send it back for the test it needs. Then
   `plitzi task review t-home --approve`, or `--changes "doesn't fit at 390" --on hero-title`. Three rounds of yours —
   or three of the designer's — are yours: approve as it is, answer, or ask the person. A `--known-failure` says why and
   which task fixes it — weigh that. The approval merges what went to review, not the copy as it is.
7. **Someone changed a file while the agent worked on it** → the approval stops, naming it: `--approve --merge` when
   the changes go together line by line (the refusal says so), `--approve --overwrite` (its version wins, said, the
   other kept) or `--changes` (redo it on the project's version). A change after approval puts the finish into
   **reconciliation**: `plitzi run resolve <run> <file> --take …`, then `plitzi run continue`.
   **The brake** stops a run whose completions keep failing; `run resume`. **Plitzi upgraded mid-run**
   (`version-mismatch`): the person runs `plitzi run attach <run>`. Upgrading on purpose is the person's too (`plitzi run upgrade`): rebuild,
   then ask them — never put a CLI in `node_modules` yourself.
8. **Before you close, look at the coverage:** the finish runs each covering check on the result; look at what a
   check cannot see (`plitzi run preview`) — what is missing is a stage (`run extend`), or the next run's: `run notice "…"
--on <where>` keeps it in the project's backlog (`.plitzi/backlog.json`), which `run plan` and `run open` list (`run
backlog add "…"` keeps one with no run open); a task of your plan that does one says so — `"closes": ["b-3"]` — and the
applied run closes it; else `run backlog done <id> --note "…"`. **Close it:** write the summary (done, wrong, left) last, with each agent's tokens as the harness gave them:
   `plitzi run report --summary summary.md --tokens dev-1=208061,…`; then `plitzi run finish` (the diff, checked). Its
   report measures the run (flow, cost, calls repeated) against the runs before: `plitzi run bench`. `--apply` is the person's, or yours if they allowed it — every server you started on the project stopped first (one
   serves the project as it was and holds its `state/kv.json`). `run pending`: what awaits it.

## Where leads went wrong

- **A check you write, you run once** on the run's work first: a 404 page is `page check … --status 404`, a `--clip`
  names an id the page has. One that cannot pass costs every try of the task's.
- **One look, one task**; its files are where its elements are built.
- **A question first**: it holds an agent — answer before your own work. `run watch` in the harness's background
  (never `&`), one at a time.
- **Say what is so, read from its source** (the original's CSS, `task show`, the run's approved version), never from a
  copy, a class name or memory; never answer one way and tell another — a file a task holds is no one else's.
- **A value is measured, never typed**: scoping, `plitzi page measure <path> "<el> => <sel>" … --compare
<reference> --width 390,1440` (`--hover`, `--click`: a state; `page outline <path> --compare <reference>` names
  theirs) each piece — whole, its box too, both widths, held by one
  acceptance line (`--same …`); "one class holds it" once grepped. A stage may be its `tasks` alone.
- **The scope, before it ends** — most rounds of a run are its: (1) each element measured whole — its box (height,
  padding), its pseudo-elements, a hover — at 390 and 1440, never only the property the ask names; (2) where a value
  is written, grepped, before a finding says "one class holds it" (a copy beside it is a round lost); (3) each line of
  the acceptance run once on the run's work as it is — it fails for the value, never for a selector that finds nothing
  (exit 0 already: it holds nothing, or say it guards); (4) a line for each width the ask covers.
- **The team the work is worth**: `run plan` says when it is too big — start the agents it starts with, and one on
  demand only when `run watch` asks (it counts the work waiting). Started by `run agent`, never prompts of your own.
- **A round that asks for code alone** (a refactor, one source for a value): `--changes "…" --skip-design lead`, the
  next round's UI yours — never a designer's review offered, then decided past it.
- **Your files** — a stage, a summary — in your scratch (`tmp/plitzi-runs/<run>/scratch/lead/`), never the project's
  `tmp/`, where the agents are told of strays.
- **The page's own type is the page's**: `<page> => body` measures the body's font and background — a line on an
  element of the page makes a task invent a wrapper to carry it.
- **A line names the original's counterpart**, and the finding says which element each id is (the button, not the row
  it sits in): an id the task builds otherwise bends its markup, or never passes. A line moved to
  another task once its elements exist is run on them first.
- **A finding is read from its page**, measured — never from another page or memory; a piece the scope gives no number
  is one the agents guess.
- **What two tasks share is the base task's, declared once**: a page's section styles and the space between sections,
  a format (a date), the whole palette — tasks adding tokens at once name one colour three ways.
- **A copy is compared section by section**: each section's height at 390 against the original's, one `page measure`
  call, before you approve a page — a section laid out another way on a phone passes a review looked at 1440.
- **What must hold at `complete` is an acceptance line** (`run amend`), never a message: a message has no hold on it.
- **What a task builds on is in its `dependsOn`**, not only in its words: a finding naming another task's component is a
  dependency `run plan` cannot see.
- **A stage reads `run view`, not memory**: a task that merges a file one not done holds waits for it (`dependsOn`).
- **A line nothing can answer is yours at once**: its command exits 2 (the original's element not there, nothing
  served), you are told, and every try of the task fails on it until you amend it — never the agent's to bend.
- **A line measures the design, never the data it shows**: a section's height only where its content is the
  original's — over example texts or other data it is passed only by tuning boxes (a margin to the sub-pixel, a
  min-height); measure its parts there (a gap, the order of its lines). A check asks what the original has: run it on the
  original too (what is empty there is empty here).
- **The scope follows every link** of the pages it keeps — a 404 here that answers there is a task — and measures each
  section's box at 1920 too, where a column the original centres stretches here.
- **A command you hand an agent you ran**, as a line you write: one `--same` refused cost a round.
- **A control is used there and back, not pictured** — an arrow, a dot, a pager, a drawer: `page shot <path> --compare
  <url> --click "ours => theirs"` at both widths (`page measure --click` for its open state's values), and a task that
  adds one says so in its acceptance; a picture passes one that moves nothing, or otherwise than the original's.
- **The board is a kanban; keeping the team busy is yours.** A card ready beside each one in review, so an agent whose
  card waits takes another: stack the backlog (`run extend`, tasks that `closes`), split a card by what changes apart,
  give the designer the UI reviews — `--changes` with `--skip-design lead` keeps the next look yours. `run watch` says
  an agent with nothing to take (`idle-team`) and how to feed it.
- **The designer's own task off the critical path** while it is the only one reviewing UI: what waits on it waits on
  every review too.
- **A line of yours found wrong is amended** (`plitzi run amend`), never left red.
- **Don't fix Plitzi mid-run**: note it (`run notice --plitzi "…"`) — the run's feedback to Plitzi, written as it ends
  (`.plitzi/feedback/<run>.md`, or `run feedback` before), carries it with what the CLI saw; the person shares it.
- **Look where it changed**: a fix for light in light, one for the phone at 390 (`task look --scheme light --width 390`).
- **A round trimmed is said**: what it leaves goes to the backlog (`run notice`), never into one more round.
- **The report before the finish**; `--apply` is the person's unless they allowed you — never on your own.
