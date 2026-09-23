# @plitzi/sdk-variables

## 0.37.2

### Patch Changes

- ## Authoring and agents
  - **A step's params are templates in full.** Only a bare name (`{{ post.slug }}`) used to be recognised, so a
    condition or a loop in a `setState` or a webhook body was handed on as its own text — a flag set to
    `{% if … %}1{% endif %}` stored the template, a non-empty string every later check read as true. Any `{{ }}` or
    `{% %}` in a param is now evaluated; what it resolves to is data and is not evaluated again.
  - **Twig tests work.** `x is defined`, `is empty`, `is null`, `is iterable`, `is even`, `is odd` (and `is not …`) used
    to be read as comparisons with a variable of that name — `x is defined` answered true exactly when `x` was not
    defined. Anything else on the right of `is` still compares.
  - **A group takes an access chain.** `(rows|find('id', 3)).title` read the whole row; the key after the parenthesis
    was never parsed.
  - **An expression that chose to be empty renders empty** under `keepEmptyTokens`. A kept token is for a name still
    waiting for a value; `{{ on ? 'active' : '' }}` said "nothing" on purpose, and handing back its text made the
    empty branch a non-empty string.
  - **Checkbox params written as text are booleans.** `dateConverter({ isUnix: 'false' })` read `'false'` as yes and
    gave an ISO date back raw. Every utility's checkbox params are normalised before its callback runs.
  - **`condition-starts-visible`** warns about a visibility computed from data on an element that starts on screen: it
    is drawn until its provider answers and then hidden — an empty state or a "get started" card flashing past on
    every load. `visible: false` makes it wait hidden. The export reads a visibility binding back in its place, so a
    space whose condition is not its last binding round-trips unchanged.
  - **A source named by its short id inside a binding's template is refused** with the full name, as it already was in
    a flow: `{{ stats.total }}` resolved to nothing and the element showed its empty branch.
  - **`activeOn(class, pageIds)`** marks a menu's current entry from `navigation.currentPageId` — one binding for a menu
    kept in a layout. `variantFrom` now says `append: 'true'`, which is what it did.
  - **Two elements with one id** name where the first one was written. **`template-never-resolved`** warns about a
    condition left in an attribute, which only resolves `{{ name|filter }}` tokens.
  - **The authoring skill is a folder**: `SKILL.md` plus references for layouts, data and visibility, templates,
    flows, structure, testing and a review checklist. `plitzi create` copies all of it, and writes an `AGENTS.md`
    (imported by `CLAUDE.md`) pointing any agent at it.

  - **A new space starts on a page worth keeping.** The space `POST /spaces` and `plitzi create` both begin from is
    redesigned: a top bar with the theme switch, a hero with two calls to action, and six guides — each a card linking to
    its page of the docs (`https://plitzi.com/docs/…`). Every link used to be `#`, and one promised a course that does
    not exist. The palette is a set of light/dark tokens in Geist, the guides are one list mapped to one card, and the
    bands of the page share a `shell` class — the page is written the way the authoring skill asks a space to be.
  - **The copy `plitzi create` writes passes its own project's lint.** An import of the package that would not fit
    120 columns is wrapped one name per line, as the project's formatter would wrap it.

  ## Server actions and scheduled jobs

  **Scheduled jobs across replicas, out of the box, on the database a deployment already runs.** The scheduler and the
  workers were already the package's; where the jobs wait was left to each deployment to write — and a queue is the part
  that is easiest to get subtly wrong. Two helpers now build the adapters over a store the deployment owns, without the
  package opening a connection or keeping data of its own:

  - `@plitzi/sdk-server/mongo` — `createMongoJobQueue({ db })` and `createMongoKv({ db })`, over a `Db` (or a getter for a
    client that reconnects). Creates the indexes its queries need; `mongodb` is an optional peer, used for its types.
  - `@plitzi/sdk-server/mysql` — `createMysqlJobQueue({ pool })` and `createMysqlKv({ pool })`, over a `mysql2` pool.
    Each job is claimed by a single-row compare-and-set, so replicas claiming at once never deadlock. Creates its three
    tables on first use, or hands them to your own migrations through `mysqlJobSchemaStatements()`.

  Every instant is the database server's, never a replica's. The in-process queue and both helpers pass one contract test
  suite: exactly-once enqueue, atomic claims, leases that lapse and are reaped, heartbeats, settlements ignored from a
  worker that lost its claim, refunded hand-backs, schedules advanced by compare-and-set, operator retry and cancel.

  **`closeOnSignals(server, { afterClose })`** closes the server on SIGTERM/SIGINT and exits only once it has — so a
  deploy finishes the jobs a replica is running and leaves the waiting ones for the next. A second signal exits at once.
  Opt-in: a host with its own signal handling calls `server.close()` itself. Projects from `plitzi create` use it.

  **A replica that is told to stop finishes the jobs it is running — and only those.** `server.close()` (and the job
  worker's `stop()`) now waits for every running job to end however long past its lease that is, and keeps renewing
  their claims while it waits. It used to stop renewing the moment the drain began and give up at the lease: a job longer
  than its lease was taken over by another replica and run a second time while the first was still finishing it, and the
  process exited in the middle of it. What is still waiting is not touched — it stays in the shared queue for the replica
  that is staying or the one the deploy starts — and a job claimed in the instant the stop arrived is handed back with its
  attempt refunded, never started. A run is bounded by its own timeout, which is the number an orchestrator's grace period
  has to cover.

  - **An every-minute schedule fired every other minute.** After producing a fire, the scheduler asked for the next
    one from `lateness + 1 minute`, and `cronNextFire` rounds up to a whole minute — so a sweep that ran even a second
    late (with the default 15-second sweep, nearly all of them) skipped the minute it should have produced. It now asks
    from the minute after the one the sweep ran in. Only expressions with consecutive-minute fires were affected;
    hourly and daily schedules were not.
  - **A job that gives up says which step failed and why.** Its `error` and the failed attempt in its history used to
    read "the flow ended failed" for every failure there is; they now read `step "<id>" failed: <message>`, taken from
    the run's outline — already redacted of every credential the run resolved, so nothing reaches the job that the
    run history would not show.
  - **`apiContainer` takes `refreshSeconds`**: it asks again on its own every N seconds, for a page showing something
    still moving — a queue, a feed, a status board. It is the same refresh `performQuery` runs, so it works for both
    runtimes (a browser request is sent again; a server provider asks for its own RSC slice again). It pauses while
    the tab is hidden and never starts a refresh while the last one is in flight. `0`, the default, never does. Before
    this a live server provider needed a plugin element of its own to call `useRscRefresh` on a timer: `onApiSuccess`
    never fires for a server provider, so there was no way to author the loop. The builder shows it as "Refresh every
    (s)" for either runtime.
  - **`onApiSuccess` / `onApiError` fire for a server provider.** The declaration offered them for every
    `apiContainer`, but they were decided from the browser request alone — which a `runtime: 'server'` provider never
    makes — so a flow wired to them never ran. They now fire when the provider's slice arrives (or the payload arrives
    without it), and again on each refresh, the same as a browser refetch. A payload resolved for another page fires
    neither. **A space that wired a flow to one of them will now see it run.**
  - **The theme toggle shows one icon by default.** It renders both — which one is right depends on stored state, and
    markup that depended on it would differ between the server and the browser — and until now every space had to copy
    ten lines of `customCss` to hide the other; one that did not showed a sun and a moon side by side. The SDK's base
    layer now shows the icon of the scheme in use, and a space's own rule still wins.
  - **`variantFrom(cls, source)`** in `@plitzi/sdk-authoring` binds which of a CLASS's variants an element wears to a
    value in the data — a status pill that is amber while a job waits and green once it is done. Written by hand the
    variant key is the trap: it names the selector the variants belong to, and the element's type (`text.base`) is a
    different selector from its class (`statusPill.base`), so the element rendered with no variant and nothing
    reported it. The helper takes the key from the class declaration.
  - **`authorSpace` refuses a flow template that reads a source by its short name.** A binding completes the prefix
    (`jobRows.item.id` → `list_jobRows.item.id`), so the short form is the one an author learns first; a step's params
    are read as written, and there it resolved to nothing — a row's button posted an empty id and every layer below
    reported success. The error names the full source. A root that is a step of the same flow is left alone.
  - New example, [`05-with-server-actions/05-schedules`](../examples/05-with-server-actions/05-schedules): scheduled and
    delayed jobs on a self-hosted server, with the `ActionJobQueue` and `kv` seams written out in full over one SQLite
    file, two replicas sharing it, failover when one is killed, and a board that watches it happen.

  ## Rendering, data and styles
  - **A server element inside a layout is resolved.** `collectServerElements` walked the page alone, so a
    `runtime: 'server'` provider in a layout — a dashboard's sidebar, a section's header — was never resolved: the RSC
    payload came back empty and the element rendered with nothing. It now walks the page and every shell in its layout
    chain.
  - **The twig `date` filter reads an epoch.** `new Date("1790143200000")` is Invalid Date, so an epoch in milliseconds
    handed over as text — how an attribute passes one — formatted as nothing. A number, or a string of digits, is now
    read as milliseconds.
  - **An action is called by its name, not by its trigger kind.** `actionName` took the first trigger's title, and a
    trigger nobody named is titled with its kind — so every rendered action in a workspace read "render" and every clock
    "schedule". A title that only repeats the kind is no longer a name, and `defineAction` titles each trigger with the
    action's name.
  - **`variant` on an element that wears a class is that class's variant** when the class declares it and the type does
    not. Keyed by the type, `text({ class: avatar, variant: 'violet' })` named `text--violet`, a selector nothing wears,
    and rendered with no variant at all. Exporting a document back to authoring reads the same key back into `variant`.
  - **`variantFrom` takes `{ slot, template }`**, where `template` turns a value into a variant name for data that does
    not already speak in them — `"{{ source == 'code' ? 'on' : '' }}"`. The third argument was the slot name alone.
  - **Entry declarations no longer alternate with `export {}`.** In `@plitzi/sdk-server` and `@plitzi/sdk-mcp` a repeated
    `build:dev` left some `dist/<entry>.d.ts` as a ten-byte `export {}`, and consumers saw "has no exported member". The
    cause was `insertTypesEntry` writing a types entry over the real declaration of the same path; it is gone.
  - **Signing in keeps what a guest was doing.** `runtimeStatePersist` reset `runtime.state` whenever its owner changed,
    and a guest becoming a user is a change — so a sign-in screen that remembered where to send somebody (`?redirect=`)
    forgot it the moment the session arrived, and the sign-in ended on the fallback page instead. Only a change FROM an
    account resets now: one account's state still never reaches the next, and a guest has no account to protect.

  **A value with functions inside functions is written as it was given, and fast.** A CSS value was split into layers
  at commas by a pattern that could only see one level of parentheses, so `var(--bg, light-dark(#fff, #111))` was cut at
  its inner comma and half a function went on into the stylesheet. The half was then tokenised by an expression that
  nested one quantifier inside another and backtracked exponentially on it — nearly two seconds for thirty characters,
  on every generation of that selector's cache. Both are now one linear scan that splits only outside parentheses and
  quotes. Generated caches keep the spacing the value was written with inside functions (`repeat(3, minmax(0, 1fr))`,
  `color-mix(in oklab, oklch(…) 50%, transparent)`), where they used to drop it after the first comma.

