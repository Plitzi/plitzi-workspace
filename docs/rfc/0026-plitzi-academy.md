# RFC 0026 — Plitzi Academy: learning to author a space, kept true release after release

- **Status:** Proposal
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-09
- **Scope:** a new docs space and its account (`plitzi-sdk-server`, `prisma/seeds/spaces/docs/`), the website's docs
  pages (moved out of `platform/website`), the seeder, the visual suite, the release checklist; links from the CLI and
  the skills

---

## 1. Summary

Authoring a space in code is today learnable by an agent and by almost nobody else. The agent has a skill written for
it: rules first, a token budget, recipes. A person has the website's docs, which are a **reference by topic** —
*Elements*, *Data and bindings*, *Interactions and flows* — good for somebody who already knows what to look for, and no
path for somebody who does not.

This RFC adds **Plitzi Academy**: three tracks of short lessons, each track building one real project from `plitzi
create` to something worth shipping. And it moves the docs and the Academy out of the website's space into a space of
their own, on `docs.plitzi.com`, seeded like the showcase.

The hard requirement is the one that decides the design: **a lesson must never go stale without a test saying so.**
Every lesson's code is a project the tests author and render; every "you should now see" is an assertion; every
screenshot is generated. A release that breaks a lesson fails before it is published, in the same step where the
seeds are brought up to date today.

## 2. The problem

1. **No path for a person.** The docs answer "what is X". Nobody is taken from an empty folder to a published space,
   and what a beginner needs in order is spread over twenty pages written in no particular learning order.
2. **The website's space is saturating.** The docs are ~30 pages inside `plitziWebsite` (whose `layoutContainer-2.ts`
   alone is 140k characters). Every docs page and lesson makes the space every builder session, seed and MCP read
   loads heavier — and an Academy would add 30 to 60 more.
3. **Tutorials rot.** The platform changes every week: an API renamed, a better form introduced (`defineElement<X>`
   → `defineElement(declaration)`, `named` + `whenFailed` → `runServerActionOrNotify`, both in the same week). A
   tutorial nobody re-runs is wrong within a release, and a wrong tutorial costs more than a missing one: the reader
   cannot tell.

## 3. What a reader gets

### 3.1 Three tracks, one project each

| Track | Builds | Lessons (8–10, 15–20 min each) |
| --- | --- | --- |
| **1. Foundations** | A small business's website | `plitzi create` → a page → styles and tokens → a layout → a component → data from `src/data/` → a list → an interaction → publishing |
| **2. Applications** | A booking app with accounts | forms → server actions → functions → sign-in and visitors → realtime → feature flags → errors the visitor reads |
| **3. Advanced** | A dashboard with a plugin of its own | `definePlugin` and `usePluginTrigger` → testing → performance → space to project and back → self-hosting |

Each track ends in something real, and that something is offered as a **template**: the seeder already publishes every
seeded spec with `template !== false` as a public template (`docs/templates.md`), so "start from where lesson 2-4
ends" costs nothing new.

### 3.2 One lesson

1. **What you will build** — a screenshot of the result, generated (§5.4).
2. **Steps** — the code, shown from the files the tests run (§5.1), never pasted.
3. **Check it** — the command and what it answers (`npm run author` clean, `page check` green).
4. **If it does not work** — the codes this step tends to produce, linked to *When authoring says no*.
5. **With an agent** — the prompt that does the same step. The Academy teaches people to direct agents too, which is
   the bridge between the two readers Plitzi has.
6. **What you learned** — links into the reference, which owns the detail.
7. **A challenge** — optional, its solution folded.

### 3.3 Live demos

A lesson may embed its track's space running, through the existing `plitziSdk` element (`apps/sdk`, rendering another
space with `renderMode: 'widget'`). Widget mode renders one page, ignores the URL and paints in the browser only —
fine for a demo beside a lesson, which is all it is used for here (§7.4).

## 4. Where it lives

- **One space, `docs`,** seeded from `prisma/seeds/spaces/docs/`, owned by a new **docs account in a team workspace of
  its own** — the way the `showcase` account owns Inkwell, Pizarra and Tremor. Served at `docs.plitzi.com`
  (`docs.plitzi.local` locally); the Academy is its `/academy` folder.
