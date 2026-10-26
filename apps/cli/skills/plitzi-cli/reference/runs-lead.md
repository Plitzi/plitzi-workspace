# Leading a team of agents: the lead's half of `plitzi run`

What the lead does; the agents' half, refusals and exit codes: [runs.md](runs.md) — read both. **Before anything
starts, plan it with the person**: [runs-plan.md](runs-plan.md) — the goal, their decisions, the summary before it opens. **Start**, when the person asked for a team:
`plitzi run start "<the ask>"`; the team starts by itself (below).

## The lead

0. **Inventory what the job asks, before a line of the plan.** Built after something — a site, a design, a brief —
   list every page, section and piece a visitor would miss (a logo, what moves, a control, a size) as the plan's `inventory`
   (`[{ id, piece, page }]`). Each is covered by a line a command proves, in the task that draws it (`{ said, check:
"page check … --expect …", covers: ["<id>"] }`), or waits with its reason (`"leftOut": "…"`): `run plan` refuses a
   piece that is neither. A copy names its site (`"reference"`): `plitzi run reference` keeps it for `--compare`, naming sections no piece covers. **Research is a spike, yours** (no files). **Start with the scope** (`run start` opens on it); find out (`page shot --compare <original> --dress`, `page measure`) and end it with the tasks, each with what you found (`"findings"`): `task spike s-scope --done "…" --tasks <stage.json>`. Later: stack one (`run extend`); an agent's `task spike` is a block you lift with the answer (`task unblock --answer`). **What waits is said to the person before opening**: their choice too. Prepare what every task reads first — the data complete with every
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
   not "no signal" for `options.startGraceMinutes` (3). A tester reviews code before you (yours if none took it in 2 min), adds `<id>-tests` (`"tests": false`: none); a designer reviews
   the others' UI before you (`options.designReview`; `false` turns it off). Yours is the complete,
   strict review — code, acceptance, edge cases, the page — and the final word (before the designer only saying why:
   `task review --skip-design lead|no-ui`, `lead` after your `task look`; a developer's `--review code` stands when no page draws
   what it changed). A designer's UI review, in its time, is not gone past (`--skip-design` is refused);
   a UI review held 8 min (15, a designer's first), or
   queued 5, is yours: decide it. Take a task back, or a ready one: `task reassign <task> --reason "…" --to <agent>|lead`. **One lead for every four agents**: `lead-2`… beside you, started when `run watch` says the reviews queue up; each reviews from the queue as you would (tell it how strict, `@lead-2`),
   answers the questions handed to it, and stops when none is left.

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
   `plitzi run watch` in the background ends when something needs you — a review, a question, a block, a
   file a task takes past 400 lines (ask for the split), the run standing still (what holds each task), a ready task held by another's claim (`held-ahead`: review that one
   first) — each said once. **Talk:** answer a question with `plitzi
task message t-home "…" --reply-to m3`; `all` or `@dev-1` in place of the task: every task in hand, or
   one agent. **The scope changes while it runs** — yours to see, or the person's to ask: edit
   the plan in the run's `inputs/` (`run open` says which; the run's own `plan.json` is what amend compares it to,
   never edited) and `plitzi run amend` — acceptance, priorities, findings, notes, the inventory, what a task nobody took waits for (`dependsOn`), one
   removed; more work is a stage, `plitzi
run extend <run> next.json`; say each to the person. **You manage it:** no agent idle while work could move — chase
   or decide a review that drags, settle a last cosmetic round yourself, amend away a dependency it does not need.
   **Nothing waits for you?** Help: `task reassign <ready task> --to lead`, then `task complete`.
6. **Review each task** as [runs-review.md](runs-review.md) says — read it whole: the review is the same for you, a
   co-lead and a tester.
7. **A change after approval** puts the finish into
   **reconciliation**: `plitzi run resolve <run> <file> --take …`, then `plitzi run resolve <run>` (no file) goes on.
   **The brake** stops a run whose completions keep failing; `run resume`. **Plitzi upgraded mid-run**
   (`version-mismatch`): the person runs `plitzi run attach <run>`. Upgrading on purpose is the person's (`plitzi run upgrade`): rebuild,
   then ask — never put a CLI in `node_modules` yourself.
8. **Before you close, look at the coverage:** the finish runs each covering check on the result; look at what a
   check cannot see (`plitzi run preview`) — what is missing is a stage (`run extend`), or the next run's: `run notice "…"
