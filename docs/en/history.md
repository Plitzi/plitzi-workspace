# Change history

Every save of a space's **schema** and **style** is recorded: who made it, from where, and exactly what it changed —
entity by entity, before and after. The builder shows it as a timeline; an agent reads it over MCP. It exists for two
jobs: **reviewing** what changed (including everything an agent did) and **debugging** what broke something.

The history is **read-only**. It never writes back into a space: there is no "revert this change" and no "restore to
here". Undo stays the builder's, and fixing a bad change is an ordinary edit.

---

## 1. What is recorded

One record per save that changed something, taken where every writer passes — `save()` on the `Space` and `Style`
models in `plitzi-sdk-server` — so nothing can write around it: the builder's mutations, `SpaceUpdateSchema`, an agent
over MCP, the builder's co-worker, the autofix, seeds and scripts.

A record holds:

| Field | Meaning |
|---|---|
| `seq` | Position in the space's timeline (per space and environment), and its address |
| `at` | When, in milliseconds |
| `document` | `schema` or `style` |
| `author` | The person it was made for (`userId`, and their name as it is now) — none for a seed or a script |
| `origin` | `builder`, `mcp` (an agent), `coworker`, `autofix`, `api` (a GraphQL client that is not a person) or `system` |
| `client` | The builder tab it came from |
| `batch` | Shared by everything one request saved: one builder request, one `plitzi_apply`, one autofix run |
| `entries` | Each entity changed: `{ kind, id, op, before?, after? }` |
| `summary` | One line, e.g. `Added class card; Updated element hero, cta` |

An entry is one whole **entity** — an element (pages and layouts are elements too), a page folder, a schema variable, a
setting (`settings.<key>`, `definition.<key>`, the page order `pages`), a class, a global style, an id style, a design
token (`<category>/<name>`) or a font. A selector is one entity across the display modes, so "only on tablet" reads as
one change to it. The field-level difference is derived when it is shown.

**Not recorded:** a document written for the first time (a new space has nothing behind it), a published revision
(it is a copy, never the draft), segments, connectors and server actions. A save that changes nothing records nothing.
A change too large to store whole — a whole-schema replacement of a very large space — names what it touched and is
marked `truncated`.

## 2. Attribution

The save does not know who asked; the request does. Attribution travels in an `AsyncLocalStorage` context
(`services/history/context.ts`) that each writer opens around its work:

- **GraphQL** — `attributeChanges` (`services/history/attribution.ts`) around every request: the signed-in person as
  `builder`, a client with no person as `api`, the tab from `plitzi-instance-id`.
- **MCP** — `saveSchema`/`saveStyle` receive an `SSRWriteContext` (`userId`, `batch`) from `@plitzi/sdk-mcp`, one
  batch per tool call, recorded as `mcp`; the in-process co-worker bridge records the same writes as `coworker`.
- **Autofix** — `SpaceFixIssues` runs its fixes as `autofix`, for whoever asked.

A save with no context is recorded as `system` rather than dropped. Recording never fails a save: the save has already
happened, so a record that cannot be written is logged instead.

## 3. How long it is kept

Per plan: `historyRetentionDays` on the plan row (`FREE_PLAN_HISTORY_RETENTION_DAYS` for the free tier, 30 by default;
the seeded paid tiers keep 180; Lifetime keeps everything). Each record is stamped with its own expiry from the plan the
space is on when it is recorded, and a TTL index drops it then — a plan that changes moves what is recorded from then
on and never rewrites what is stored. `0` keeps a space's history for as long as the space exists.

Records live in Mongo, in `space_changes` (with `space_change_counters` handing out `seq`).

## 4. Reading it

**In the builder:** the **History** panel on the left. Newest first, with consecutive saves by the same person from the
same place folded into one row (one request, or saves less than a minute apart). A row unfolds into every entity it
touched, each update field by field before and after; an element still in the space is a link to it. Filters: who made
it (person, agent, co-worker, autofix), **only the selected element** (that element's own history), and **since the
last snapshot**. Published revisions are drawn on the timeline as markers at their publish date — what sits below a
marker is what that revision includes. The markers are indicative: they are placed by date, and the snapshot system
itself is untouched.

**Over GraphQL:** `SpaceChanges(environment, before?, entityId?, origin?, userId?, since?, limit?)` answers a page
(`changes`, the `snapshots` to mark it with, and `nextBefore` for the next page). It needs `spaceView`.

**Over MCP:** `plitzi://changes/{env}` (the latest changes) and `plitzi://changes/{env}/{id}` (one entity's), so an
agent can review what it — or anyone — just did.

## 5. Cost

The record is computed on every save, against the document as it was read: about 10 ms of diff and a few ms of copy on
a 5 000-element schema, a fraction of that on a typical space. Then one counter increment and one insert.

## 6. Deliberately left open

- **The grouping window.** One minute is a guess; the right value comes from watching real sessions.
- **Viewing the space as it was after a change.** Every entry carries its `before`, so the current document with the
  later changes undone is that state — which would let a preview or a screenshot step through changes as a visual
  bisect. Nothing is built for it; nothing recorded would have to change to build it.