- **The reference moves with it.** The website's `docs-*` pages, `docs/nav.ts`, `docs/page.ts`, `docs/layout.ts` and
  `docsAccuracy.test.ts` move to the new seed. The website keeps its landing, pricing and the account's console, links
  to `docs.plitzi.com` with document navigation, and redirects its old `/docs/*` addresses.
- **The track projects are seeds of the same account,** each a template and the space its lessons embed. The steps
  between are not spaces (§5.1).
- **The nav model is shared.** `DocsLevel`, the one list of entries every sidebar, breadcrumb, previous/next card and
  SEO field reads, gains the Academy's tracks as groups of their own.

Nothing new is operated: the seeder publishes it, and the SSR that serves `plitzi.com` serves it.

## 5. Kept true: how a stale lesson is caught

Four ways a lesson goes stale, and what catches each:

| Stale how | Example | Caught by |
| --- | --- | --- |
| **The code no longer works** | an API renamed | Each step is a project the tests typecheck and author. Pre-release there are no shims: an old API is gone and fails to compile. |
| **It works, but is no longer the good way** | `defineElement<X>(…)` after `defineElement(declaration)` existed | A step must author with **no suggestions**. The platform rule already holds: a better form arrives with its suggestion code (`plugin-custom-host` did). No suggestion, no improvement that leaves anything behind. |
| **The text says something that changed** | "you will see three cards" | Each *Check it* is an assertion the test makes on the rendered step. |
| **Screenshots and CLI output** | an old design in a picture | None is made by hand: screenshots come from the visual suite, CLI output from running it. |

### 5.1 One piece of code exists once