--on <where>` keeps it in the project's backlog (`.plitzi/backlog.json`), which `run plan` and `run open` list (`run
backlog add "…"` keeps one with no run open); a task of your plan that does one says so — `"closes": ["b-3"]` — and the
   applied run closes it; else `run backlog done <id> --note "…"`; `run report --plitzi` is what the run says of
   Plitzi so far. **Close it:** `plitzi run report` lists the problems
   by whose from the agents' round reports and the records (`--full`: each with its evidence and fix) — keep no list by hand; your summary adds what
   no record says, and what it was like for you: `plitzi run report --summary summary.md --ease <1-5> --hardest "…"`
   (it combines the agents'; refused while anything waits for you: settle each — a finding by what you did,
   `run settle <finding> --note "…"`); then `plitzi run finish` (the
   diff, checked). `--apply` is the person's, or yours if they allowed it — every server you started on the project stopped first, with `plitzi server stop` (one
   serves the project as it was and holds its `state/kv.json`). `run state`: what awaits it.

## Where leads went wrong

- **A check you write, you run once** on the run's work first: a 404 page is `page check … --status 404`, a guest
  sent to sign in `--redirects-to /sign-in`, a `page shot … --clip` names an id the page has. One that cannot pass costs every try
  of the task's: `run extend <run> <stage.json> --dry-run --lines` runs each line of a stage once and says what it is —
  what the task changes, a part it builds, or a line that cannot pass.
- **One look, one task**; its files are where its elements are built, and what reads what it changes (a fake's tests).
- **A question first**: it holds an agent — answer before your own work. `run watch` in the harness's background
  (never `&`), one at a time.
- **Say what is so, read from its source** (a copied site's CSS, `task show`, the run's approved version), never from a
  copy, a class name or memory; never answer one way and tell another — a file a task holds is no one else's.
- **A value is measured, never typed**: scoping, `plitzi page measure <path> <elements…> --width 390,1440` (`--hover`,
  `--click`: a state; `page outline <path>` names them; a copy's `"<el> => <sel>" … --compare <reference>`) each piece — whole, its box too, both widths, held by one
  acceptance line (`--same …`); "one class holds it" once grepped. A stage may be its `tasks` alone.
- **The scope, before it ends** — most rounds of a run are its: (1) each element measured whole — its box (height,
  padding), its pseudo-elements, a hover — at 390 and 1440, never only the property the ask names; (2) where a value
  is written, grepped, before a finding says "one class holds it" (a copy beside it is a round lost); (3) each line of
  the acceptance run once on the run's work as it is — it fails for the value, never for a selector that finds nothing
  (exit 0 already: it holds nothing, or say it guards); (4) a line for each width the ask covers.
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
- **A link's line follows it**: that the link is there proves nothing — a list of links can all go to the same page. Click it
  and say where it lands (`page check <path> --click <link>` prints the address; `page play … --steps "click <link>"`
  says `→ <path>`), and that page answers.
- **Your look covers every state the task names**: an approval read from the state at rest misses the one the task is
  about (keys that wrap only once a state is on). Each state — signed in, open, reminded, empty, at the
  phone width — is a `task look --click/--as` or a `page play` before you approve.
- **A control is used there and back, not pictured** — an arrow, a dot, a pager, a drawer: its acceptance line is a
  `page play <path> --steps "…" --read <el…> --width 390,1440` (a copy's beside its reference, `"ours => theirs"`,
  `--compare <reference> --same moved,shown,enabled`; `page measure --click` for an open state's values) — never a
  script of yours; a picture passes one that moves nothing, or otherwise than asked.
- **The board is a kanban; keeping the team busy is yours.** A card ready beside each one in review, so an agent whose
  card waits takes another: stack the backlog (`run extend`, tasks that `closes`), split a card by what changes apart,
  give the designer the UI reviews — `task review --changes … --skip-design lead` keeps the next look yours. `run watch` says
  an agent with nothing to take (`idle-team`) and how to feed it.
- **The designer's own task off the critical path** while it is the only one reviewing UI: what waits on it waits on
  every review too: a refactor with nothing to see is a developer's.
- **A line of yours found wrong is amended** (`plitzi run amend`), never left red — a done task's too: the finish holds
  it to the amended line. The plan you amend is any of the run's — the one it opened with, a stage's, or several joined:
  each changes only the tasks of the plans it holds.
- **Every problem of Plitzi, noted as it happens** — the CLI, the platform, a skill or doc that misled, a workaround a
  limit forced: `run notice --plitzi "…"`, one each with what it cost; never fixed mid-run. The run's `feedback.md` joins
  them to the agents' reports.
- **A round trimmed is said**: what it leaves goes to the backlog (`run notice`), not one more round.
- **The report before the finish**; `--apply` is the person's unless they allowed you.

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