- Updated dependencies
  - @plitzi/sdk-shared@0.37.2

## 0.37.1

### Patch Changes

- v0.37.1
- Updated dependencies
  - @plitzi/sdk-shared@0.37.1

## 0.37.0

### Minor Changes

- - A `button` takes a `title`: shown as a tooltip, and its accessible name when it has no text of its own — an
    icon-only button without one was announced as nothing. The builder's settings offer it as "Tooltip". The JSON export
    is two files, `schema.json` and `style.json`, shown as tabs; each group of changes in the export folds away.

  - `BindingTransformer.params` is `Record<string, string | number | boolean>`: a param the builder draws as a checkbox
    (`styleVariant`'s `append`) is stored as the boolean it is and read as one, so the type now says so. The MCP compares
    such a param with its catalog options as text. A `container` may be an `li`, for the rows of a list. The export
    keeps every element id with `keepIds`, and the header's Publish dialog opens wider.

  - **The builder exports the space on screen — on paid plans.** **Export** in the header opens a wide dialog: the
    format as tabs (TypeScript in one file, TypeScript with a file per page as a `.zip`, or JSON), generated as soon as
    it is picked, shown read-only in CodeMirror — beside a file list when there are several — with one row of actions,
    **Copy** and **Download**. What the export tidied is a one-line note that unfolds into readable groups. On the free
    plan the dialog explains what export is instead; the server refuses the code with a 402 (`limit: 'spaceExport'`)
    whatever the builder shows. `useSpaceExport` is the one way into it, for anything else that needs the space as files.

  - **A space document can be read back into code.** `specFromSpace(documents)` turns a `{ schema, style }` pair — a
    builder export, a seed checked in as JSON — into the `SpaceSpec` that authors it, and `specToSource(spec, { exportName })`
    writes that spec out as the TypeScript a person would write: one factory call per element, the attributes a type
    already defaults to left out, the longhands the document stores written back as `padding: 10px 20px`, and every class
    something names as a `styles()` declaration held in a variable. `split: true` writes one file per page and per layout.
    `compareSpaces(expected, actual)` proves the round trip: it lists every way two pairs render differently — the tree,
    the attributes, the rules that apply to each element whatever its selector is called, bindings, flows, pages, layouts
    and settings — and nothing else. A selector used by one element becomes that element's own `css`; one shared, or
    spelled out anywhere in the document (a `customCss` rule, a template), stays a class under its own name; an element id
    nothing refers to is left out and derived again.

    What an older builder left behind is repaired on the way, and every repair is reported in `corrections` rather than
    made silently: element types that no longer exist (`navbar` → a `list` laid out in a row, `navbarItem` → `listItem`),
    a hover stored as a class of its own (`card:hover`) folded into the class, fields and attributes no component reads,
    a setting nothing reads, a link `target` of `_blank` (the component adds the underscore, so it rendered as `__blank`),
    `null` or an empty list where an attribute is unset, a binding to a source nothing publishes, a flow with a step that
    runs nothing, and a global callback registered on the wrong module. A CSS property the style editor cannot hold is
    kept in `customCss` under the same selector, so the page still renders it.

  - **What a spec can say grew to what a document holds.** A selector carries its states and variants beside its rules —
    `styles('card', { css, states: { hover }, variants: { active } })`, and `states` on an element's own `css` — and the
    selector cache is now written by `processSelector`, the function the style editor writes it with. An element type's
    defaults (`elements`) take states, variants, per-breakpoint rules and `slots` for its other selectors (a modal's
    `rootContainer`). A space declares `layouts` — shells that pages render inside, named by `layout: { id, slot }` on a
    page or on another layout, with the slot checked to be inside the shell — and a page takes `keepState` and
    `stateStorage`. `visible: false` starts an element hidden for a flow to reveal, and `loadStrategy` is carried through.
    An element's own selector never takes the name of a declared class any more, however that class happens to be called.

  - `elementAttributeNames` lists, as data, the attributes each built-in element can be authored with — `null` for one
    that takes any. It is generated from the elements' attribute types (`yarn generate:attribute-names`) and a type test
    fails when the two disagree. `defaultAttributes(type)` and `defaultLabel(type)` expose what a factory fills in.

  - `CustomAttributes` accepts any attribute, because the component a custom element's `renderType` names reads its own
    attributes off it; and `FormControlAttributes` declares `previewError`, which `withFieldValue` reads.

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.37.0

## 0.36.2

### Patch Changes

- v0.36.2
- Updated dependencies
  - @plitzi/sdk-shared@0.36.2

## 0.36.1

### Patch Changes

- v0.36.1
- Updated dependencies
  - @plitzi/sdk-shared@0.36.1

## 0.36.0

### Minor Changes

- - **An `apiContainer` can keep its browser requests in a query cache, the way react-query does.** Moving between
    sections or pages used to ask the API again every time a provider was shown: a provider in a hidden section is
    mounted but disabled, so showing it fired a fresh request, and a page navigation remounted it and did the same.
    With the new `cache: true` an answer is kept for `staleTime` seconds (30 by default) and shared by every cached
    provider asking the same thing — same method, URL, credentials and headers, the token included, so two visitors
    never share one. Past its time the answer is still drawn at once and a fresh one is fetched behind it; an answer
    nobody shows is forgotten after `gcTime` seconds (300 by default). A refused request (`4xx`/`5xx`) is shown but
    never kept. **The cache is off unless an element asks for it**: an uncached provider behaves as before, asking on
    every mount and sharing nothing.

    The cache is `@plitzi/sdk-shared/queries` (`queryCache`, `useQuery`, `invalidateQueries`,
    `invalidateQueriesForWrite`), a nexus store written with the per-path `ttl` of `@plitzi/nexus` 1.2.0, which every
    consumer now requires. It reacts to the store's own freshness events, so anything that expires a query's path
    makes the providers on screen ask again.

    An answer stops counting as current before its time when the element's `performQuery` runs (it always asks
    again), when a flow runs the new global `invalidateQueries` step (source `queries`: `elements`, api container ids
    — a container's requests are tagged with its own id — and/or a `url` prefix), and after a write. Both write steps
    gained `invalidateQueries` / `invalidateElements`: a `webHook` sent with anything but `GET`/`HEAD` refreshes the
    requests to its own site by default, a completed `runServerAction` refreshes all of them by default, and either
    can name containers instead or refresh nothing. A `writeRecord` refreshes all. Providers on screen ask again at
    once; the rest when they are next shown. A sign-in, sign-out or change of account drops everything held. Server-driven
    providers and RSC are untouched.

  - **A `webHook` that reads can be cached** (`cache`, `staleTime`), in the same cache and under the same key as an api
    container asking the same thing. Its declaration now lives beside it (`utility/webHookSpec`) and the authoring
    catalog gathers it instead of keeping a copy. A `HEAD` is no longer sent with a body, which `fetch` refused.

  - **Step params can pick several elements.** A new param type, `elementIds` (with an `elementType` filter), is drawn
    in the flow editor as a picker: the matching elements of the space to add, and the picked ones as chips to remove —
    an id no element answers to any more is kept and flagged. The value is a list of ids, so nobody types a
    comma-separated list; `invalidateQueries.elements` and the write steps' `invalidateElements` use it, and the MCP
    catalog says which element type each such param takes.

  - The dev-tools' Store tab lists the paths a store holds with a TTL — how long ago each was written, what is left
    of it, and a button to expire one or all of them. The query cache appears there as "Queries".

  - `useApi` no longer takes `params`: nothing passed them, and a GET cannot carry a body anyway. A mock now answers
    synchronously, without a loading frame, and a provider whose URL has not resolved asks for nothing.

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.36.0

## 0.35.10

### Patch Changes

- **Breaking:** the space setting that lets a published site open the dev tools is now `settings.debugMode`, and
  `settings.devTools` is gone.

  It was always the same decision the SDK and the page server call `debugMode` — whether the dev-tools panel is
  authorized — and having a third name for it invited confusing it with `devMode`, which is a different thing: it turns a
  deployment into a development server (the unminified bundles, request timings, and the full action trace with every
  step's results). A space can authorize debugging for its own site; it can never make its server a development one.

  A space that stored `settings.devTools` needs it moved to `settings.debugMode`; nothing reads the old key.

- Updated dependencies
  - @plitzi/sdk-shared@0.35.10

## 0.35.9

### Patch Changes

- Debug a server action's whole flow from the dev-tools, not just its answer.

  A run now reports an OUTLINE of what it did: every step in order, with its task, how it ended, how long it took, and
  the redacted error of the one that broke the flow — the compensation steps `flow.onFailure` ran included. It carries
  nothing a step was given or returned, so it goes to any page whose debugging the deployment authorized (`devMode`, or
  a space that switched dev tools on for its published site) and to no other. The full trace, with each step's results,
  still reaches only an authoring request or a development server.

  Runs the SERVER started while rendering a page — the ones feeding `runtime: 'server'` elements — reach the dev-tools
  too, seeded into the page and added to by every `/_rsc` refresh, under the same authorization: a page nobody
  authorized is not told they happened. A response carrying them is never cached. A run that died on its deadline now
  reports the step it was on rather than nothing at all.

  The Actions tab was rebuilt around it: filters and search over the log, a run list that names the step that broke,
  and a detail panel with the flow's timeline, its compensation shown apart, and what the run carried in and out.

- Updated dependencies
  - @plitzi/sdk-shared@0.35.9

## 0.35.8

### Patch Changes

- A space can switch the dev tools on for its own published site.

  - **`settings.devTools`** in the space schema, set from the builder's Settings panel ("Dev tools on the published SSR
    site (*.plitzi.app)"). It applies to sites served with SSR — usually a space's `*.plitzi.app` address, or a custom
    domain pointed at it. A page server that left `debugMode` unset now authorizes debugging for a space that asked for it, as it
    already did in `devMode`. A server that sets `debugMode` still decides for every space, and `false` cannot be
    turned around by a space. Preview renders stay undebuggable either way.
  - The space is read from the schema the server loaded, never from the request, and the visitor's cookie can still
    only hide the panel.
  - **The HTML cache keys whether a visitor hid the dev tools.** A cached page on a published environment used to be
    keyed on the theme alone, so on a page authorizing dev tools the first visitor's choice — panel or no panel — was
    served to everybody after them.

- Updated dependencies
  - @plitzi/sdk-shared@0.35.8

## 0.35.7

### Patch Changes

- An SMTP failure says which credential it was, and a credential's values can be replaced from the builder.

  - **`email.send` names the credential it could not send through:** `Could not send through the SMTP credential
"ceniza-smtp": its SMTP host is on a private network…`. The host used to be in the sentence, and a run's trace
    redacts every value of a credential it resolved, so the message read `The SMTP host "«redacted»"…`.
  - **Credentials can be edited in the builder.** A pencil on each row opens the form with the name and the provider
    fixed and nothing it holds shown: every value is entered again, and saving replaces all of them. SMTP credentials
    are also labelled in the list.

- Updated dependencies
  - @plitzi/sdk-shared@0.35.7

## 0.35.6

### Patch Changes

- A failed server action can give back what it already did.

  - **`flow.onFailure` ("On Failure") marks where the undo begins.** A run that reaches it has succeeded and ends there.
    A run whose step failed jumps to it and runs the steps after it, in order, each still asking its own `when` — the
    failure may have come before the thing to undo was ever done — with `{{ failure.step }}` and `{{ failure.message }}`
    in scope. The run still ends failed, with the failure it had; an undo step that fails too is added to it.
  - **The undo runs on its own clock and budget:** 5 seconds (or the run's own timeout if shorter) and its own outbound
    request budget, because the run's may be exactly what ran out, and a caller closing the connection does not stop it.
    A run that hit its deadline is undone too.
  - **`defineAction` writes it from `onFailure: [...]`**, after the answer. `validateActionDocument` refuses an output
    step or a second handler after one, warns about a handler with nothing to undo or nothing that undoes, and reserves
    `failure` as a step id. `FAILURE_HANDLER_TASK` is exported from `@plitzi/sdk-shared/actions`.

- Updated dependencies
  - @plitzi/sdk-shared@0.35.6

## 0.35.5

### Patch Changes

- v0.35.5
- Updated dependencies
  - @plitzi/sdk-shared@0.35.5

## 0.35.4

### Patch Changes

- v0.35.4
- Updated dependencies
  - @plitzi/sdk-shared@0.35.4

## 0.35.3

### Patch Changes

- 0211dc4: A form speaks the site's language when it refuses a value.

  - **Every rule of a `formControl` can say what it wants to say.** `requiredMessage`, `minLengthMessage`,
    `maxLengthMessage` and `formatMessage` join `patternMessage` and `matchesMessage`; left empty, each falls back to
    the English sentence it said before. `formatMessage` is said when the value does not have the shape the control's
    type asks for — an address, for an `email` — one attribute for every type that has a shape. Offered in the builder under the rule they belong to.
  - **A `form` can turn the browser's own checks off (`noValidate`, "Skip Browser Validation" in the builder).** Left on
    — the default, as before — the browser answers first for a blank required field and a malformed address, in a
    bubble no style reaches and in the browser's language, while every other rule answers under the control. Turned
    on, the form's rules are the only ones, and all of them answer under the control.
  - **An `email` control checks the address itself,** by the same definition the browser uses, so the format is still
    asked for when the browser's checks are off.

- Updated dependencies [0211dc4]
  - @plitzi/sdk-shared@0.35.3

## 0.35.2

### Patch Changes

- v0.35.2
- Updated dependencies
- Updated dependencies [470aaf8]
  - @plitzi/sdk-shared@0.35.2

## 0.35.1

### Patch Changes

- v0.35.1
- Updated dependencies
  - @plitzi/sdk-shared@0.35.1

## 0.35.0

### Minor Changes

- v0.35.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.35.0

## 0.34.1

### Patch Changes

- cba7b8b: Build tools no longer install with the SDK.

  `@plitzi/plitzi-sdk` listed `vite`, `vite-plugin-dts` and `vite-plugin-react` as runtime dependencies, and
  `@plitzi/sdk-variables` listed `eslint` — so every project depending on the SDK installed a bundler, a type bundler,
  a Babel 7 toolchain and a deprecated `eslint@9` it never runs. They are build-time only: `vite` and `vite-plugin-dts`
  move to `devDependencies`, the unused `vite-plugin-react` is removed, `@vitejs/plugin-react` (which the build
  config does import) is now declared, and `eslint` is dropped from `sdk-variables`' runtime list.

- v0.34.1
- Updated dependencies
  - @plitzi/sdk-shared@0.34.1

## 0.34.0

### Minor Changes

- v0.34.0

### Patch Changes

- Updated dependencies [5aceda0]
- Updated dependencies
- Updated dependencies [5aceda0]
  - @plitzi/sdk-shared@0.34.0

## 0.33.2

### Patch Changes

- v0.33.2
- Updated dependencies
  - @plitzi/sdk-shared@0.33.2

## 0.33.1

### Patch Changes

- v0.33.1
- Updated dependencies
  - @plitzi/sdk-shared@0.33.1

## 0.33.0

### Minor Changes

- v0.33.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.33.0

## 0.32.25

### Patch Changes

- v0.32.25
- Updated dependencies
  - @plitzi/sdk-shared@0.32.25

## 0.32.24

### Patch Changes

- v0.32.24
- Updated dependencies
  - @plitzi/sdk-shared@0.32.24

## 0.32.23

### Patch Changes

- v0.32.23
- Updated dependencies
  - @plitzi/sdk-shared@0.32.23

## 0.32.22

### Patch Changes

- v0.32.22
- Updated dependencies
  - @plitzi/sdk-shared@0.32.22

## 0.32.21

### Patch Changes

- v0.32.21
- Updated dependencies
  - @plitzi/sdk-shared@0.32.21

## 0.32.20

### Patch Changes

- v0.32.20
- Updated dependencies
  - @plitzi/sdk-shared@0.32.20

## 0.32.19

### Patch Changes

- v0.32.19
- Updated dependencies
  - @plitzi/sdk-shared@0.32.19

## 0.32.18

### Patch Changes

- v0.32.18
- Updated dependencies
  - @plitzi/sdk-shared@0.32.18

## 0.32.17

### Patch Changes

- v0.32.17
- Updated dependencies
  - @plitzi/sdk-shared@0.32.17

## 0.32.16

### Patch Changes

- v0.32.16
- Updated dependencies
  - @plitzi/sdk-shared@0.32.16

## 0.32.15

### Patch Changes

- v0.32.15
- Updated dependencies
  - @plitzi/sdk-shared@0.32.15

## 0.32.14

### Patch Changes

- v0.32.14
- Updated dependencies
  - @plitzi/sdk-shared@0.32.14

## 0.32.13

### Patch Changes

- v0.32.13
- Updated dependencies
  - @plitzi/sdk-shared@0.32.13

## 0.32.12

### Patch Changes

- v0.32.12
- Updated dependencies
  - @plitzi/sdk-shared@0.32.12

## 0.32.11

### Patch Changes

- v0.32.11
- Updated dependencies
  - @plitzi/sdk-shared@0.32.11

## 0.32.10

### Patch Changes

- v0.32.10
- Updated dependencies
  - @plitzi/sdk-shared@0.32.10

## 0.32.9

### Patch Changes

- v0.32.9
- Updated dependencies
  - @plitzi/sdk-shared@0.32.9

## 0.32.8

### Patch Changes

- v0.32.8
- Updated dependencies
  - @plitzi/sdk-shared@0.32.8

## 0.32.7

### Patch Changes

- v0.32.7
- Updated dependencies
  - @plitzi/sdk-shared@0.32.7

## 0.32.6

### Patch Changes

- v0.32.6
- Updated dependencies
  - @plitzi/sdk-shared@0.32.6

## 0.32.5

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/sdk-shared@0.32.5

## 0.32.4

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/sdk-shared@0.32.4

## 0.32.3

### Patch Changes

- v0.32.3
- Updated dependencies
  - @plitzi/sdk-shared@0.32.3

## 0.32.2

### Patch Changes

- v0.32.2
- Updated dependencies
  - @plitzi/sdk-shared@0.32.2

## 0.32.1

### Patch Changes

- v0.32.1
- Updated dependencies
  - @plitzi/sdk-shared@0.32.1

## 0.32.0

### Minor Changes

- v0.32.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.32.0

## 0.31.2

### Patch Changes

- v0.31.2
- Updated dependencies
  - @plitzi/sdk-shared@0.31.2

## 0.31.1

### Patch Changes

- v0.31.1
- Updated dependencies
  - @plitzi/sdk-shared@0.31.1

## 0.31.0

### Minor Changes

- v0.31.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.31.0

## 0.30.19

### Patch Changes

- v0.30.19
- Updated dependencies
  - @plitzi/sdk-shared@0.30.19

## 0.30.18

### Patch Changes

- v0.30.18
- Updated dependencies
  - @plitzi/sdk-shared@0.30.18

## 0.30.17

### Patch Changes

- v0.31.0
- Updated dependencies
  - @plitzi/sdk-shared@0.30.17

## 0.30.16

### Patch Changes

- v0.30.16
- Updated dependencies
  - @plitzi/sdk-shared@0.30.16

## 0.30.15

### Patch Changes

- v0.30.15
- Updated dependencies
  - @plitzi/sdk-shared@0.30.15

## 0.30.14

### Patch Changes

- v0.30.14
- Updated dependencies
  - @plitzi/sdk-shared@0.30.14

## 0.30.13

### Patch Changes

- v0.30.13
- Updated dependencies
  - @plitzi/sdk-shared@0.30.13

## 0.30.12

### Patch Changes

- v0.30.12
- Updated dependencies
  - @plitzi/sdk-shared@0.30.12

## 0.30.11

### Patch Changes

- v0.30.11
- Updated dependencies
  - @plitzi/sdk-shared@0.30.11

## 0.30.10

### Patch Changes

- v0.30.10
- Updated dependencies
  - @plitzi/sdk-shared@0.30.10

## 0.30.9

### Patch Changes

- v0.30.9
- Updated dependencies
  - @plitzi/sdk-shared@0.30.9

## 0.30.8

### Patch Changes

- v0.30.8
- Updated dependencies
  - @plitzi/sdk-shared@0.30.8

## 0.30.7

### Patch Changes

- v0.30.7
- Updated dependencies
  - @plitzi/sdk-shared@0.30.7

## 0.30.6

### Patch Changes

- v0.30.6
- Updated dependencies
  - @plitzi/sdk-shared@0.30.6

## 0.30.5

### Patch Changes

- v0.30.5
- Updated dependencies
  - @plitzi/sdk-shared@0.30.5

## 0.30.4

### Patch Changes

- v0.30.4
- Updated dependencies
  - @plitzi/sdk-shared@0.30.4

## 0.30.3

### Patch Changes

- v0.30.3
- Updated dependencies
  - @plitzi/sdk-shared@0.30.3

## 0.30.2

### Patch Changes

- v0.30.2
- Updated dependencies
  - @plitzi/sdk-shared@0.30.2

## 0.30.1

### Patch Changes

- v0.30.1
- Updated dependencies
  - @plitzi/sdk-shared@0.30.1

## 0.30.0

### Minor Changes

- v0.30.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.30.0

## 0.29.0

### Minor Changes

- v0.29.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.29.0

## 0.28.14

### Patch Changes

- v0.28.14
- Updated dependencies
  - @plitzi/sdk-shared@0.28.14

## 0.28.13

### Patch Changes

- v0.28.13
- Updated dependencies
  - @plitzi/sdk-shared@0.28.13

## 0.28.12

### Patch Changes

- v0.28.12
- Updated dependencies
  - @plitzi/sdk-shared@0.28.12

## 0.28.11

### Patch Changes

- v0.28.11
- Updated dependencies
  - @plitzi/sdk-shared@0.28.11

## 0.28.10

### Patch Changes

- v0.28.10
- Updated dependencies
  - @plitzi/sdk-shared@0.28.10

## 0.28.9

### Patch Changes

- v0.28.9
- Updated dependencies
  - @plitzi/sdk-shared@0.28.9

## 0.28.8

### Patch Changes

- v0.28.8
- Updated dependencies
  - @plitzi/sdk-shared@0.28.8

## 0.28.7

### Patch Changes

- v0.28.7
- Updated dependencies
  - @plitzi/sdk-shared@0.28.7

## 0.28.6

### Patch Changes

- v0.28.6
- Updated dependencies
  - @plitzi/sdk-shared@0.28.6

## 0.28.5

### Patch Changes

- v0.28.5
- Updated dependencies
  - @plitzi/sdk-shared@0.28.5

## 0.28.4

### Patch Changes

- v0.28.4
- Updated dependencies
  - @plitzi/sdk-shared@0.28.4

## 0.28.3

### Patch Changes

- v0.28.3
- Updated dependencies
  - @plitzi/sdk-shared@0.28.3

## 0.28.2

### Patch Changes

- v0.28.2
- Updated dependencies
  - @plitzi/sdk-shared@0.28.2

## 0.28.1

### Patch Changes

- v0.28.1
- Updated dependencies
  - @plitzi/sdk-shared@0.28.1

## 0.28.0

### Minor Changes

- v0.28.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.28.0

## 0.27.23

### Patch Changes

- v0.27.23
- Updated dependencies
  - @plitzi/sdk-shared@0.27.23

## 0.27.22

### Patch Changes

- v0.27.22
- Updated dependencies
  - @plitzi/sdk-shared@0.27.22

## 0.27.21

### Patch Changes

- v0.27.21
- Updated dependencies
  - @plitzi/sdk-shared@0.27.21

## 0.27.20

### Patch Changes

- v0.27.20
- Updated dependencies
  - @plitzi/sdk-shared@0.27.20

## 0.27.19

### Patch Changes

- v0.27.19
- Updated dependencies
  - @plitzi/sdk-shared@0.27.19

## 0.27.18

### Patch Changes

- v0.27.18
- Updated dependencies
  - @plitzi/sdk-shared@0.27.18

## 0.27.17

### Patch Changes

- v0.27.17
- Updated dependencies
  - @plitzi/sdk-shared@0.27.17

## 0.27.16

### Patch Changes

- v0.27.16
- Updated dependencies
  - @plitzi/sdk-shared@0.27.16

## 0.27.15

### Patch Changes

- v0.27.15
- Updated dependencies
  - @plitzi/sdk-shared@0.27.15

## 0.27.14

### Patch Changes

- v0.27.14
- Updated dependencies
  - @plitzi/sdk-shared@0.27.14

## 0.27.13

### Patch Changes

- v0.27.13
- Updated dependencies
  - @plitzi/sdk-shared@0.27.13

## 0.27.12

### Patch Changes

- v0.27.12
- Updated dependencies
  - @plitzi/sdk-shared@0.27.12

## 0.27.11

### Patch Changes

- v0.27.11
- Updated dependencies
  - @plitzi/sdk-shared@0.27.11

## 0.27.10

### Patch Changes

- v0.27.10
- Updated dependencies
  - @plitzi/sdk-shared@0.27.10

## 0.27.9

### Patch Changes

- v0.27.9
- Updated dependencies
  - @plitzi/sdk-shared@0.27.9

## 0.27.8

### Patch Changes

- v0.27.8
- Updated dependencies
  - @plitzi/sdk-shared@0.27.8

## 0.27.7

### Patch Changes

- v0.27.7
- Updated dependencies
  - @plitzi/sdk-shared@0.27.7

## 0.27.6

### Patch Changes

- v0.27.6
- Updated dependencies
  - @plitzi/sdk-shared@0.27.6

## 0.27.5

### Patch Changes

- v0.27.5
- Updated dependencies
  - @plitzi/sdk-shared@0.27.5

## 0.27.4

### Patch Changes

- v0.27.4
- Updated dependencies
  - @plitzi/sdk-shared@0.27.4

## 0.27.3

### Patch Changes

- v0.27.3
- Updated dependencies
  - @plitzi/sdk-shared@0.27.3

## 0.27.2

### Patch Changes

- v0.27.2
- Updated dependencies
  - @plitzi/sdk-shared@0.27.2

## 0.27.1

### Patch Changes

- v0.27.1
- Updated dependencies
  - @plitzi/sdk-shared@0.27.1

## 0.27.0

### Minor Changes

- v0.27.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.27.0

## 0.26.5

### Patch Changes

- v0.26.5
- Updated dependencies
  - @plitzi/sdk-shared@0.26.5

## 0.26.4

### Patch Changes

- v0.26.4
- Updated dependencies
  - @plitzi/sdk-shared@0.26.4

## 0.26.3

### Patch Changes

- v0.26.3
- Updated dependencies
  - @plitzi/sdk-shared@0.26.3

## 0.26.2

### Patch Changes

- v0.26.2
- Updated dependencies
  - @plitzi/sdk-shared@0.26.2

## 0.26.1

### Patch Changes

- v0.26.1
- Updated dependencies
  - @plitzi/sdk-shared@0.26.1

## 0.26.0

### Minor Changes

- v0.26.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.26.0

## 0.25.12

### Patch Changes

- v0.25.12
- Updated dependencies
  - @plitzi/sdk-shared@0.25.12

## 0.25.11

### Patch Changes

- v0.25.11
- Updated dependencies
  - @plitzi/sdk-shared@0.25.11

## 0.25.10

### Patch Changes

- v0.25.10
- Updated dependencies
  - @plitzi/sdk-shared@0.25.10

## 0.25.9

### Patch Changes

- v0.25.9
- Updated dependencies
  - @plitzi/sdk-shared@0.25.9

## 0.25.8

### Patch Changes

- v0.25.8
- Updated dependencies
  - @plitzi/sdk-shared@0.25.8

## 0.25.7

### Patch Changes

- v0.25.7
- Updated dependencies
  - @plitzi/sdk-shared@0.25.7

## 0.25.6

### Patch Changes

- v0.25.6
- Updated dependencies
  - @plitzi/sdk-shared@0.25.6

## 0.25.5

### Patch Changes

- v0.25.5
- Updated dependencies
  - @plitzi/sdk-shared@0.25.5

## 0.25.4

### Patch Changes

- v0.25.4
- Updated dependencies
  - @plitzi/sdk-shared@0.25.4

## 0.25.3

### Patch Changes

- v0.25.3
- Updated dependencies
  - @plitzi/sdk-shared@0.25.3

## 0.25.2

### Patch Changes

- v0.25.2
- Updated dependencies
  - @plitzi/sdk-shared@0.25.2

## 0.25.1

### Patch Changes

- v0.25.1
- Updated dependencies
  - @plitzi/sdk-shared@0.25.1

## 0.25.0

### Minor Changes

- v0.25.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.25.0

## 0.24.12

### Patch Changes

- v0.24.12
- Updated dependencies
  - @plitzi/sdk-shared@0.24.12

## 0.24.11

### Patch Changes

- v0.24.11
- Updated dependencies
  - @plitzi/sdk-shared@0.24.11

## 0.24.10

### Patch Changes

- v0.24.10
- Updated dependencies
  - @plitzi/sdk-shared@0.24.10

## 0.24.9

### Patch Changes

- v0.24.9
- Updated dependencies
  - @plitzi/sdk-shared@0.24.9

## 0.24.8

### Patch Changes

- v0.24.8
- Updated dependencies
  - @plitzi/sdk-shared@0.24.8

## 0.24.7

### Patch Changes

- v0.24.7
- Updated dependencies
  - @plitzi/sdk-shared@0.24.7

## 0.24.6

### Patch Changes

- v0.24.6
- Updated dependencies
  - @plitzi/sdk-shared@0.24.6

## 0.24.5

### Patch Changes

- v0.24.5
- Updated dependencies
  - @plitzi/sdk-shared@0.24.5

## 0.24.4

### Patch Changes

- v0.24.4
- Updated dependencies
  - @plitzi/sdk-shared@0.24.4

## 0.24.3

### Patch Changes

- v0.24.3
- Updated dependencies
  - @plitzi/sdk-shared@0.24.3

## 0.24.2

### Patch Changes

- v0.24.2
- Updated dependencies
  - @plitzi/sdk-shared@0.24.2

## 0.24.1

### Patch Changes

- v0.24.1
- Updated dependencies
  - @plitzi/sdk-shared@0.24.1

## 0.24.0

### Minor Changes

- v0.24.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.24.0

## 0.23.24

### Patch Changes

- v0.23.24
- Updated dependencies
  - @plitzi/sdk-shared@0.23.24

## 0.23.23

### Patch Changes

- v0.23.23
- Updated dependencies
  - @plitzi/sdk-shared@0.23.23

## 0.23.22

### Patch Changes

- v0.23.22
- Updated dependencies
  - @plitzi/sdk-shared@0.23.22

## 0.23.21

### Patch Changes

- v0.23.21
- Updated dependencies
  - @plitzi/sdk-shared@0.23.21

## 0.23.20

### Patch Changes

- v0.23.20
- Updated dependencies
  - @plitzi/sdk-shared@0.23.20

## 0.23.19

### Patch Changes

- v0.23.19
- Updated dependencies
  - @plitzi/sdk-shared@0.23.19

## 0.23.18

### Patch Changes

- v0.23.18
- Updated dependencies
  - @plitzi/sdk-shared@0.23.18

## 0.23.17

### Patch Changes

- v0.23.17
- Updated dependencies
  - @plitzi/sdk-shared@0.23.17

## 0.23.16

### Patch Changes

- v0.23.16
- Updated dependencies
  - @plitzi/sdk-shared@0.23.16

## 0.23.15

### Patch Changes

- v0.23.15
- Updated dependencies
  - @plitzi/sdk-shared@0.23.15

## 0.23.14

### Patch Changes

- v0.23.14
- Updated dependencies
  - @plitzi/sdk-shared@0.23.14

## 0.23.13

### Patch Changes

- v0.23.13
- Updated dependencies
  - @plitzi/sdk-shared@0.23.13

## 0.23.12

### Patch Changes

- v0.23.12
- Updated dependencies
  - @plitzi/sdk-shared@0.23.12

## 0.23.11

### Patch Changes

- v0.23.11
- Updated dependencies
  - @plitzi/sdk-shared@0.23.11

## 0.23.10

### Patch Changes

- v0.23.10
- Updated dependencies
  - @plitzi/sdk-shared@0.23.10

## 0.23.9

### Patch Changes

- v0.23.9
- Updated dependencies
  - @plitzi/sdk-shared@0.23.9

## 0.23.8

### Patch Changes

- v0.23.8
- Updated dependencies
  - @plitzi/sdk-shared@0.23.8

## 0.23.7

### Patch Changes

- v0.23.7
- Updated dependencies
  - @plitzi/sdk-shared@0.23.7

## 0.23.6

### Patch Changes

- v0.23.6
- Updated dependencies
  - @plitzi/sdk-shared@0.23.6

## 0.23.5

### Patch Changes

- v0.23.5
- Updated dependencies
  - @plitzi/sdk-shared@0.23.5

## 0.23.4

### Patch Changes

- v0.23.4
- Updated dependencies
  - @plitzi/sdk-shared@0.23.4

## 0.23.3

### Patch Changes

- v0.23.3
- Updated dependencies
  - @plitzi/sdk-shared@0.23.3

## 0.23.2

### Patch Changes

- v0.23.2
- Updated dependencies
  - @plitzi/sdk-shared@0.23.2

## 0.23.1

### Patch Changes

- v0.23.1
- Updated dependencies
  - @plitzi/sdk-shared@0.23.1

## 0.23.0

### Minor Changes

- v0.23.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.23.0

## 0.22.20

### Patch Changes

- v0.22.20
- Updated dependencies
  - @plitzi/sdk-shared@0.22.20

## 0.22.19

### Patch Changes

- v0.22.19
- Updated dependencies
  - @plitzi/sdk-shared@0.22.19

## 0.22.18

### Patch Changes

- v0.22.18
- Updated dependencies
  - @plitzi/sdk-shared@0.22.18

## 0.22.17

### Patch Changes

- v0.22.17
- Updated dependencies
  - @plitzi/sdk-shared@0.22.17

## 0.22.16

### Patch Changes

- v0.22.16
- Updated dependencies
  - @plitzi/sdk-shared@0.22.16

## 0.22.15

### Patch Changes

- v0.22.15
- Updated dependencies
  - @plitzi/sdk-shared@0.22.15

## 0.22.14

### Patch Changes

- v0.22.14
- Updated dependencies
  - @plitzi/sdk-shared@0.22.14

## 0.22.13

### Patch Changes

- v0.22.13
- Updated dependencies
  - @plitzi/sdk-shared@0.22.13

## 0.22.12

### Patch Changes

- v0.22.12
- Updated dependencies
  - @plitzi/sdk-shared@0.22.12

## 0.22.11

### Patch Changes

- v0.22.11
- Updated dependencies
  - @plitzi/sdk-shared@0.22.11

## 0.22.10

### Patch Changes

- v0.22.10
- Updated dependencies
  - @plitzi/sdk-shared@0.22.10

## 0.22.9

### Patch Changes

- v0.22.9
- Updated dependencies
  - @plitzi/sdk-shared@0.22.9

## 0.22.8

### Patch Changes

- v0.22.8
- Updated dependencies
  - @plitzi/sdk-shared@0.22.8

## 0.22.7

### Patch Changes

- v0.22.7
- Updated dependencies
  - @plitzi/sdk-shared@0.22.7

## 0.22.6

### Patch Changes

- v0.22.6
- Updated dependencies
  - @plitzi/sdk-shared@0.22.6

## 0.22.5

### Patch Changes

- v0.22.5
- Updated dependencies
  - @plitzi/sdk-shared@0.22.5

## 0.22.4

### Patch Changes

- v0.22.4
- Updated dependencies
  - @plitzi/sdk-shared@0.22.4
