# RFC 0031 — Space tests: one way to say a page works

- **Status:** Accepted — phases 1 to 6 done; what is left of them is listed under § 7, Still to do
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-30
- **Scope:** `sdk-authoring` (a testing layer: unit tests of a space's logic, e2e tests and the one runner), the
  builder (a Tests area), `sdk-server` (e2e tests run on a draft, on the server), the CLI (`plitzi test`, its page
  commands and a run's acceptance on the same runner), the MCP, and the publish gate

---

## 1. Summary

A space can be **written** (`authorSpace`) and **validated** (the linter — Issues in the builder, `author` in a project,
the MCP's refusals), but nothing says it **works**. What does — a page check, a play of steps, a line of a run's
acceptance — lives in the CLI alone, as flags on a command line, and is lost once it has run. A person in the builder
cannot test at all.

This RFC makes tests part of the space, as data, the way pages and flows are — **document → test**: a test reads the
space's document (the `Schema` the builder saves), never the code that authored it, so a test written in the builder and
one written in a project are the same record, run the same way. Two kinds, kept apart in the document, in the code and
in the builder:

- **Unit tests** — no browser, milliseconds: what an element of the space resolves to for a given state and data — its
  attributes, its style, whether it shows, its variant. Bindings, templates, `when` rules, `computed`.
- **E2e tests** — a page, at a width, a visitor's steps, and what must hold after them: the end-to-end test.

Each kind has its own record, its own linter and its own runner — `unit.*` and `e2e.*` in `sdk-authoring` — and both are
run by **one engine**, with four consumers: the builder, the CLI, the MCP, and the gate that holds a **snapshot and a
publish** to them passing.

## 2. Why now

- **Evidence that the layer is missing.** The website's pricing chooser needed its templates evaluated over all 40
  combinations of its answers: a test written by hand (`pricingChooser.test.ts`) with `processTwig` and the authored
  bindings, which every space with logic of its own would have to write again.
- **The CLI already has the vocabulary.** `page play --steps` (`click`, `type`, `drag`, `wait-for`, `as`, `action`,
  `source`, `clock`…) and `--expect` (`id~text`, `!id`, `width>=44px`, `a.bottom + 8 <= b.top`) are a test language —
  but as strings on a command line, parsed by the CLI, and written into a run's plan as shell commands.
- **The CLI learnt what makes a press reliable** — wait for the space to hydrate, press once (a click that went out and
  timed out after is not pressed again), settle the page between actions. Agents that check without the CLI, and specs
  written by hand, fall into each trap again (run `hazards-all`, 2026-10-30: stepped lines flaky by the machine's load).
- **People can't test in the builder.** A space edited there is checked by eye; a regression is found by a visitor.

## 3. Unit tests (`tests.unit`)

Pure: no browser, no server, no React. They read the document and evaluate what the SDK evaluates when it draws an
element, with the same functions (`getBindingsDetails`, `processTwig`, `evaluateComputed`):

```ts
import { unit, runUnitTests } from '@plitzi/sdk-authoring';

const lit = unit.test({
  id: 'app-lit',
  title: 'Choosing App lights its step',
  element: 'pr-site-ladder-app',
  given: { state: { pricingSite: 'app' } },
  expect: [unit.variant('pr-rung', 'current')]
});
runUnitTests(schema, [lit]); // or the document's own: runUnitTests(schema)
```

A record: an element of a page, what it is given (`state`, and sources by name — a list's row is `list_<id>: { item,
index }`), and what must hold of it — `visible`, an `attribute`, a `style` property its bindings write, a class's
`variant`, a key of its initial `state`. Its element shows only while every element around it does. `resolveElement`
answers the whole of what an element resolves to, for a test that wants more. What a unit test does not hold: flows
(their steps live in the SDK's components, across elements — an e2e test holds them), layout, anything drawn.

## 4. E2e tests (`tests.e2e`) — the flows

### 4.1 The model

An e2e test is data — JSON in the document, a typed value in code:

```ts
import { e2e } from '@plitzi/sdk-authoring';

export const addToCart = e2e.test({
  id: 'add-to-cart',
  title: 'A visitor adds a coffee and sees it counted',
  page: '/menu',
  width: 390,
  // Deterministic: an action answered by the test, the clock fixed.
  answers: { 'menu-items': { items: [{ id: 'flat-white', price: 3.5 }] } },
  clock: '2026-10-30T09:00:00Z',
  steps: [
    e2e.click('add-flat-white'),
    e2e.expectText('cart-count', '1'),
    e2e.expectState('cart', [{ id: 'flat-white', quantity: 1 }]),
    e2e.click('cart-open'),
    e2e.expectShown('cart-panel')
  ]
});
```

- **Elements by id**, never by CSS selector: an e2e test survives a restyle, and the builder picks an element by clicking
  it. A row of a list is `id:2`, `id:last`, as the CLI already says it.
- **Steps and expectations interleave**, as a Playwright test reads: act, check, act.
- **The vocabulary is the CLI's**, moved here as types (`E2eStep`, sdk-shared): steps `click`, `hover`, `type`, `press`,
  `scroll`, `drag`, `waitFor`, `goto`, `back`, `reload`, `setState`, `setSource`, `tick`; expectations `expectShown`,
  `expectHidden`, `expectText` (contains, or `exact`), `expectState`, `expectAttribute`, `expectStyle` (a property, or
  at least / at most a number), `expectPosition` (where two elements stand: `activity.bottom + 8 <= legend.top`).
- **Answers and clock** make it deterministic: an action answered by the e2e test (`answerAction`), the page's clock
  held. An e2e test against live data is allowed, and said as such in its report.

### 4.2 Checked like the space

Each kind is linted against the document before it runs (`unitTestProblems`, `e2eTestProblems`): ids unique, the page
answered by the space's own router, every element it names in the space (a component's parts too), a relation that is
one, a clock moved only by a test that holds one — the same "every problem at once, with the fix" as `author`.

### 4.3 The runner

`runE2eTest(page, test, { origin })` drives a browser page given structurally — Playwright's `Page`, or anything
with the same methods, as `inspectPage` takes one — and answers a report in text and data:

```
✓ add-to-cart — A visitor adds a coffee and sees it counted (390 px, 1.8 s)
  ✓ click add-flat-white
  ✓ cart-count shows "1"
  ✗ state cart is [{"id":"flat-white","quantity":2}], expected [{"id":"flat-white","quantity":1}]
```

It holds what the CLI learnt, in one place:

- the page **opened settled** (`openPage`), and a press waits for the space to **hydrate** — and says so when it never
  does, rather than pressing a page that drops it;
- a press is **made once**: one that went out and timed out after (Playwright waiting on what it set off) is never made
  again;
- the page **settles between actions** (animations finished, layout still), never before a picture of what moves;
- an expectation **retries** for its time (an assertion's, 5 s) before it fails, and fails saying what it read.

## 5. Where e2e tests live

In the space, beside its pages: `space.tests` in the document, kept with every snapshot, so a published revision carries
the tests it passed. A project writes them in `src/tests/*.ts` with the functions above; `plitzi space push` puts them in
the space, and `create --from` writes them back as files — the way pages travel today. The builder edits the same
records.

## 6. The four consumers

### 6.1 The builder — a Tests area

A mode of its own beside the canvas:

- **Left**: the page in a device frame (390, 768, 1440), drawn live from the server as the e2e test runs.
- **Right**: the space's e2e tests, each with its state — passed, failed, running, queued — and its last run.
- **Bottom**: the run's log, step by step, the failed one opened with what it read.
- **Recording**: press Record and use the preview; each click, type or scroll becomes a step, its element by id. Pick an
  element and say what must hold of it — shown, its text, the state key it wrote — and it becomes an expectation.

The builder runs no browser: the server does.

### 6.2 The server — e2e tests on a draft

`sdk-server` runs an e2e test against the draft (or a revision) in a browser of its own — the preview and screenshot
service's — and streams its frames and its report to the builder. One run at a time per space; how many a workspace may
run is a plan's (`services/entitlements`).

### 6.3 The CLI and the MCP

- `plitzi test [test…]` runs a project's e2e tests against its server, and its unit tests.
- `page play`, `page check --steps --expect`, `page measure --expect` keep their command line and run on the same
  engine underneath: one way steps are played, whoever asks.
- A run's acceptance names e2e tests rather than shell lines — `"e2e": "add-to-cart"` — and the finish runs them.
- The MCP lists, writes and runs a space's e2e tests (`plitzi_test`).

### 6.4 The gate — snapshot and publish

A snapshot and a publish run the document's tests and refuse while one fails, naming it and what it read — as they
refuse a document with issues today. Unit tests always (milliseconds, on the server's own process); e2e tests where the
deployment runs a browser for them, and said as not run where it does not — never passed unsaid.

## 7. Phases

1. **sdk-authoring** — done. The records in `sdk-shared` (`Schema.tests`); `unit.*`, `runUnitTests`,
   `unitTestProblems`, `resolveElement`; `e2e.*`, `runE2eTest`, `e2eTestProblems`, holding the CLI's lessons;
   `readSpaceTests`, the records read from outside. Unit tests in node; the runner in a real browser
   (`e2e/tests/sdk/spaceTests.spec.ts`).
2. **Storage and the gate** — done. The document keeps `tests`, a snapshot copies it; `SpaceTests` (the tests and how
   they stand), `SpaceSetTests` (saved whole, refused when not tests), `SPACE_UPDATE_TESTS`; a snapshot and a publish
   refused while a unit test fails or one is written wrong (`SPACE_TESTS_FAILED`), the e2e tests said as not run
   (`plitzi-sdk-server`: `services/validation/spaceTests.ts`, `test/e2e/flows/spaces/space-tests.e2e.test.ts`).
3. **The builder's Tests area** — done. The view (sidebar, beside Server): unit and e2e tests listed apart with how
   each stands, written and edited in their forms, removed; **Run e2e tests** plays them on the draft, and a run is
   replayed step by step in its device frame with its log (`E2eRunView`); **Record steps** in an e2e test's form puts
   the canvas in preview, and each click, field typed or "Click to expect" there becomes a step of the test
   (`apps/builder/src/modules/Tests`, `recording/`; `e2e/tests/builder/spaceTests.spec.ts`).
4. **The server runner** — done. `runE2eOnDraft` (`plitzi-sdk-server`, `services/validation/spaceTestsE2e.ts`) plays
   them on the draft in Playwright's Chromium on the server, the draft followed from page to page by a preview session;
   with no browser there it answers why they were not run. `SpaceRunE2eTests` runs them for the builder with a picture
   after each step; a publish runs them before its snapshot and refuses while one fails, and its answer says passed /
   not run and why.
5. **The CLI on the engine** — done. `plitzi test [id…] [--unit|--e2e] [--url] [--json]` authors the project's space and
   runs its tests against its server. The press (`pressOnce`, `pressFailure`), the hydration wait and the relations
   (`parseRelation`, `relationHolds`) moved from the CLI into sdk-authoring: `page play`/`check`/`measure` use them.
6. **The MCP** — done. `plitzi_test`: `list` (the tests and the unit tests' report), `set` (the tests saved whole,
   refused as `SpaceSetTests` refuses), `run` (the e2e tests through the server's runner).

### Still to do

- **Frames streamed while a run plays.** They come back with the report, and the builder replays them; a subscription
  would show the run as it goes.
- **A run's acceptance by e2e test** (`"e2e": "add-to-cart"` in a run's task): the finish would run them.
- **`page play`/`check --steps` played through `runE2eTest`** rather than sharing its parts: their steps are the CLI's
  own grammar today.
- **One run at a time per space, and a plan's allowance of runs** (`services/entitlements`).

## 8. Left out

- **Flows unit-tested without a browser.** Their steps run in the SDK's components, across elements: emulating that
  runtime in node is a second SDK to keep in step. An e2e test tests a flow end to end; a flow's server half (an action,
  a function) is tested as code, as today.
- **Visual regression** (pictures compared against a baseline): `comparePictures` exists, and an e2e test may add an
  `expectLooksLike` later — not in this RFC.
- **Load and performance tests.**

## 9. Open questions

- Whether an e2e test may sign in as an account the space does not own (`as`): the CLI's project account works locally;
  on the server it needs test accounts of the workspace's.
- How long a run's frames are kept, and whether a failed run's are kept for its report.