A lesson is not a copy of the project: it is **the change it makes to the one before**. Step 0 is what `plitzi
create` writes, generated by the test itself — so a change to the scaffold shows up once, there, and not in thirty
copies. The page shows that same change, read from the files at seed time (`readFileSync`): the text and the tested
code have one source. (Whether a step is stored as a patch or as the files it touches is the pilot's to settle, §8.)

### 5.2 Lessons own no facts

A lesson says *do this, check this* and links to the reference for the why. The rule of the workspace's `CLAUDE.md`
(§ *Documentation — one owner per fact*) gains the Academy as a surface that owns nothing: when a rule changes it
changes in its one owner, and the lesson stays right. Nothing in a lesson enumerates a catalogue (elements, steps,
codes): that is `explain`'s and the reference's, already generated from the code.

### 5.3 Knowing what a release touches

Each lesson's APIs are read from its own imports. When the public surface changes — `sdk-authoring`'s
`publicTypes.test.ts` already watches it — a check lists the lessons using what changed, so a release says "look at
1-6 and 2-3", not "look at everything".

### 5.4 Screenshots

The visual suite (`visual/examples.spec.ts` in plitzi-sdk-server, which already opens the showcase spaces) opens each lesson's step and
writes its screenshot, light and dark. A design change regenerates them; nobody retakes a picture.

### 5.5 When the tests run

The seeds consume the published `@plitzi/*`. Before a release the packages are portaled and the seeds brought up to
date against the unreleased code — what was done on 2026-10-06 and 2026-10-09. The lessons are seeds, so their tests
fail **in that step, before publishing**. The release checklist says so in a line, so it does not depend on memory.

### 5.6 What tests cannot promise

That the text still explains well. A test proves a lesson's claims true, not clear. That is covered by a **fresh-reader
pass on every minor release** — a person, or an agent with no context, following the lessons in an empty folder — with
§5.3's list saying where to look first. Patch releases need none.

## 6. The surfaces, after

| Surface | Reader | Owns |
| --- | --- | --- |
| The code | everyone | what is true; facts are generated from it (`codes.ts` → *When authoring says no*, the `explain` catalogues) |
| Authoring and CLI skills, MCP guide | an agent | how to write a space / use the CLI / use the tools — unchanged |
| Docs reference (`docs.plitzi.com`) | a person looking something up | the human explanation of each subject |
| **Academy** (`docs.plitzi.com/academy`) | a person learning | nothing: the order to learn in, and tested projects |
| `docs/en` | whoever works on the platform | unchanged |

## 7. Alternatives considered

### 7.1 Academy pages inside the website's space

Rejected: it is the saturation of §2.2, multiplied.

### 7.2 A `@plitzi/docs` package in the workspace

Content beside the code, tested in the same PR, versioned with the release, rendered by the website. Rejected for
now: it is a new package to publish so that one consumer can render it, while the seeds already get tested against
the unreleased code in the release step (§5.5). Generating the skills' and MCP guide's *facts* from one place stays a
good idea, and stays where it already is — the workspace generates `authoring-errors.md` from `codes.ts`.

### 7.3 `apps/docs`, a Plitzi project of its own

Self-hosted with `serveProject`, or pushed to the platform with `plitzi space push` on every release. Self-hosting
keeps the docs up when the platform is down — the one real advantage — at the price of a deployment of its own.
Pushing to the platform is the seed under another name, with a CI credential to keep. Rejected in favour of the
showcase's proven path; worth reopening if the docs must survive a platform outage.

### 7.4 The website embedding the docs space with `plitziSdk`

Rejected for the docs themselves: widget mode has no routing (`NavigationProvider` returns one page for `widget`),
disables scrolling to an anchor, and paints in the browser only — an empty first paint is the worst thing for the
pages search engines send most people to. Kept for live demos inside lessons (§3.3).

### 7.5 `plitzi.com/docs` instead of a subdomain

`plitzi.com` is the SSR serving the website's space, and a space's routes start at the root: another space cannot sit
under one of its paths. The routing already accepts a prefix (`basePath` in `getPaths`,
`sdk-shared/src/navigation/routes.ts`), but the server always sets `/` (`apps/server/src/helpers/buildServerInfo.ts`).
Serving a space under a path of another domain — a domain registered with a prefix, the SSR choosing the space by
domain and prefix, internal links and assets carrying it — would be a general feature (a customer's `example.com/blog`
from another space). Not part of this RFC; moving from `docs.plitzi.com` to a path later is a redirect, the content
does not change.

## 8. Phases

1. **The docs space and a pilot.** The docs account and its team workspace; `prisma/seeds/spaces/docs/` with the
   lesson page and the Academy's nav; the step harness (§5.1), the *Check it* assertions, generated screenshots; lesson
   **1-1** written in full. Then **break it on purpose** — rename an API, add a suggestion, change the scaffold — and
   see each caught. If the guarantee does not hold here, nothing else is written.
2. **The reference moves.** The website's docs pages, nav and tests move to the docs space; the website links and
   redirects; `docsAccuracy` runs there.
3. **Track 1**, reviewed when complete, with the first fresh-reader pass.
4. **Tracks 2 and 3**, each reviewed when complete; their projects become templates.
5. **Wiring.** The website's main nav and landing; a *Learn this in the Academy* line on each reference page; the
   CLI's message after `create` pointing to lesson 1-1; the release checklist's line (§5.5); the workspace `CLAUDE.md`
   surface table (§6).

## 9. Open questions

1. **Who first?** A developer who knows React and TypeScript, or somebody who writes HTML and CSS and does not program
   yet? It sets the pace and what each lesson takes for granted. Both, eventually; the first track is written for one.
2. **Progress kept for a signed-in reader?** "Sign in with Plitzi" for a space's visitors already exists and would
   carry it. Proposed for after phase 4.
3. **Versioned docs** (`docs.plitzi.com/0.39/…`) once releases are public and people run older versions.
4. **Spanish.** The docs are English; `docs/es` exists for the platform's own guides. The Academy's audience may ask
   for it first.

## 10. Done when

- A person with an empty folder reaches a published space by following track 1 alone, and the fresh-reader pass finds
  nothing that does not work as written.
- A platform change that breaks, or merely outdates, a lesson fails a test before it is published — proven in phase 1
  by breaking one on purpose.
- The website's space no longer carries the docs, and every old `/docs/*` address still lands on its page.
