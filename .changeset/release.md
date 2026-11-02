---
'@plitzi/plitzi-builder': minor
'@plitzi/cli': minor
'@plitzi/sdk-mcp': minor
'@plitzi/plitzi-sdk': minor
'@plitzi/sdk-server': minor
'@plitzi/sdk-auth': minor
'@plitzi/sdk-authoring': minor
'@plitzi/sdk-dev-tools': minor
'@plitzi/sdk-elements': minor
'@plitzi/sdk-event-bridge': minor
'@plitzi/sdk-interactions': minor
'@plitzi/sdk-navigation': minor
'@plitzi/sdk-plugins': minor
'@plitzi/sdk-schema': minor
'@plitzi/sdk-shared': minor
'@plitzi/sdk-style': minor
'@plitzi/sdk-variables': minor
---

A team of agents on one project (`plitzi run`, `plitzi task`), the page tools those agents measure with, tests kept in
the space, and what authoring and the elements learnt from the runs. Each command and option is in the CLI's README;
how the runs work, in `docs/en/agent-runs.md`.

## To do when you upgrade

- **Node 24.** `engines` is `^24.22.1 || >=26.12.1`; Node 22 is no longer supported (`plitzi doctor` says it,
  `doctor --fix` raises an older project's `engines`).
- **`createServer({ outbound: { privateOrigins } })` replaces `allowPrivatePluginHosts`:** a space's requests reach no
  private address but the origins named (`privateOrigins: ['http://localhost:9000']`).
- **Job queues from 0.38.20 or before are recreated, not upgraded:** `createMongoJobQueue` / `createMysqlJobQueue` empty
  or drop the old `action_jobs` / `action_kv` and make them again; `mysqlJobSchemaUpgrades` is gone.
- **`PLITZI_KV_FILE` is `PLITZI_STATE_DIR`**, a folder holding the server's `kv` and job queue.
- **A social provider's `fetchProfile` takes `{ accessToken, idToken, nonce }`**, and `createSocialAuth(...).start` is
  async.
- **A `DraftStore` of a deployment's own keeps `inspected`** beside `reusable`, or a test session renders without the
  state bridge.
- **`navigation.navigate(url, { external, replace })`** takes an object where it took `navigate(url, true)`.
- **`window.__plitzi.setSource` / `setAttribute` may answer `{ refused }`**: read it before treating the answer as written.
- **Renamed:** `stepText` → `e2eStepText` (a run's `said` is the step in words); `OverQuotaNotice` → `QuotaNotice` and
  its classes `plitzi-quota-notice…`; `sightOf` / `sightText` come from `@plitzi/sdk-shared/devTools/sight`.
- **`SchemaVariables` and `StyleVariables` draw no add button of their own:** the holder passes `adding`, `onAddingEnd`
  and optionally `empty`.
- **A page handed to `runE2eTest`** has `selectOption`, `position` in `click`/`hover` and `evaluate(fn, arg)`, as a
  Playwright locator: a hand-written page adds them.
- **Journey steps play as the page commands do:** `scroll` with `dx`/`dy` scrolls the element's content, `waitFor`
  waits 10 s, `type` replaces a field's value.
- **Authoring refuses more:** two flows of one element naming a step alike (`step-duplicate`), `visible` written as an
  expression (`visible-expression`), a step condition naming a source by id alone (`condition-short-source`).
  `navbar` / `navbarItem` are no longer read by `specFromSpace`.
- **`/robots.txt` ends naming its sitemap** unless the space's own text does.
- **The CLI's part of a project is `.plitzi/`** (it was split with `plitzi/`): `plitzi doctor --fix` moves it, and a
  tsconfig names `.plitzi/**/*`.
- **`plitzi upgrade`** brings the new scripts (`start:preview`, the visual suite's server on 8400, `test`), the ignores
  for `.plitzi/plitzi-reports/` and the skills. `test` runs the project's own tests, so red tests now fail
  `plitzi verify` and a run's checks.
- **Reports to Plitzi live in `.plitzi/plitzi-reports/`**, committed: a run's in `runs/<run>/`, an agent's in
  `agents/<date>/`. The old files are read no more.
- **The CLI's surface is smaller — one command for each thing.** Old names and flags are refused naming the new one;
  `plitzi upgrade skills --write` updates the agents' skills. The main moves: `run plan` / `run rehearse` →
  `run open --dry-run [--rehearse]`; `run extend` → `run open <stage>`; `run purge` → `run abort`; `task take` →
  `task next <task>`; `task ask` / `block` / `note` → `task tell --ask | --blocked | --handoff`; `task wait` / `release`
  → `task claim --wait | --release`; `task request` → `task propose --file`; `task check --before | --mutate` →
  `task prove`; `run feedback` → `run report --plitzi`; `functions pull|push` → `space pull|push functions`;
  `runtime push` → `space push runtime`; `page shot --live` / `--clip` → `--fresh` / `--within`; `PLITZI_TASK_TOKEN` →
  `PLITZI_TOKEN`.
- **Research and reviews are cards on one board:** `task spike` and the separate UI review are gone; a card's `review`
  names its roles in order. Runs opened before keep working.
- **Page commands:** `page check --expect` fails only on what it expects; every page command reads at 900 px tall
  (`--height`); a page that sends a guest away is read signed in as the project's account (`--as`, `--guest`).
- **`create --from`** names page files by the page's name; a space's functions are pushed without their tests.

## A space's tests (`@plitzi/sdk-authoring`, `@plitzi/sdk-shared`, `@plitzi/plitzi-builder`, `@plitzi/sdk-mcp`)

- **Tests are part of the space's document** (`Schema.tests`): unit tests (element checks) and journeys (what a visitor
  does), authored in code, edited in the builder's Tests area, played on the canvas or the server. See
  `docs/en/space-tests.md`.
- **Journeys play signed in as test accounts** (`tests.accounts`), carry tags, can be held and stopped
  (`runE2eTest`'s `beforeStep`), and hold element checks (`e2e.expectCheck`).
- **`plitzi test [id…]`** runs a project's tests; **`plitzi_test`** lets an agent run them over the MCP. What a plan
  allows (`journeysPerSpace`, `serverRunsPerMonth`) is in its entitlements; a `canTest` grant writes tests alone.

## Several agents on one project (`@plitzi/cli`)

- **A run is a kanban:** a lead plans, reviews and closes; developers, testers, designers and scouts take cards with
  `task next`, each in its own copy of the project; every card is reviewed by the roles it names, step by step.
  Nothing reaches the project until a person applies the run (`run finish --apply`).
- **Files are owned by imports:** one agent per file, shared files taken by turns or changed by agreement
  (`task propose`), merged line by line, checked on the whole result.
- **The run keeps itself going:** a keeper starts the agents work is waiting for, and holds
  starts after the harness's limit or repeated quick exits until the lead allows them (`run hold`, `run allow`).
- **`run monitor`:** the run live in a terminal — board, flow, agents, spend, activity — with an emergency panel (`!`)
  to pause, resume, hold or allow agents.
- **A change mid-run says what it reaches:** `run open <stage> --dry-run` and `run amend --dry-run` name the approved
  tasks, tasks at work and tests each change touches, read off the import graph.
- **Reviews see what goes in:** a review taken says whether the task merges with the run's newer work and, if not, the
  failing lines; `task show <file> --merged` and `task look --merged` read and serve the merge;
  `task look --alone <element> --with '{…}'` draws a component or plugin no page places yet. A step's time stops while
  its reviewer proves or looks.
- **Proofs:** `task prove --before` (what each acceptance line proves against the run before the task) and
  `--mutate` (whether a task's tests catch a broken change, with a control run).
- **The finish:** `run finish` checks the whole result and stops at the first failing line; `--every-line` reports
  them all. The run then leaves its reports in `.plitzi/plitzi-reports/runs/<run>/`.
- **A report to Plitzi holds nothing of the person or the project:** a run's `feedback.md` writes over names, emails,
  addresses, IPs, the project's files, tasks and elements, leaves out what was said of the project alone, and lists
  quoted passages for the person to read before sending. `plitzi feedback` carries no project name, asks the developer
  before anything of the project goes in, and `plitzi feedback --check <file>` names what a filled report still holds.

## Page tools (`@plitzi/cli`, `@plitzi/sdk-authoring`)

- **`page measure`** reads what an element draws (`--only drawn`, `box-*`, `attr:<name>`, `accessible-name`,
  `scroll-*`, custom properties) and holds bounds and positions (`--expect "width<=44px"`, `"a.bottom + 8 <= b.top"`).
- **`page play`** plays steps — `drag … hold`, `scroll page 1500`, `click <el> 30%,60%` — reads what is drawn, not
  what is in the DOM, and `--motion` plays animations moving. A press is made once and waits for the page to take it.
- **`page check`** says what a visitor cannot reach, text cut or spilling, canvases left blank, the server's error page
  when the space does not author, and holds a text whole (`=`) or in part (`~`).
- **`page shot`** waits for canvases, pictures hovers (`--hover`, `--frames`) and parts (`--within`), and says what it
  could not picture.
- **Every page command reads a page as one visitor from the same flags** (`--as`, `--guest`, `--width`, `--height`,
  `--fresh`), with a browser driver of the CLI's own.

## Authoring (`@plitzi/sdk-authoring`)

- **New checks:** a server provider the page server cannot read (`server-query-unresolved`) or that reads browser state
  (`server-when-unknown`), an action without `runtime: 'server'` (`server-source-in-browser`), class overrides,
  messages arriving while a flow runs, unused plugins.
- **New authoring:** `focus('field')`, a factory for every trigger, the scroll family's sides, `pagesIn(...)` to
  register pages by folder, channel topics with a choice, a plugin's imported stylesheets read for its tokens.
- **An element drawn alone:** a server started with `PLITZI_PREVIEW_FILE` gets a page for one element at
  `/plitzi-preview` (`withPreview`, `SpacePreviewError`) — what `task look --alone` uses.

## Elements and the SDK (`@plitzi/sdk-elements`, `@plitzi/plitzi-sdk`, `@plitzi/sdk-shared`)

- **Navigation:** `navigate` can replace the address, and a navigation inside the site leaves the scroll as a page
  load would.
- **Providers:** a `when` holds the same in the browser and on the page server; a server provider can read another
  site's address while the page is built.
- **Plans and roles in the contract:** entitlements (`TSpaceEntitlements`), the space role (`TSpaceAccess`), the quota
  warning at 80% (`render.quotaNear`) and the "Made with Plitzi" badge (`PlitziBadge`).
- **Fixes:** a binding's `sourceTo` is the previous value; an element with no tag and no `visible` draws nothing;
  placeholder words never reach a page; notifications stay open for a visitor who asked for less motion.

## Server (`@plitzi/sdk-server`, `@plitzi/sdk-auth`, `@plitzi/sdk-mcp`)

- **`/sitemap.xml`** for every space, and `/robots.txt` naming it.
- **Accounts:** terms accepted at sign-up (MySQL schema version 7), single sign-on with any OpenID Connect issuer
  (`createOidcProvider`), providers resolved at run time, a password that may not sign in, `/auth/continue` with a step
  of the deployment's own, a signed-out visitor never signed back in by a stale answer.
- **Policy adapters:** metering can hold a page back (503), decide the badge and `noindex`; the MCP can cap tool calls
  and names the space's plan; realtime admits spaces per deployment.
- **Dev server:** a removed plugin folder is unregistered (`PluginRegistry.unregister`), and a space that does not
  author is said whole, with no stack.

## The builder (`@plitzi/plitzi-builder`)

- **A Tests area** with journeys played beside the page at the journey's device, and element checks.
- **One way to build a panel**, a header grouped by what its controls do, and the layout's mask dimming only what the
  layout draws.
- **Plans and roles shown:** what the role allows (`useSpaceAccess`), what the plan leaves out shown locked, the plan
  and its spend in the header; pages left out of the sitemap marked.

## Dev tools (`@plitzi/sdk-dev-tools`)

- **`element(id).visible` is what a visitor sees** (`sightOf`), with why not; `element(id).resolved` says what each
  binding gave; a refused server action is a `refused` step.
- **Report what you see** in the Run tab of a run's preview, and the panel docks at the bottom under 900 px.

## The workspace

- **No file past 600 lines of code** (`max-lines`), and ESLint's `quotes` rule is gone — Prettier writes them.
