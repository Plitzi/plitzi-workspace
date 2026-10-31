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

**Both at once.** A journey holds an element check where it gets to — `e2e.expectCheck('badge-counts')`: the check's
element resolved for the page's state and sources then, not the check's own `given.state` (the sources the check names
itself, a list's row, are laid over them). A rule written once is held at every point a whole flow reaches it. A
journey may also start with a state — `given: { state: { items: 3 } }`, set as the page opens — to reach a case
without the steps that lead to it. Both read and write the page's state bridge, `window.__plitzi`.

**Signed in, as a test account.** A journey plays as a guest, or `as` one of the space's test accounts —
`tests.accounts: [{ id, email?, roles? }]`, declared in the tests alone: no account of the platform's, no password,
the same document in every tier. Its roles are the space's visitor roles (`settings.visitorRoles`), chosen from them in
the builder, and what it may is what they give, as for a visitor (`rolesGrant`, worked out as it signs in); a role the
space removed since is warned (`test-account-role-gone`, `testAccountWarnings`) and gives nothing. Played as one, the
page shows that visitor: the auth source holds its details and a token no server takes (`test:<id>`), `can()` answers
by what its roles give, a page for signed-in visitors
opens, and signing out drops it. The API does not know it — what the page asks the API it asks as a guest — so a
journey with an account reads and moves, and never writes as anybody. Each runner signs the page in the same way,
through the bridge (`signInAs`, then `navigate` to the journey's page — a guarded page opened first sent a guest to
sign in), and again after every load (`goto`, `reload`, `back`); the SDK's `AuthContextProvider` lays the account
over the session (`runtime.testAccount`, `testAccountAuth` in `@plitzi/sdk-auth`). `e2eTestProblems` says an `as`
no account answers and an id declared twice.

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
  - `beforeStep` and `signal` let a player pause, step and stop;
  - `space` is the document the journey's element checks are read from — each player passes its own: the builder's as
    edited, the server's draft, the project's space as authored.
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
  - And with none of the editor's session, as the server plays it (`playingJourney`, `GuestWhilePlaying`): the page
    reads a guest (`guestAuth`: the auth source empty, `can` false), or the journey's own account, and its pages' access
    holds — the canvas otherwise leaves every page open for editing, and a journey that met a guarded page passed on
    the server and failed here. A session the journey signs in to is its own, and is read; the account is dropped when
    it ends.
  - **Test accounts** (the area's card): who a journey plays as — added, edited (never its id: the journeys name it)
    and removed, saved with the tests; one a journey plays as is kept, naming it. Its roles are chosen from the space's
    (**Add a role…**), never typed; one the space removed since shows amber, said on its row. Each journey says who it plays as
    beside where it starts (**As a guest**, **As <account>**).
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
  - `plitzi page play --journey <id>` plays a journey first, its checks held, and reads or plays on from where it
    leaves the page (`commands/page/playJourney.ts`).
- **The MCP.**
  - `plitzi_test`: `list`, `set` (saved whole, refused as `SpaceSetTests` refuses), `run` (journeys on the draft
    through the server's runner).
  - A batch that leaves a test unreadable says so in its warnings (`tools/shared/lintDraft.ts`).
  - The primer names the space's element checks and journeys by id and title, and the plan's counts.
- **The server** (`plitzi-sdk-server`):
  - `SpaceTests`, `SpaceSetTests` and `SpaceRunE2eTests`.
  - A snapshot is refused with `SPACE_TESTS_FAILED` while an element check fails or a test is written wrong.
  - A publish plays the journeys first in Playwright's Chromium on the draft (`runE2eOnDraft`). A server with no
    browser says they were not run, and why.
  - The page the runner plays is the draft's preview session minted for tests (`mode: 'tests'`, `DraftEntry.inspected`):
    the SDK puts the state bridge on it with no panel or badge (`DevToolsContainer`'s `inspector`), so a starting state,
    `setState` and `expectCheck` play there as in the builder. A person's preview session never carries it.
  - A play asked for — **Run on the server**, `plitzi_test run` — is told step by step on the space's channel
    (`SPACE_TESTS_PLAYING`: the run, the journey, how far, the page after the step): every builder open on the space
    shows it as it plays; the run's answer is still the report.

## Who writes them

Reading the tests and playing them in the builder is anyone's who opens the space. Writing them — and playing them on
the server, which counts against the plan — is the permission `spaceTests`: every role from **Can edit content** up,
and **Can test** (`spaceTester`), a QA's role that writes the tests and changes nothing of the space. Its agent saves
the tests alone over the MCP (`SSRGrant.canTest`); the builder shows the rest of the space read-only, and the Tests
area says, calmly, why a role that may only view cannot write them (`plitzi-sdk-server` `docs/workspaces-and-teams.md`
§ Space roles).

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
`moreServerRuns`: the plan that gives more) and on the pricing page. What is used of the month comes with the tests'
answers (`serverPlays`: used, of how many, the day it starts again), and the builder's Journeys area shows both beside
the journeys, with the way to more.

## Left out

- **Flows unit-tested without a browser.** Their steps run in the SDK's components, across elements: emulating that
  runtime in node is a second SDK to keep in step. A journey tests a flow end to end; its server half (an action, a
  function) is tested as code.
- **Visual regression** (pictures compared against a baseline): `comparePictures` exists; a journey may add a
  picture expectation later.
- **Load and performance tests.**
- Open: whether a journey may play as an account the space does not own (the CLI's `as` works against a project's
  server; on the platform it would need the workspace's test accounts), and how long a run's frames are kept.
