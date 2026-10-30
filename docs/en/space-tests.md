# A space's own tests

What a space must do, written in the space beside its pages and held wherever it ships. Element checks (unit tests)
and journeys (e2e tests) are records of its document (`schema.tests`). The builder, the CLI, the MCP and the server all
read them with the same functions of `@plitzi/sdk-authoring`. A snapshot and a publish wait for them.

## Two kinds, apart

| | Element checks — `tests.unit` | Journeys — `tests.e2e` |
| --- | --- | --- |
| What | One element of a page resolved for a state and its sources: whether it shows, an attribute, a style, a class's variant, a key of its state | What a visitor does on a page, from start to end — clicks, typing, keys, pages — and what must show as they go |
| Played | In node, no browser: `runUnitTests`, `resolveElement` | In a browser page: `runE2eTest(page, test, { origin })` |
| When | On every save (the builder's view, `plitzi test --unit`), and at a snapshot | On asking: the builder's canvas, `plitzi test`, `plitzi_test run`, a publish |

A journey is not an interaction's flow (`flows: [[onClick(), …]]`): a flow is what an element does, and a journey is what
a visitor does across the page. An interaction's flow is tested end to end by a journey that clicks what runs it.

```ts
import { e2e, unit } from '@plitzi/sdk-authoring';

tests: {
  unit: [unit.test({ id: 'badge-hidden', title: 'The badge waits for an item', element: 'basket-count', given: { state: {} }, expect: [unit.visible(false)] })],
  e2e: [e2e.test({ id: 'orders', title: 'A visitor orders a loaf', page: '/', width: 390, steps: [e2e.click('add-sourdough'), e2e.click('nav-basket'), e2e.type('order-name', 'Ana'), e2e.click('place-order'), e2e.expectText('order-thanks', 'Thanks, Ana!')] })]
}
```

The seed `corner-bakery` (in `plitzi-sdk-server`) carries seven element checks and eight journeys across five pages.

## One engine

- **Records**: `sdk-shared` `types/TestTypes.ts`; `SpaceSpec.tests` is authored and decompiled with the rest of the
  spec.
- **Read as written**: `unitTestProblems` / `e2eTestProblems`. They check ids, pages, elements, relations, widths and
  clocks. A page answered by the space's own not-found page (`slug: '*'`) counts as answered. `lintSpace` raises each
  problem as the warning `test-unreadable`, so a test the space no longer answers is said wherever the space was
  changed.
- **Played**: `runE2eTest` takes the page structurally (`E2ePage`): Playwright's page, or the builder's canvas
  (`CanvasPage`). It holds the CLI's lessons:
  - a press waits for hydration and is made once (`pressOnce`);
  - its failure is said from Playwright's log (`pressFailure`);
  - the page settles between actions;
  - an expectation is retried for its time;
  - a press acts on the copy a visitor sees (`shownCopy`): the first shown, or the one named (`id:2`, `id:last`); one
    on the page and shown nowhere at this width is said so (`hiddenAtWidth`), apart from one not on the page;
  - `type` writes in the field inside the element (`locateField`); a select is chosen from, and a date, a time, a
    colour or a range set whole (`giveValue`);
  - a drag presses a range at its thumb (`dragElement`); a click waits for what it asked the server (`answered`);
  - `beforeStep` and `signal` let a player pause, step and stop.
- **Pressed the same way by the CLI.** `page play` and `page check --steps` keep their own grammar — a target is a
  name, a selector or a row, and steps such as `as`, `action`, `shot`, `frames`, `store`, `wait` and `release` are
  theirs alone — but each press goes through the engine's pieces above (`testing/e2e/act.ts`): what one learns, both
  have.

## Who reads them

- **The builder — the Tests area** (`apps/builder/src/modules/Tests`). Two tabs: **Journeys** and **Element checks**.
  - Layout: the canvas, live and in preview, at the chosen journey's device; the journeys beside it, each with a state
    pill; the chosen one below.
    - Its steps are written as sentences, as moments ("when the page opens" → each action and the checks after it),
      above a timeline.
  - Playing:
    - **Play**, **Step by step**, **Stop**, and a pause between steps (0.25 s, kept per person).
    - A step's ▶ plays the journey up to it and holds there.
    - **Record** and **Add a check** write steps by using the page.
    - **Play all** plays every journey in turn, with a log and a closing line.
  - Each play starts as a new visitor: the canvas is drawn again and the state emptied; the author's state comes back
    when the area closes.
  - Problems:
    - Read in the builder (`useTestProblems`), against the document as edited.
    - Said calmly where they are fixed: the tab, the row, the field (where it starts, its device), the step.
  - The canvas plays what a page does by itself: a hover is its events, not CSS `:hover`; a key is its events, and
    Enter in a form's field submits it. What a real browser alone does — a held clock, answered actions, a reload —
    goes to **Run on the server**, shown live as it plays: each journey's pill, and a card with the step and the page
    after it.
- **The CLI.**
  - `plitzi test [id…] [--unit|--e2e] [--url] [--json]`.
  - `plitzi verify` runs them as its check `space tests`; with `--no-pages`, the element checks only.
  - Both go through `playSpaceTests` (`apps/cli/src/commands/project/spaceTests.ts`).
- **The MCP.**
  - `plitzi_test`: `list`, `set` (saved whole, refused as `SpaceSetTests` refuses), `run` (journeys on the draft
    through the server's runner).
  - A batch that leaves a test unreadable says so in its warnings (`tools/shared/lintDraft.ts`).
- **The server** (`plitzi-sdk-server`):
  - `SpaceTests`, `SpaceSetTests` and `SpaceRunE2eTests`.
  - A snapshot is refused with `SPACE_TESTS_FAILED` while an element check fails or a test is written wrong.
  - A publish plays the journeys first in Playwright's Chromium on the draft (`runE2eOnDraft`). A server with no
    browser says they were not run, and why.
  - A play asked for — **Run on the server**, `plitzi_test run` — is told step by step on the space's channel
    (`SPACE_TESTS_PLAYING`: the run, the journey, how far, the page after the step): every builder open on the space
    shows it as it plays; the run's answer is still the report.

## What a plan allows

Element checks have no limit, and journeys play in the builder's canvas as often as anyone likes, on every plan. A
plan counts two things (`plitzi-sdk-server`, `services/entitlements/catalog.ts`; `validation/spaceTestsLimits.ts`):

- **Journeys kept per space** (`JOURNEYS_PER_SPACE`): Free keeps one, to try what a journey is; each plan up keeps more.
  A save that adds past it — the builder, `plitzi space push`, an agent's write — is refused, naming the plan that keeps
  more; one that keeps as many, or fewer, is always taken, so a space over its plan keeps and edits what it has. The
  builder offers no new journey at the limit and says so calmly.
- **Journeys played on the server a month** (`SERVER_RUNS_PER_MONTH`, the UTC month), counted per journey played on
  asking. A publish's own play is not counted. One play at a time per space: a second while one plays is told to wait.

Both are in the space's entitlements (`journeysPerSpace`, `serverRunsPerMonth`, and `moreJourneys` /
`moreServerRuns`: the plan that gives more) and on the pricing page.

## Left out

- **Flows unit-tested without a browser.** Their steps run in the SDK's components, across elements: emulating that
  runtime in node is a second SDK to keep in step. A journey tests a flow end to end; its server half (an action, a
  function) is tested as code.
- **Visual regression** (pictures compared against a baseline): `comparePictures` exists; a journey may add a
  picture expectation later.
- **Load and performance tests.**
- Open: whether a journey may play as an account the space does not own (the CLI's `as` works against a project's
  server; on the platform it would need the workspace's test accounts), and how long a run's frames are kept.
