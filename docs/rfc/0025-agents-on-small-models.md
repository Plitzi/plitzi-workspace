# RFC 0025 — Agents on small models: fewer tokens, the same result

- **Status:** Accepted — phases 1 to 7 done; the benchmark built, its first run pending (§8)
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-07
- **Scope:** the MCP (`apps/mcp`: its tools, the primer, `look`), the CLI (`apps/cli`: `where`, `edit`, every
  command's output), `sdk-authoring` (where an element was written, the edits a fix makes, its published types), the
  skills (`packages/sdk-authoring/skills`, `apps/cli/skills`) and a new agent benchmark

---

## 1. Summary

Plitzi is built to be worked on by agents. Today it is tuned, without saying so, for the largest models: an agent
connecting to the MCP is handed ~69k tokens before it does anything, writes a 14k-token schema's JSON by hand, and a
coding agent finds an element by reading files. A large model copes. A model a tenth of its size, with a 32k window and
less reasoning, does not — and those are the models that make an agent cheap enough to run all day, or to run locally.

**The smaller the better** — a smaller model and a smaller context always save resources and tokens — **down to the
point where the agent starts to regress, hallucinate or degrade, and no further.** That point is not chosen; it is
measured (§5.4), and it moves: every tool that takes reasoning off the model lets a smaller one do the same work.

So this RFC does two things. It moves the work from the model into the tools — a fixed budget for what a session
loads, tools that take an intention rather than a document, closed vocabularies, refusals that carry the corrected
call, outputs that end with the next step, writes that verify themselves, and edits the CLI makes where the code is,
found where it is NOW, whoever moved it. And it builds the benchmark that finds the floor: the smallest model, with the
smallest context, whose results are as good as the largest's.

**Nothing ships on belief.** Every change is held to that benchmark: it enters if no model at or above the floor does
worse and some model pays less. The low-level surface stays, so a capable model loses nothing.

## 2. Two scenarios

| | Cloud space, through the MCP | Local project, through the CLI |
| --- | --- | --- |
| What the agent changes | The space's documents, as JSON operations | TypeScript in `src/` that authors the space — and code beside it |
| Where the cost is | The protocol: what connecting loads, the operations it writes, what it reads back | Reading: the project's files, the package's types, references |
| What moves under it | Other people's edits in the builder | People move code: a component to another file, a page split in two |

The second column's last row is a constraint on every design below: **nothing may depend on where code was**. No map
of locations in `AGENTS.md` or a skill, no index written at one moment and read at another. A location is computed when
it is asked for.

## 3. What it costs today

Measured on 2026-10-07 (≈ characters / 4):

| What | Cost | When it is paid |
| --- | --- | --- |
| MCP `tools/list` | ~69k | Every connection. `plitzi_apply`, `plitzi_validate`, `plitzi_render`, `plitzi_preview` and `plitzi_screenshot` each carry the whole operations schema (~11–15k) |
| MCP primer | ≤ 24,000 characters of the space (`SPACE_BUDGET`) plus constants; `types` alone ~18 KB and the same for every space | When the agent reads `plitzi://primer` |
| `@plitzi/sdk-authoring` types | ~182k, in two bundled `.d.ts` | Whenever an agent looks a signature up |
| A real project's `src/` (Inkwell) | ~97k | Read file by file to find what to edit |
| Authoring references | 45k in 25 files (`authoring-errors.md` alone 8.6k) | On demand |
| `SKILL.md` + `CHEATSHEET.md` | ~4k + ~2.4k per skill | When the skill is used |
| A screenshot at 1440×900 | ~1.7k per image | Every `plitzi_screenshot` / `plitzi shot` |
| `plitzi check`, `lint`, `explain`, `npm run author` | 10–250 | Per call — already right |
| `plitzi doctor` | ~1k on Inkwell | Mostly one repeated line per locally installed package |

The CLI's outputs are not the problem; what an agent has to load and read to use them is.

## 4. Principles

1. **A fixed start budget.** What a session loads before its first action — the MCP's tool list, a skill's core — has
   a ceiling, held by a test like the skills' budgets (`apps/cli/src/scaffold/skills.test.ts`). Proposed: 6k tokens
   for the MCP's tools, 1.5k for a skill's core.
2. **The tool does the reasoning a rule can do.** A small model chooses well among few, clear options and composes
   badly. So the common work is a tool with few parameters and closed values; composition is for the cases a tool
   cannot foresee.
3. **Two levels, the low one on demand.** Intention tools for everyone; the operations of today still there, their
   schema asked for one operation at a time.
4. **A refusal is a call to make.** Every refusal carries the corrected call, ready to send again — not only prose. A
   small model copies well.
5. **Accept the unambiguous, and say so.** `'Heading'` for `'heading'`, `16` where `'16px'` is meant: normalised, with a
   warning naming what was read and how. Authoring is never silent — it corrects aloud. What has two readings is still
   refused.
6. **Every output is bounded, and ends with the next step.** A ceiling per output with a cursor for the rest
   (`more: …`), so no answer overflows a 32k window; and the command that comes next, so a small model follows a path
   instead of planning one.
7. **Text first.** Many small models do not see images. `plitzi check` and the MCP's check answer in text that is
   enough on its own; a screenshot is an extra.
8. **Computed when asked.** Where an element is written, what a page holds, what a type is — read from the code and the
   documents at that moment.
9. **Closed vocabularies, so there is nothing to invent.** Where a value is one of a known set — an element type, a
   slot, a state, a step, a class the space has — the tool says so (an enum, or a list it answers with) and refuses
   anything else naming the nearest. A model that is never asked to recall a name cannot hallucinate one.
10. **A write proves itself.** Every tool that changes the space answers with the check of what it changed — refused
    references, an element that does not render, a binding that reads nothing — so an agent cannot report a success
    the page does not show. "Done" is the check being clean, not the agent saying so.
11. **Less context is not less correct.** What a small context leaves out must be one call away and named where it was
    left out (as the primer's elided sections are today) — never simply absent, which is what makes a model guess.
12. **A mistake costs one round trip at most — better, none.** Catching a wrong call is not enough: an agent that is
    caught often still pays for every attempt. So mistakes are prevented where they can be, absorbed where they are
    unambiguous, fixed in one retry where they are not, and a loop is broken by the tool rather than left to the model
    (§5.5).
13. **One reading, everywhere.** A small model that weighs two ways to do one thing spends turns on the choice, or
    makes the wrong one. So each job has one tool (seeing a saved page is `plitzi_look`, not a choice between three);
    a name says its verb and its object (`plitzi_set_classes`, not `plitzi_class`); a parameter never changes meaning
    by default (classes are added or removed, never a list that silently replaces what was there); and an input that
    could mean two things is answered as one *and says the other* (`plitzi where cta` reads an id, and says the words
    that also matched, with the command for them), or is read one way when asked (`--by`). What is corrected is
    corrected only where one reading exists — two types told apart by their capitals alone are not guessed between.

## 5. The design

### 5.1 The MCP (cloud spaces)

**The operations schema once — done (phase 1).** `plitzi_apply` carries the full union (`carriesOperations`);
`plitzi_render` lists its operations' types only (`compactInputShape`) wherever apply is listed beside it, and keeps the
whole schema on a guest connection, where it is alone. `plitzi_validate` is gone, with the `validate` function behind it:
it is `apply`'s `dryRun`. `plitzi_look` is the one way to see a saved page (outline by default, HTML or image); the
two tools it replaced, `plitzi_preview` and `plitzi_screenshot`, are gone. `plitzi_describe_operation { type }` answers one operation's schema (~800 tokens), or the closed list of
types — with the nearest one when the name does not exist. Measured: a connection with a space lists ~18k tokens,
from ~69k; `e2e/connector.test.ts` holds it to 71.6 KB.

**Written once, without proposals.** The proposal ids first designed here needed the operations kept on the server
between calls — a store shared by every MCP worker — to save the agent re-sending them to the preview and the
screenshot. `look` on the same `dryRun` does it with no state: `plitzi_apply { dryRun, look: 'html' | 'image' |
'accessibility' | 'both', pageRef, viewport }` checks the batch, applies it in memory and renders the page as it would
leave it, in one call (`tools/shared/look.ts`, the one path the three tools render through). The operations are written
twice at most — to look, and to save — instead of four times.

**Intention tools.** A small set, decided from what the benchmark's agents actually spend their turns on — the
candidates: add a page (from a layout, with a list from a data source), set an element's text or attribute, give an
element a class or a variant, add a section from a component, bind a list to a source. Each validates like `apply`,
answers with what it changed in a few lines, and ends with the next step.

**The primer.** `types` (~18 KB, the same for every space) leaves the primer for its own resource; the primer keeps a
line saying where it is. `plitzi_read` and `plitzi_search` take the fields wanted (`fields: ['content', 'style']`), so
reading an element does not return all of it.

**Screenshots.** `element` (crop to one element, ~200 tokens) and `scale`; the guide says to look at the text check
first.

### 5.2 The CLI (local projects)

**`plitzi where <id | class | text>`.** Answers `file:line` and the few lines of the call that wrote the element. It
runs authoring and reads `writtenAt` — the call site every factory records (`sdk-authoring/src/schema/writtenAt.ts`),
what `plitzi fix` already edits at — so it follows the code wherever a person moved it, with nothing to keep in step.
Authoring records it only outside production; `where` runs it that way. A project that does not author (broken code)
falls back to finding the id in `src/`, said as such.

**`plitzi edit <id> --set <attribute>=<value> | --class <name> | --remove`.** The CLI makes the edit at the call site,
as `plitzi fix` does (`planFixes`, `specEditOf`), then authors and prints what changed and the next step. A small model
changes text, a class or an attribute without writing TypeScript; what is not a simple edit gets `where`'s snippet to
edit by hand. A helper written once and called per element is the one place an edit could reach more than it names:
a value the helper is handed is changed where it is handed, and a call that writes several elements is changed only
with `--every`, `where` naming them — never silently.

**Outputs.** Every command's text output gets a ceiling and a cursor; `plitzi doctor` groups lines that differ only
by package; each command ends with the next one when there is one. `--json` stays the stable contract for a program;
the skills recommend the text to an agent that is going to read it, since it is the shorter.

**Types by module.** `sdk-authoring` publishes its declarations per entry and module, or `plitzi explain api <name>`
answers one signature with its doc (~150 tokens). Which of the two is the open question in §8; either takes a 182k
search down to a few hundred.

### 5.3 Skills in layers

- **A core of ≤1.5k tokens** per skill: which command or tool for which task — a routing table — and the five rules
  that go wrong most. Nothing else.
- **References in pieces of ≤1k**, one question each, named so the core can route to exactly one.
- **Recipes as templates** to copy, each a whole, tested file (as today, `recipes.test.ts`).
- **Codes through `plitzi explain <code>`**, never the full table.
- **No locations.** A skill says how to find where something is (`where`), never where it is.

The budgets in `skills.test.ts` change to these.

### 5.4 The benchmark, and the floor it finds

The gate every change above passes, the first thing built, and what says how small is small enough.

**Tasks.** 6 to 8, half through the MCP on a cloud space and half through the CLI on a local project — one of them on a
project whose code a person moved first. Each with objective success: `plitzi check` clean, and assertions on the result
(the list reads `data/products.json`; the heading says the words asked for).

**Two axes, swept together.** The floor is a model AND a context:

- **A ladder of models**, from the largest available down through Haiku 4.5 to small open models (~8B, ~3B) — as many
  rungs as there are models worth running, so the curve shows where it bends rather than three points guessing at it.
- **Levels of context** for each: the start budget alone; plus the routed reference; plus the full skill. A smaller
  context saves tokens until the model starts guessing what it was not shown — that is part of the same curve.

**Runs.** 5 or more per task, model and context level; agents are not deterministic, and one run cannot tell a
regression from noise. The spread across runs is reported beside every rate, and a difference inside it is no
difference.

**What is measured — degradation in three kinds, each its own number:**

| Kind | What counts | How it is caught |
| --- | --- | --- |
| **Failure** | The task's assertions do not hold, or the check is not clean | The task's own assertions, `plitzi check` |
| **Hallucination** | A name that does not exist: an element type, a slot, a field, an operation, a CLI flag, an API, a file path — and a claim of success the check contradicts | The refusals that name it (`unknown-element-type`, `element-slot-unknown`, `global-field-unknown`, an unknown operation or option), a path that does not exist, the agent's final answer against the check |
| **Degradation** | Success reached the long way: more turns, more refusals met, more retries, more tokens | Turns, refusals and tokens per task |

**Waste, on its own line.** Beside the three kinds: the tokens a run spent on calls that were refused and on the
retries that followed, as a share of the run. A model can succeed and hallucinate rarely and still pay a third of its
tokens correcting itself; that share is what makes a small model expensive, and it is reported per task.

**A ceiling per run.** Each task has one: proposed, three times the largest model's median tokens on it. A run that
reaches it is stopped and counted as a **failure** — a loop is not a slow success, and without the ceiling one looping
run would hide inside an average.

**The number that decides: cost per verified success** — the tokens of every run divided by the runs whose result
the check and the assertions confirm. A cheap model that fails or loops costs more per success than a dearer one that
does not; this is what keeps "smaller" from winning by failing cheaply.

**The floor** is the smallest model and context where, against the largest model on the same tasks:

- the success rate is within the noise (proposed: no more than 5 points below);
- the hallucination rate is no higher (proposed: no more than 1 point above);
- the waste is bounded (proposed: no more than 15% of a run's tokens on average, and no task above 30%);
- every task still succeeds at least sometimes — a task one size can never do marks that size as below the floor,
  whatever its average.

Among the configurations that pass, the one with the lowest cost per verified success is the recommendation: the
model the skills and the docs suggest, and the context the start budget is set to. Below the floor, the benchmark says
which task broke and how — which is the list of what the next tool should take off the model.

**The floor moves.** It is measured again when the tools change (a phase of §6 lands) and when the models do. Each
phase is judged by how far it lowers the floor as well as by what it saves above it.

**Entry rule.** A change enters when no configuration at or above the floor does worse on any of the three kinds, and
some configuration's cost per verified success goes down. One change at a time, against the baseline the previous one
left.

**It runs seldom.** A run costs tokens of its own — many of them — so it is run at milestones (a baseline, after the
phases that change what a model has to do: 4 and 5, and before the start budget's numbers are fixed), not per change.
Between runs, every change is held to what costs nothing to measure and is deterministic: the size of what a
connection lists and a skill loads, each command's output on a fixture project, the refusals' shape — tests, like the
listing budget in `e2e/connector.test.ts`. A change that grows any of them says why. It measures agents, which Plitzi's
product never runs — RFC 0022's "Plitzi runs no model" is about the product, not its tests.

### 5.5 Mistakes that cost little

Detecting a hallucination does not refund it. In order of preference:

1. **Prevented.** A value from a known set is an enum in the tool's schema, so a harness that constrains its output
   cannot write anything else, and one that does not still sees the list. `describe_operation` and every intention tool
   answer with an example to copy, not only a schema to satisfy.
2. **Absorbed.** What has one reading is corrected and said (principle 5): no round trip at all.
3. **Fixed in one retry.** A refusal lists every problem at once, never the first — each with the corrected call — so
   one retry settles all of them, and the retry is the same call with the operations corrected — never a new kind of
   call to learn.
4. **A loop broken by the tool.** The same refusal a second time in a session (the MCP's session; the CLI's short log
   under the project's `tmp/`, never committed) changes the answer: it stops repeating the rule and gives the whole
   working example, names the intention tool that does this, or says to stop and ask the person. A third identical call
   is refused without being looked at again. The model is not trusted to notice it is going round in circles.

The benchmark's waste line (§5.4) is how each of these is judged.

## 6. Phases

0. **The benchmark — built, not yet run:** `yarn agents` in `bench/` (its README says how). Claude Code and OpenCode as
   the harnesses, six tasks (three MCP, three CLI, one on moved code) checked on the result, the three kinds of
   degradation, net tokens beyond each harness's own floor, the ceiling and the floor of §5.4. Its first run is the
   baseline the phases below are judged against, and it settles §8's open questions.
1. **The MCP's start budget — done:** the schema once, `describe_operation`, `validate` into `dryRun`, `look`.
2. **`plitzi where` and `plitzi edit` — done:** `locateElements` in authoring; `edit` writes attributes and checks the
   space in a fresh process.
3. **Outputs, verified writes and cheap mistakes — done:** ceilings and cursors, next steps, `doctor` grouped; every write
   answers with the check of what it changed; every problem at once with its corrected call; the loop breaker.
4. **Skills in layers — done:** each `SKILL.md` a core held to 1,500 tokens (authoring ~920, CLI ~820, render ~1,050),
   the rest in references the core routes to. References stay at their 3,000-token budget, one subject each; splitting
   them finer waits for the benchmark to say a smaller piece is read better.
5. **Intention tools and closed vocabularies — done:** on the MCP `plitzi_set_attributes`, `plitzi_set_classes` (add and
   remove), `plitzi_bind_attribute`, `plitzi_place_component`, `plitzi_add_page` (the §5.1 candidates); on the CLI `plitzi edit`, which writes literals — a class in
   code is a variable, so dressing an element there stays the agent's, at the call `where` shows. A class an element
   wears is held to the ones the space has. The catalogue grows or shrinks by what the benchmark's models fail at.
6. **Accepting the unambiguous**, with warnings — done: an element type's capitals; the preview renders through
   `draftBatch`.
7. **Types, one name at a time — done:** `plitzi explain <name>` answers any export of `@plitzi/sdk-authoring` from the
   `.d.ts` the project installed (38–230 tokens). The published declarations stay one bundle: splitting them would
   change the package's entries for what one command already answers.

Phases 1 and 2 are the largest savings with the smallest risk; 4 and 5 are where a small model gains most, and where a
regression is most likely — which is why they come after the benchmark has a history. After each phase the floor is
   measured again; how far it moved is part of the phase's result.

## 7. Decisions so far

- Two scenarios, designed apart: the MCP for cloud spaces, the CLI where there is code.
- People move code: locations are computed when asked, never written down.
- The smaller the model and the context, the better — down to the floor where results regress, hallucinate or
  degrade, and no further. The floor is measured, not chosen, and moves as the tools improve.
- Degradation is three numbers — failure, hallucination, the long way round — and the deciding one is cost per
  verified success.
- The low-level surface stays; intention tools are added beside it, so a larger model never does worse.
- No change enters without the benchmark saying it costs less for the same result.

## 8. Open questions

- **The ladder's rungs.** Which open models run (and on what hardware) beside the hosted ones, so the curve has enough
  points below Haiku 4.5 to show where it bends.
- **The tolerances.** 5 points of success and 1 of hallucination are proposals; the first baseline's spread says
  whether they are inside the noise.
- **The harness.** What runs the benchmark's agents against the MCP and the CLI, and with what budget per run.
- **The intention tools' catalogue.** Proposed in §5.1, settled by the benchmark's failures rather than in advance.
- **Types:** split declarations per module (and what that does to the published exports) or `plitzi explain api`.
- **The start budget's numbers:** 6k and 1.5k are proposals; the context axis of the benchmark sets them where the floor
  is.
