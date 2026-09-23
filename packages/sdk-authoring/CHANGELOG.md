# @plitzi/sdk-authoring

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

## 0.37.1

### Patch Changes

- v0.37.1

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

## 0.36.2

### Patch Changes

- v0.36.2

## 0.36.1

### Patch Changes

- v0.36.1

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

## 0.35.10

### Patch Changes

- **Breaking:** the space setting that lets a published site open the dev tools is now `settings.debugMode`, and
  `settings.devTools` is gone.

  It was always the same decision the SDK and the page server call `debugMode` — whether the dev-tools panel is
  authorized — and having a third name for it invited confusing it with `devMode`, which is a different thing: it turns a
  deployment into a development server (the unminified bundles, request timings, and the full action trace with every
  step's results). A space can authorize debugging for its own site; it can never make its server a development one.

  A space that stored `settings.devTools` needs it moved to `settings.debugMode`; nothing reads the old key.

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

## 0.35.7

### Patch Changes

- An SMTP failure says which credential it was, and a credential's values can be replaced from the builder.

  - **`email.send` names the credential it could not send through:** `Could not send through the SMTP credential
"ceniza-smtp": its SMTP host is on a private network…`. The host used to be in the sentence, and a run's trace
    redacts every value of a credential it resolved, so the message read `The SMTP host "«redacted»"…`.
  - **Credentials can be edited in the builder.** A pencil on each row opens the form with the name and the provider
    fixed and nothing it holds shown: every value is entered again, and saving replaces all of them. SMTP credentials
    are also labelled in the list.

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

## 0.35.5

### Patch Changes

- v0.35.5

## 0.35.4

### Patch Changes

- v0.35.4

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

## 0.35.2

### Minor Changes

- 470aaf8: A booking form can ask for a date, and a toggle can say it is one.

  - **`formControl` accepts `subType: 'date'`.** It renders the browser's own date picker and submits `YYYY-MM-DD`, so
    a flow or a server action reads one format whatever the visitor's locale. Until now a date was a free text field
    and every form that needed one parsed whatever somebody typed. Offered in the builder's Input Type list.
  - **`button` accepts `ariaExpanded` and `ariaPressed`.** A button that opens a menu or an answer, or one that stays on
    like a filter, can tell assistive technology so — statically, or bound to the state it flips
    (`bind: { ariaExpanded: 'state.menuOpen' }`). Left out, neither attribute is rendered: an ordinary button does not
    claim to control anything.

- 470aaf8: The theme is a data source, and a binding reads every source its template names.

  - **`theme` global source.** `GlobalSources` publishes `runtime.sources.theme` as `{ mode, resolved }` for the area
    the space paints in. `resolved` is always `light` or `dark`, so `{{ theme.resolved }}` is what a URL or a `when`
    rule wants — a dashboard asking the API for a thumbnail in the visitor's scheme, for one. The comments that promised
    `{{ theme.resolved }}` through the app store's `theme` mirror were wrong: nothing a binding reads lives there.
  - **A binding subscribes to the roots of its `twigTemplate`.** It used to get only the head of its `source`, so a
    binding on `list_spaces.item.id` whose template also said `{{ theme.resolved }}` or `{{ state.scope }}` resolved the
    second name to nothing, silently. The names are read off the parsed template (`templateRootNames`, exported from
    `@plitzi/sdk-shared/helpers/twigWrapper`). A name that is not a source is left out of the map rather than set to
    `undefined`, so `{{ source }}` and the variables lifted to the template's root are never shadowed.
  - **Authoring.** `theme` joins `GLOBAL_SOURCES`: `bind: { src: 'theme.resolved' }` is accepted, and an element can no
    longer be named `theme`.

### Patch Changes

- v0.35.2

## 0.35.1

### Patch Changes

- v0.35.1

## 0.35.0

### Minor Changes

- cba7b8b: Authoring catches the tablet-only rule, declares fonts, and tells a test which pages and elements a visit can see.

  - **`tablet-rule-skips-mobile` warning.** `tablet` compiles to 48–64rem and `mobile` to below 48rem, and each
    inherits only from `desktop`. So a rule written for tablet and not for mobile hands phones the desktop value back —
    a layout that collapsed at tablet came back as desktop columns on a phone, with every check passing. `authorSpace`
    now warns, naming the class or element and the properties. The skill and `ResponsiveCss` say the same, and the
    blank space every new space starts from — which had exactly this bug on its page and its cards — now carries
    mobile rules.
  - **`fonts` on `SpaceSpec`.** The page server loads only the faces `style.fonts` lists, and a space authored in code
    had no way to list one, so a `font-family` silently rendered in its fallback. `fonts` goes through the same
    `parseSpaceFont` as any manifest, and a malformed face is refused by index and family. `SpaceFont` is exported.
  - **Handles for a suite that only opens pages.** `PageHandle` gains `accessLevel` and `params` (the route params its
    slug declares), and `ElementHandle` gains `conditional` — present, and `true`, only when the element or anything
    above it has a `visible` condition. `plitzi create`'s visual test uses them to skip what a bare visit cannot show.

### Patch Changes

- v0.34.1

## 0.34.0

### Minor Changes

- 2c89e00: **Page folders, which are a routing decision and not a filing one.**

  `authorSpace` wrote `pageFolders: []` on every document it produced, so a space authored in code could not put a
  page under a path prefix at all — and a folder's slug is what turns `quickstart` into `/docs/quickstart`. The
  builder's page tree was the visible half; the URL was the half that could not be expressed.

  ```ts
  const space: SpaceSpec = {
    name: 'My Site',
    permanentUrl: 'my-site',
    pageFolders: [
      { id: 'docs', name: 'Docs', slug: 'docs' },
      { id: 'api', name: 'API', slug: 'reference', parent: 'docs' }
    ],
    pages: [
      { id: 'guide', name: 'Guide', slug: 'quickstart', folder: 'docs', body: [] }, // → /docs/quickstart
      { id: 'ref', name: 'Elements', slug: 'elements', folder: 'api', body: [] } // → /docs/reference/elements
    ]
  };
  ```

  `name` and `slug` default to the id. `handles.page(id).path` is the route the page answers at, prefix included, so
  a test navigates to what the router will actually serve rather than to the slug.

  Refused where it is written, not discovered as a page answering at the wrong URL: a page naming a folder the space
  does not declare (with the name you probably meant), a folder inside a folder that is not there, and a folder
  declared inside itself.

  A section's own landing page sits **beside** its folder rather than inside it. A folder contributes one path
  segment and a page contributes another, so there is no way to spell "the folder itself" from within one — a page
  with an empty slug inside `docs` falls back to its id and answers at `/docs/docs-index`. Give it the folder's slug
  and no folder, and it answers at `/docs`.

- 5aceda0: `authorSpace` returns test handles, and every element carries its id in the DOM.

  An end-to-end suite had nothing stable to address a rendered element by: a class is a styling decision that
  changes with the design, a text match breaks when the copy is edited, and an `nth-child` chain is invalidated by
  inserting a section above. What does not move is the element's id — which is also its name, chosen by whoever
  authored it and unique across the document.

  ```ts
  const { schema, style, handles } = authorSpace(spec);
  const el = locate(page, handles);

  await expect(el('hero-title')).toBeVisible();
  await page.goto(handles.page('pricing').path);
  ```

  Elements now render `data-plitzi-el="<id>"`. It ships by default — the ids are already in the page, since the
  schema the browser hydrates from carries every one of them — and a deployment turns it off with
  `render.testAttributes: false`.

  Each handle reports whether the AUTHOR wrote the id or authoring derived a positional `<type>-<n>`, which is
  what makes one generic assertion possible for any space: everything a space names must be on screen. A name that
  does not exist throws at author time with a suggestion, rather than resolving to an empty locator at test time.

- v0.34.0
- 9c3292c: `plitzi create` — a project that renders a space, with nothing to sign up for.

  ```bash
  npx @plitzi/cli create my-site
  ```

  Two decisions shape it: `--mode server|client` (a page server of your own, or the SDK in the browser with no
  server at all) and `--source local|cloud` (the space travels in the project, or is read live out of Plitzi). It
  installs the project and leaves it ready to start.

  **`--package-manager npm|yarn|pnpm`** says which one the project is written for — what it installs with, and what
  every command in its README and its Playwright config names. Omitted, it is taken from the one that invoked the
  CLI, but that is a guess about the _invocation_: running `npx` once to scaffold a project you then work in with
  Yarn is exactly the case it gets wrong. A Yarn project also gets a `.yarnrc.yml` pinning `nodeLinker:
node-modules` — Yarn 4 installs Plug'n'Play by default and a server-mode project cannot start under it, since
  `node --import tsx` dies resolving its own entry.

  **The blank space moved into `@plitzi/sdk-authoring` as a declaration.** It was checked-in JSON inside the
  platform's seeds, which meant anything else that wanted it kept a copy — and a copy of a fixture is a fixture
  that is wrong six months later with nothing to say so. `blankSpaceSpec` is now the source both the platform's
  `POST /spaces` and `plitzi create` author from; `blankSpace()` returns the documents, and `blankSpaceSource()`
  returns the declaration as a file a project can own and edit.

  A local project therefore gets `src/space.ts` — its own copy of that declaration, complete and self-contained —
  rather than an import. It exports `space`, not `blankSpaceSpec`: whoever receives it is looking at their own site,
  not at Plitzi's blank one.

  `blankSpaceSource(name)` takes the name the copy should carry, so the scaffold no longer knows which literals the
  declaration happens to contain — a rename that finds nothing to replace throws instead of quietly handing back a
  space still called "New space", and `permanentUrl` is slugged, since it is a DNS label at the platform and what
  every element id and style selector is derived from. The import rewrite reads the block one statement at a time
  rather than by single-line regex (Prettier wraps a long import, and the old one read that as no import at all,
  dropping names the copy uses), and refuses to return a file that still points at anything relative.

  A browser-rendered project also serves the dev tools' stylesheet. They draw into a shadow root, which cannot see
  the page's styles, so they fetch `/plitzi-sdk-devtools.css` — a path that exists on a server serving the SDK's
  assets and nowhere else, which left the panel unstyled in a Vite app. The generated `vite.config.ts` serves it
  from `node_modules` in development, so it cannot go stale and nothing is copied into the project.

  **A plugin of the project's own.** `src/plugins/StatCard` is a React component the generated space renders
  through a `custom` element — the one thing about Plitzi a page of built-in elements cannot show, and a project
  with no example of it leaves people assuming the catalogue is the ceiling. A plugin's props ARE the hosting
  element's attributes, so a data source pointed at that element later reaches the component with nothing in
  between; it renders `RootElement`, so the element's id, classes and authored CSS land on what it draws. Server
  mode registers it with `action: 'compile'` and activates it through the deployment's `pluginNames` — registering
  a plugin says it exists, the deployment says which ones a space renders with, and leaving the second half out
  renders "Custom Component … Not Found" with no error anywhere. The blank space in `@plitzi/sdk-authoring` is
  unchanged: `blankSpaceSource({ plugin })` adds the host element only for callers that carry a component to fill
  it, because the platform authors new spaces from the same declaration and hosts nobody's plugins.

  **`render()`'s third argument takes a component, not a decorated one.** It asked for `ComponentPlugin` — the type
  carrying `type`, `assets`, `origin` and `content`, all of which `App` stamps on itself from the keys of that very
  object. Nobody registering a component of their own could satisfy it without a cast, which is also why
  `<Sdk.Plugin component>` already declared the plain one.

  **Prettier and ESLint in the generated project**, configured rather than mentioned: type-checked rules scoped to
  the files a type checker can see, Prettier owning layout, and `eslint-config-prettier` last so the two do not
  argue on save. `lint` and `format` are scripts from the first commit, which is the only moment a repository's
  style is cheap to decide.

  **`render()` now returns `{ unmount }`.** A second `render()` into the same element used to create a second React
  root over the first: two live trees on one node, neither aware of the other. Anything that re-renders on its own
  needs to take the first one down, and hot module replacement is the case that forced it — a generated client
  project swaps the space module and remounts, so a save updates the page without reloading it.
