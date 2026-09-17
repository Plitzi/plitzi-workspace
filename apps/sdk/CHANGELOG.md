# @plitzi/plitzi-sdk

## 0.36.1

### Patch Changes

- v0.36.1
- Updated dependencies
  - @plitzi/sdk-auth@0.36.1
  - @plitzi/sdk-dev-tools@0.36.1
  - @plitzi/sdk-elements@0.36.1
  - @plitzi/sdk-event-bridge@0.36.1
  - @plitzi/sdk-interactions@0.36.1
  - @plitzi/sdk-navigation@0.36.1
  - @plitzi/sdk-plugins@0.36.1
  - @plitzi/sdk-schema@0.36.1
  - @plitzi/sdk-shared@0.36.1
  - @plitzi/sdk-style@0.36.1
  - @plitzi/sdk-variables@0.36.1

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
  - @plitzi/sdk-auth@0.36.0
  - @plitzi/sdk-dev-tools@0.36.0
  - @plitzi/sdk-elements@0.36.0
  - @plitzi/sdk-event-bridge@0.36.0
  - @plitzi/sdk-interactions@0.36.0
  - @plitzi/sdk-navigation@0.36.0
  - @plitzi/sdk-plugins@0.36.0
  - @plitzi/sdk-schema@0.36.0
  - @plitzi/sdk-shared@0.36.0
  - @plitzi/sdk-style@0.36.0
  - @plitzi/sdk-variables@0.36.0

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
  - @plitzi/sdk-auth@0.35.10
  - @plitzi/sdk-dev-tools@0.35.10
  - @plitzi/sdk-elements@0.35.10
  - @plitzi/sdk-event-bridge@0.35.10
  - @plitzi/sdk-interactions@0.35.10
  - @plitzi/sdk-navigation@0.35.10
  - @plitzi/sdk-plugins@0.35.10
  - @plitzi/sdk-schema@0.35.10
  - @plitzi/sdk-shared@0.35.10
  - @plitzi/sdk-style@0.35.10
  - @plitzi/sdk-variables@0.35.10

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
  - @plitzi/sdk-auth@0.35.9
  - @plitzi/sdk-dev-tools@0.35.9
  - @plitzi/sdk-elements@0.35.9
  - @plitzi/sdk-event-bridge@0.35.9
  - @plitzi/sdk-interactions@0.35.9
  - @plitzi/sdk-navigation@0.35.9
  - @plitzi/sdk-plugins@0.35.9
  - @plitzi/sdk-schema@0.35.9
  - @plitzi/sdk-shared@0.35.9
  - @plitzi/sdk-style@0.35.9
  - @plitzi/sdk-variables@0.35.9

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
  - @plitzi/sdk-auth@0.35.8
  - @plitzi/sdk-dev-tools@0.35.8
  - @plitzi/sdk-elements@0.35.8
  - @plitzi/sdk-event-bridge@0.35.8
  - @plitzi/sdk-interactions@0.35.8
  - @plitzi/sdk-navigation@0.35.8
  - @plitzi/sdk-plugins@0.35.8
  - @plitzi/sdk-schema@0.35.8
  - @plitzi/sdk-shared@0.35.8
  - @plitzi/sdk-style@0.35.8
  - @plitzi/sdk-variables@0.35.8

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
  - @plitzi/sdk-auth@0.35.7
  - @plitzi/sdk-dev-tools@0.35.7
  - @plitzi/sdk-elements@0.35.7
  - @plitzi/sdk-event-bridge@0.35.7
  - @plitzi/sdk-interactions@0.35.7
  - @plitzi/sdk-navigation@0.35.7
  - @plitzi/sdk-plugins@0.35.7
  - @plitzi/sdk-schema@0.35.7
  - @plitzi/sdk-shared@0.35.7
  - @plitzi/sdk-style@0.35.7
  - @plitzi/sdk-variables@0.35.7

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
  - @plitzi/sdk-auth@0.35.6
  - @plitzi/sdk-dev-tools@0.35.6
  - @plitzi/sdk-elements@0.35.6
  - @plitzi/sdk-event-bridge@0.35.6
  - @plitzi/sdk-interactions@0.35.6
  - @plitzi/sdk-navigation@0.35.6
  - @plitzi/sdk-plugins@0.35.6
  - @plitzi/sdk-schema@0.35.6
  - @plitzi/sdk-shared@0.35.6
  - @plitzi/sdk-style@0.35.6
  - @plitzi/sdk-variables@0.35.6

## 0.35.5

### Patch Changes

- v0.35.5
- Updated dependencies
  - @plitzi/sdk-auth@0.35.5
  - @plitzi/sdk-dev-tools@0.35.5
  - @plitzi/sdk-elements@0.35.5
  - @plitzi/sdk-event-bridge@0.35.5
  - @plitzi/sdk-interactions@0.35.5
  - @plitzi/sdk-navigation@0.35.5
  - @plitzi/sdk-plugins@0.35.5
  - @plitzi/sdk-schema@0.35.5
  - @plitzi/sdk-shared@0.35.5
  - @plitzi/sdk-style@0.35.5
  - @plitzi/sdk-variables@0.35.5

## 0.35.4

### Patch Changes

- v0.35.4
- Updated dependencies
  - @plitzi/sdk-auth@0.35.4
  - @plitzi/sdk-dev-tools@0.35.4
  - @plitzi/sdk-elements@0.35.4
  - @plitzi/sdk-event-bridge@0.35.4
  - @plitzi/sdk-interactions@0.35.4
  - @plitzi/sdk-navigation@0.35.4
  - @plitzi/sdk-plugins@0.35.4
  - @plitzi/sdk-schema@0.35.4
  - @plitzi/sdk-shared@0.35.4
  - @plitzi/sdk-style@0.35.4
  - @plitzi/sdk-variables@0.35.4

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
  - @plitzi/sdk-auth@0.35.3
  - @plitzi/sdk-dev-tools@0.35.3
  - @plitzi/sdk-elements@0.35.3
  - @plitzi/sdk-event-bridge@0.35.3
  - @plitzi/sdk-interactions@0.35.3
  - @plitzi/sdk-navigation@0.35.3
  - @plitzi/sdk-plugins@0.35.3
  - @plitzi/sdk-schema@0.35.3
  - @plitzi/sdk-shared@0.35.3
  - @plitzi/sdk-style@0.35.3
  - @plitzi/sdk-variables@0.35.3

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

### Patch Changes

- v0.35.2
- Updated dependencies [470aaf8]
- Updated dependencies
- Updated dependencies [470aaf8]
  - @plitzi/sdk-elements@0.35.2
  - @plitzi/sdk-auth@0.35.2
  - @plitzi/sdk-dev-tools@0.35.2
  - @plitzi/sdk-event-bridge@0.35.2
  - @plitzi/sdk-interactions@0.35.2
  - @plitzi/sdk-navigation@0.35.2
  - @plitzi/sdk-plugins@0.35.2
  - @plitzi/sdk-schema@0.35.2
  - @plitzi/sdk-shared@0.35.2
  - @plitzi/sdk-style@0.35.2
  - @plitzi/sdk-variables@0.35.2

## 0.35.1

### Patch Changes

- v0.35.1
- Updated dependencies
  - @plitzi/sdk-auth@0.35.1
  - @plitzi/sdk-dev-tools@0.35.1
  - @plitzi/sdk-elements@0.35.1
  - @plitzi/sdk-event-bridge@0.35.1
  - @plitzi/sdk-interactions@0.35.1
  - @plitzi/sdk-navigation@0.35.1
  - @plitzi/sdk-plugins@0.35.1
  - @plitzi/sdk-schema@0.35.1
  - @plitzi/sdk-shared@0.35.1
  - @plitzi/sdk-style@0.35.1
  - @plitzi/sdk-variables@0.35.1

## 0.35.0

### Minor Changes

- v0.35.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.35.0
  - @plitzi/sdk-dev-tools@0.35.0
  - @plitzi/sdk-elements@0.35.0
  - @plitzi/sdk-event-bridge@0.35.0
  - @plitzi/sdk-interactions@0.35.0
  - @plitzi/sdk-navigation@0.35.0
  - @plitzi/sdk-plugins@0.35.0
  - @plitzi/sdk-schema@0.35.0
  - @plitzi/sdk-shared@0.35.0
  - @plitzi/sdk-style@0.35.0
  - @plitzi/sdk-variables@0.35.0

## 0.34.1

### Patch Changes

- cba7b8b: Build tools no longer install with the SDK.

  `@plitzi/plitzi-sdk` listed `vite`, `vite-plugin-dts` and `vite-plugin-react` as runtime dependencies, and
  `@plitzi/sdk-variables` listed `eslint` — so every project depending on the SDK installed a bundler, a type bundler,
  a Babel 7 toolchain and a deprecated `eslint@9` it never runs. They are build-time only: `vite` and `vite-plugin-dts`
  move to `devDependencies`, the unused `vite-plugin-react` is removed, `@vitejs/plugin-react` (which the build
  config does import) is now declared, and `eslint` is dropped from `sdk-variables`' runtime list.

- v0.34.1
- Updated dependencies [cba7b8b]
- Updated dependencies
  - @plitzi/sdk-variables@0.34.1
  - @plitzi/sdk-auth@0.34.1
  - @plitzi/sdk-dev-tools@0.34.1
  - @plitzi/sdk-elements@0.34.1
  - @plitzi/sdk-event-bridge@0.34.1
  - @plitzi/sdk-interactions@0.34.1
  - @plitzi/sdk-navigation@0.34.1
  - @plitzi/sdk-plugins@0.34.1
  - @plitzi/sdk-schema@0.34.1
  - @plitzi/sdk-shared@0.34.1
  - @plitzi/sdk-style@0.34.1

## 0.34.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [5aceda0]
- Updated dependencies
- Updated dependencies [5aceda0]
  - @plitzi/sdk-shared@0.34.0
  - @plitzi/sdk-elements@0.34.0
  - @plitzi/sdk-auth@0.34.0
  - @plitzi/sdk-dev-tools@0.34.0
  - @plitzi/sdk-event-bridge@0.34.0
  - @plitzi/sdk-interactions@0.34.0
  - @plitzi/sdk-navigation@0.34.0
  - @plitzi/sdk-plugins@0.34.0
  - @plitzi/sdk-schema@0.34.0
  - @plitzi/sdk-style@0.34.0
  - @plitzi/sdk-variables@0.34.0

## 0.33.2

### Patch Changes

- v0.33.2
- Updated dependencies
  - @plitzi/sdk-auth@0.33.2
  - @plitzi/sdk-dev-tools@0.33.2
  - @plitzi/sdk-elements@0.33.2
  - @plitzi/sdk-event-bridge@0.33.2
  - @plitzi/sdk-interactions@0.33.2
  - @plitzi/sdk-navigation@0.33.2
  - @plitzi/sdk-plugins@0.33.2
  - @plitzi/sdk-schema@0.33.2
  - @plitzi/sdk-shared@0.33.2
  - @plitzi/sdk-style@0.33.2
  - @plitzi/sdk-variables@0.33.2

## 0.33.1

### Patch Changes

- v0.33.1
- Updated dependencies
  - @plitzi/sdk-auth@0.33.1
  - @plitzi/sdk-dev-tools@0.33.1
  - @plitzi/sdk-elements@0.33.1
  - @plitzi/sdk-event-bridge@0.33.1
  - @plitzi/sdk-interactions@0.33.1
  - @plitzi/sdk-navigation@0.33.1
  - @plitzi/sdk-plugins@0.33.1
  - @plitzi/sdk-schema@0.33.1
  - @plitzi/sdk-shared@0.33.1
  - @plitzi/sdk-style@0.33.1
  - @plitzi/sdk-variables@0.33.1

## 0.33.0

### Minor Changes

- v0.33.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.33.0
  - @plitzi/sdk-dev-tools@0.33.0
  - @plitzi/sdk-elements@0.33.0
  - @plitzi/sdk-event-bridge@0.33.0
  - @plitzi/sdk-interactions@0.33.0
  - @plitzi/sdk-navigation@0.33.0
  - @plitzi/sdk-plugins@0.33.0
  - @plitzi/sdk-schema@0.33.0
  - @plitzi/sdk-shared@0.33.0
  - @plitzi/sdk-style@0.33.0
  - @plitzi/sdk-variables@0.33.0

## 0.32.25

### Patch Changes

- v0.32.25
- Updated dependencies
  - @plitzi/sdk-auth@0.32.25
  - @plitzi/sdk-collections@0.32.25
  - @plitzi/sdk-dev-tools@0.32.25
  - @plitzi/sdk-elements@0.32.25
  - @plitzi/sdk-event-bridge@0.32.25
  - @plitzi/sdk-interactions@0.32.25
  - @plitzi/sdk-navigation@0.32.25
  - @plitzi/sdk-plugins@0.32.25
  - @plitzi/sdk-schema@0.32.25
  - @plitzi/sdk-shared@0.32.25
  - @plitzi/sdk-style@0.32.25
  - @plitzi/sdk-variables@0.32.25

## 0.32.24

### Patch Changes

- v0.32.24
- Updated dependencies
  - @plitzi/sdk-auth@0.32.24
  - @plitzi/sdk-collections@0.32.24
  - @plitzi/sdk-dev-tools@0.32.24
  - @plitzi/sdk-elements@0.32.24
  - @plitzi/sdk-event-bridge@0.32.24
  - @plitzi/sdk-interactions@0.32.24
  - @plitzi/sdk-navigation@0.32.24
  - @plitzi/sdk-plugins@0.32.24
  - @plitzi/sdk-schema@0.32.24
  - @plitzi/sdk-shared@0.32.24
  - @plitzi/sdk-style@0.32.24
  - @plitzi/sdk-variables@0.32.24

## 0.32.23

### Patch Changes

- v0.32.23
- Updated dependencies
  - @plitzi/sdk-auth@0.32.23
  - @plitzi/sdk-collections@0.32.23
  - @plitzi/sdk-dev-tools@0.32.23
  - @plitzi/sdk-elements@0.32.23
  - @plitzi/sdk-event-bridge@0.32.23
  - @plitzi/sdk-interactions@0.32.23
  - @plitzi/sdk-navigation@0.32.23
  - @plitzi/sdk-plugins@0.32.23
  - @plitzi/sdk-schema@0.32.23
  - @plitzi/sdk-shared@0.32.23
  - @plitzi/sdk-style@0.32.23
  - @plitzi/sdk-variables@0.32.23

## 0.32.22

### Patch Changes

- v0.32.22
- Updated dependencies
  - @plitzi/sdk-auth@0.32.22
  - @plitzi/sdk-collections@0.32.22
  - @plitzi/sdk-dev-tools@0.32.22
  - @plitzi/sdk-elements@0.32.22
  - @plitzi/sdk-event-bridge@0.32.22
  - @plitzi/sdk-interactions@0.32.22
  - @plitzi/sdk-navigation@0.32.22
  - @plitzi/sdk-plugins@0.32.22
  - @plitzi/sdk-schema@0.32.22
  - @plitzi/sdk-shared@0.32.22
  - @plitzi/sdk-style@0.32.22
  - @plitzi/sdk-variables@0.32.22

## 0.32.21

### Patch Changes

- v0.32.21
- Updated dependencies
  - @plitzi/sdk-auth@0.32.21
  - @plitzi/sdk-collections@0.32.21
  - @plitzi/sdk-dev-tools@0.32.21
  - @plitzi/sdk-elements@0.32.21
  - @plitzi/sdk-event-bridge@0.32.21
  - @plitzi/sdk-interactions@0.32.21
  - @plitzi/sdk-navigation@0.32.21
  - @plitzi/sdk-plugins@0.32.21
  - @plitzi/sdk-schema@0.32.21
  - @plitzi/sdk-shared@0.32.21
  - @plitzi/sdk-style@0.32.21
  - @plitzi/sdk-variables@0.32.21

## 0.32.20

### Patch Changes

- v0.32.20
- Updated dependencies
  - @plitzi/sdk-auth@0.32.20
  - @plitzi/sdk-collections@0.32.20
  - @plitzi/sdk-dev-tools@0.32.20
  - @plitzi/sdk-elements@0.32.20
  - @plitzi/sdk-event-bridge@0.32.20
  - @plitzi/sdk-interactions@0.32.20
  - @plitzi/sdk-navigation@0.32.20
  - @plitzi/sdk-plugins@0.32.20
  - @plitzi/sdk-schema@0.32.20
  - @plitzi/sdk-shared@0.32.20
  - @plitzi/sdk-style@0.32.20
  - @plitzi/sdk-variables@0.32.20

## 0.32.19

### Patch Changes

- v0.32.19
- Updated dependencies
  - @plitzi/sdk-auth@0.32.19
  - @plitzi/sdk-collections@0.32.19
  - @plitzi/sdk-dev-tools@0.32.19
  - @plitzi/sdk-elements@0.32.19
  - @plitzi/sdk-event-bridge@0.32.19
  - @plitzi/sdk-interactions@0.32.19
  - @plitzi/sdk-navigation@0.32.19
  - @plitzi/sdk-plugins@0.32.19
  - @plitzi/sdk-schema@0.32.19
  - @plitzi/sdk-shared@0.32.19
  - @plitzi/sdk-style@0.32.19
  - @plitzi/sdk-variables@0.32.19

## 0.32.18

### Patch Changes

- v0.32.18
- Updated dependencies
  - @plitzi/sdk-auth@0.32.18
  - @plitzi/sdk-collections@0.32.18
  - @plitzi/sdk-dev-tools@0.32.18
  - @plitzi/sdk-elements@0.32.18
  - @plitzi/sdk-event-bridge@0.32.18
  - @plitzi/sdk-interactions@0.32.18
  - @plitzi/sdk-navigation@0.32.18
  - @plitzi/sdk-plugins@0.32.18
  - @plitzi/sdk-schema@0.32.18
  - @plitzi/sdk-shared@0.32.18
  - @plitzi/sdk-style@0.32.18
  - @plitzi/sdk-variables@0.32.18

## 0.32.17

### Patch Changes

- v0.32.17
- Updated dependencies
  - @plitzi/sdk-auth@0.32.17
  - @plitzi/sdk-collections@0.32.17
  - @plitzi/sdk-dev-tools@0.32.17
  - @plitzi/sdk-elements@0.32.17
  - @plitzi/sdk-event-bridge@0.32.17
  - @plitzi/sdk-interactions@0.32.17
  - @plitzi/sdk-navigation@0.32.17
  - @plitzi/sdk-plugins@0.32.17
  - @plitzi/sdk-schema@0.32.17
  - @plitzi/sdk-shared@0.32.17
  - @plitzi/sdk-style@0.32.17
  - @plitzi/sdk-variables@0.32.17

## 0.32.16

### Patch Changes

- v0.32.16
- Updated dependencies
  - @plitzi/sdk-auth@0.32.16
  - @plitzi/sdk-collections@0.32.16
  - @plitzi/sdk-dev-tools@0.32.16
  - @plitzi/sdk-elements@0.32.16
  - @plitzi/sdk-event-bridge@0.32.16
  - @plitzi/sdk-interactions@0.32.16
  - @plitzi/sdk-navigation@0.32.16
  - @plitzi/sdk-plugins@0.32.16
  - @plitzi/sdk-schema@0.32.16
  - @plitzi/sdk-shared@0.32.16
  - @plitzi/sdk-style@0.32.16
  - @plitzi/sdk-variables@0.32.16

## 0.32.15

### Patch Changes

- v0.32.15
- Updated dependencies
  - @plitzi/nexus@0.32.15
  - @plitzi/sdk-auth@0.32.15
  - @plitzi/sdk-collections@0.32.15
  - @plitzi/sdk-dev-tools@0.32.15
  - @plitzi/sdk-elements@0.32.15
  - @plitzi/sdk-event-bridge@0.32.15
  - @plitzi/sdk-interactions@0.32.15
  - @plitzi/sdk-navigation@0.32.15
  - @plitzi/sdk-plugins@0.32.15
  - @plitzi/sdk-schema@0.32.15
  - @plitzi/sdk-shared@0.32.15
  - @plitzi/sdk-style@0.32.15
  - @plitzi/sdk-variables@0.32.15

## 0.32.14

### Patch Changes

- v0.32.14
- Updated dependencies
  - @plitzi/nexus@0.32.14
  - @plitzi/sdk-auth@0.32.14
  - @plitzi/sdk-collections@0.32.14
  - @plitzi/sdk-dev-tools@0.32.14
  - @plitzi/sdk-elements@0.32.14
  - @plitzi/sdk-event-bridge@0.32.14
  - @plitzi/sdk-interactions@0.32.14
  - @plitzi/sdk-navigation@0.32.14
  - @plitzi/sdk-plugins@0.32.14
  - @plitzi/sdk-schema@0.32.14
  - @plitzi/sdk-shared@0.32.14
  - @plitzi/sdk-style@0.32.14
  - @plitzi/sdk-variables@0.32.14

## 0.32.13

### Patch Changes

- v0.32.13
- Updated dependencies
  - @plitzi/nexus@0.32.13
  - @plitzi/sdk-auth@0.32.13
  - @plitzi/sdk-collections@0.32.13
  - @plitzi/sdk-dev-tools@0.32.13
  - @plitzi/sdk-elements@0.32.13
  - @plitzi/sdk-event-bridge@0.32.13
  - @plitzi/sdk-interactions@0.32.13
  - @plitzi/sdk-navigation@0.32.13
  - @plitzi/sdk-plugins@0.32.13
  - @plitzi/sdk-schema@0.32.13
  - @plitzi/sdk-shared@0.32.13
  - @plitzi/sdk-style@0.32.13
  - @plitzi/sdk-variables@0.32.13

## 0.32.12

### Patch Changes

- v0.32.12
- Updated dependencies
  - @plitzi/nexus@0.32.12
  - @plitzi/sdk-auth@0.32.12
  - @plitzi/sdk-collections@0.32.12
  - @plitzi/sdk-dev-tools@0.32.12
  - @plitzi/sdk-elements@0.32.12
  - @plitzi/sdk-event-bridge@0.32.12
  - @plitzi/sdk-interactions@0.32.12
  - @plitzi/sdk-navigation@0.32.12
  - @plitzi/sdk-plugins@0.32.12
  - @plitzi/sdk-schema@0.32.12
  - @plitzi/sdk-shared@0.32.12
  - @plitzi/sdk-style@0.32.12
  - @plitzi/sdk-variables@0.32.12

## 0.32.11

### Patch Changes

- v0.32.11
- Updated dependencies
  - @plitzi/nexus@0.32.11
  - @plitzi/sdk-auth@0.32.11
  - @plitzi/sdk-collections@0.32.11
  - @plitzi/sdk-dev-tools@0.32.11
  - @plitzi/sdk-elements@0.32.11
  - @plitzi/sdk-event-bridge@0.32.11
  - @plitzi/sdk-interactions@0.32.11
  - @plitzi/sdk-navigation@0.32.11
  - @plitzi/sdk-plugins@0.32.11
  - @plitzi/sdk-schema@0.32.11
  - @plitzi/sdk-shared@0.32.11
  - @plitzi/sdk-style@0.32.11
  - @plitzi/sdk-variables@0.32.11

## 0.32.10

### Patch Changes

- v0.32.10
- Updated dependencies
  - @plitzi/nexus@0.32.10
  - @plitzi/sdk-auth@0.32.10
  - @plitzi/sdk-collections@0.32.10
  - @plitzi/sdk-dev-tools@0.32.10
  - @plitzi/sdk-elements@0.32.10
  - @plitzi/sdk-event-bridge@0.32.10
  - @plitzi/sdk-interactions@0.32.10
  - @plitzi/sdk-navigation@0.32.10
  - @plitzi/sdk-plugins@0.32.10
  - @plitzi/sdk-schema@0.32.10
  - @plitzi/sdk-shared@0.32.10
  - @plitzi/sdk-style@0.32.10
  - @plitzi/sdk-variables@0.32.10

## 0.32.9

### Patch Changes

- v0.32.9
- Updated dependencies
  - @plitzi/nexus@0.32.9
  - @plitzi/sdk-auth@0.32.9
  - @plitzi/sdk-collections@0.32.9
  - @plitzi/sdk-dev-tools@0.32.9
  - @plitzi/sdk-elements@0.32.9
  - @plitzi/sdk-event-bridge@0.32.9
  - @plitzi/sdk-interactions@0.32.9
  - @plitzi/sdk-navigation@0.32.9
  - @plitzi/sdk-plugins@0.32.9
  - @plitzi/sdk-schema@0.32.9
  - @plitzi/sdk-shared@0.32.9
  - @plitzi/sdk-style@0.32.9
  - @plitzi/sdk-variables@0.32.9

## 0.32.8

### Patch Changes

- v0.32.8
- Updated dependencies
  - @plitzi/nexus@0.32.8
  - @plitzi/sdk-auth@0.32.8
  - @plitzi/sdk-collections@0.32.8
  - @plitzi/sdk-dev-tools@0.32.8
  - @plitzi/sdk-elements@0.32.8
  - @plitzi/sdk-event-bridge@0.32.8
  - @plitzi/sdk-interactions@0.32.8
  - @plitzi/sdk-navigation@0.32.8
  - @plitzi/sdk-plugins@0.32.8
  - @plitzi/sdk-schema@0.32.8
  - @plitzi/sdk-shared@0.32.8
  - @plitzi/sdk-style@0.32.8
  - @plitzi/sdk-variables@0.32.8

## 0.32.7

### Patch Changes

- v0.32.7
- Updated dependencies
  - @plitzi/nexus@0.32.7
  - @plitzi/sdk-auth@0.32.7
  - @plitzi/sdk-collections@0.32.7
  - @plitzi/sdk-dev-tools@0.32.7
  - @plitzi/sdk-elements@0.32.7
  - @plitzi/sdk-event-bridge@0.32.7
  - @plitzi/sdk-interactions@0.32.7
  - @plitzi/sdk-navigation@0.32.7
  - @plitzi/sdk-plugins@0.32.7
  - @plitzi/sdk-schema@0.32.7
  - @plitzi/sdk-shared@0.32.7
  - @plitzi/sdk-style@0.32.7
  - @plitzi/sdk-variables@0.32.7

## 0.32.6

### Patch Changes

- v0.32.6
- Updated dependencies
  - @plitzi/nexus@0.32.6
  - @plitzi/sdk-auth@0.32.6
  - @plitzi/sdk-collections@0.32.6
  - @plitzi/sdk-dev-tools@0.32.6
  - @plitzi/sdk-elements@0.32.6
  - @plitzi/sdk-event-bridge@0.32.6
  - @plitzi/sdk-interactions@0.32.6
  - @plitzi/sdk-navigation@0.32.6
  - @plitzi/sdk-plugins@0.32.6
  - @plitzi/sdk-schema@0.32.6
  - @plitzi/sdk-shared@0.32.6
  - @plitzi/sdk-style@0.32.6
  - @plitzi/sdk-variables@0.32.6

## 0.32.5

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.5
  - @plitzi/sdk-auth@0.32.5
  - @plitzi/sdk-collections@0.32.5
  - @plitzi/sdk-dev-tools@0.32.5
  - @plitzi/sdk-elements@0.32.5
  - @plitzi/sdk-event-bridge@0.32.5
  - @plitzi/sdk-interactions@0.32.5
  - @plitzi/sdk-navigation@0.32.5
  - @plitzi/sdk-plugins@0.32.5
  - @plitzi/sdk-schema@0.32.5
  - @plitzi/sdk-shared@0.32.5
  - @plitzi/sdk-style@0.32.5
  - @plitzi/sdk-variables@0.32.5

## 0.32.4

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.4
  - @plitzi/sdk-auth@0.32.4
  - @plitzi/sdk-collections@0.32.4
  - @plitzi/sdk-dev-tools@0.32.4
  - @plitzi/sdk-elements@0.32.4
  - @plitzi/sdk-event-bridge@0.32.4
  - @plitzi/sdk-interactions@0.32.4
  - @plitzi/sdk-navigation@0.32.4
  - @plitzi/sdk-plugins@0.32.4
  - @plitzi/sdk-schema@0.32.4
  - @plitzi/sdk-shared@0.32.4
  - @plitzi/sdk-style@0.32.4
  - @plitzi/sdk-variables@0.32.4

## 0.32.3

### Patch Changes

- v0.32.3
- Updated dependencies
  - @plitzi/nexus@0.32.3
  - @plitzi/sdk-auth@0.32.3
  - @plitzi/sdk-collections@0.32.3
  - @plitzi/sdk-dev-tools@0.32.3
  - @plitzi/sdk-elements@0.32.3
  - @plitzi/sdk-event-bridge@0.32.3
  - @plitzi/sdk-interactions@0.32.3
  - @plitzi/sdk-navigation@0.32.3
  - @plitzi/sdk-plugins@0.32.3
  - @plitzi/sdk-schema@0.32.3
  - @plitzi/sdk-shared@0.32.3
  - @plitzi/sdk-style@0.32.3
  - @plitzi/sdk-variables@0.32.3

## 0.32.2

### Patch Changes

- v0.32.2
- Updated dependencies
  - @plitzi/nexus@0.32.2
  - @plitzi/sdk-auth@0.32.2
  - @plitzi/sdk-collections@0.32.2
  - @plitzi/sdk-dev-tools@0.32.2
  - @plitzi/sdk-elements@0.32.2
  - @plitzi/sdk-event-bridge@0.32.2
  - @plitzi/sdk-interactions@0.32.2
  - @plitzi/sdk-navigation@0.32.2
  - @plitzi/sdk-plugins@0.32.2
  - @plitzi/sdk-schema@0.32.2
  - @plitzi/sdk-shared@0.32.2
  - @plitzi/sdk-style@0.32.2
  - @plitzi/sdk-variables@0.32.2

## 0.32.1

### Patch Changes

- v0.32.1
- Updated dependencies
  - @plitzi/nexus@0.32.1
  - @plitzi/sdk-auth@0.32.1
  - @plitzi/sdk-collections@0.32.1
  - @plitzi/sdk-dev-tools@0.32.1
  - @plitzi/sdk-elements@0.32.1
  - @plitzi/sdk-event-bridge@0.32.1
  - @plitzi/sdk-interactions@0.32.1
  - @plitzi/sdk-navigation@0.32.1
  - @plitzi/sdk-plugins@0.32.1
  - @plitzi/sdk-schema@0.32.1
  - @plitzi/sdk-shared@0.32.1
  - @plitzi/sdk-style@0.32.1
  - @plitzi/sdk-variables@0.32.1

## 0.32.0

### Minor Changes

- v0.32.0

### Patch Changes

- Updated dependencies
  - @plitzi/nexus@0.32.0
  - @plitzi/sdk-auth@0.32.0
  - @plitzi/sdk-collections@0.32.0
  - @plitzi/sdk-dev-tools@0.32.0
  - @plitzi/sdk-elements@0.32.0
  - @plitzi/sdk-event-bridge@0.32.0
  - @plitzi/sdk-interactions@0.32.0
  - @plitzi/sdk-navigation@0.32.0
  - @plitzi/sdk-plugins@0.32.0
  - @plitzi/sdk-schema@0.32.0
  - @plitzi/sdk-shared@0.32.0
  - @plitzi/sdk-style@0.32.0
  - @plitzi/sdk-variables@0.32.0

## 0.31.2

### Patch Changes

- v0.31.2
- Updated dependencies
  - @plitzi/nexus@0.31.2
  - @plitzi/sdk-auth@0.31.2
  - @plitzi/sdk-collections@0.31.2
  - @plitzi/sdk-dev-tools@0.31.2
  - @plitzi/sdk-elements@0.31.2
  - @plitzi/sdk-event-bridge@0.31.2
  - @plitzi/sdk-interactions@0.31.2
  - @plitzi/sdk-navigation@0.31.2
  - @plitzi/sdk-plugins@0.31.2
  - @plitzi/sdk-schema@0.31.2
  - @plitzi/sdk-shared@0.31.2
  - @plitzi/sdk-style@0.31.2
  - @plitzi/sdk-variables@0.31.2

## 0.31.1

### Patch Changes

- v0.31.1
- Updated dependencies
  - @plitzi/nexus@0.31.1
  - @plitzi/sdk-auth@0.31.1
  - @plitzi/sdk-collections@0.31.1
  - @plitzi/sdk-dev-tools@0.31.1
  - @plitzi/sdk-elements@0.31.1
  - @plitzi/sdk-event-bridge@0.31.1
  - @plitzi/sdk-interactions@0.31.1
  - @plitzi/sdk-navigation@0.31.1
  - @plitzi/sdk-plugins@0.31.1
  - @plitzi/sdk-schema@0.31.1
  - @plitzi/sdk-shared@0.31.1
  - @plitzi/sdk-style@0.31.1
  - @plitzi/sdk-variables@0.31.1

## 0.31.0

### Minor Changes

- v0.31.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.31.0
  - @plitzi/sdk-collections@0.31.0
  - @plitzi/sdk-dev-tools@0.31.0
  - @plitzi/sdk-elements@0.31.0
  - @plitzi/sdk-event-bridge@0.31.0
  - @plitzi/sdk-interactions@0.31.0
  - @plitzi/sdk-navigation@0.31.0
  - @plitzi/sdk-plugins@0.31.0
  - @plitzi/sdk-schema@0.31.0
  - @plitzi/sdk-shared@0.31.0
  - @plitzi/nexus@0.31.0
  - @plitzi/sdk-style@0.31.0
  - @plitzi/sdk-variables@0.31.0

## 0.30.19

### Patch Changes

- v0.30.19
- Updated dependencies
  - @plitzi/sdk-auth@0.30.19
  - @plitzi/sdk-collections@0.30.19
  - @plitzi/sdk-dev-tools@0.30.19
  - @plitzi/sdk-elements@0.30.19
  - @plitzi/sdk-event-bridge@0.30.19
  - @plitzi/sdk-interactions@0.30.19
  - @plitzi/sdk-navigation@0.30.19
  - @plitzi/sdk-plugins@0.30.19
  - @plitzi/sdk-schema@0.30.19
  - @plitzi/sdk-shared@0.30.19
  - @plitzi/nexus@0.30.19
  - @plitzi/sdk-style@0.30.19
  - @plitzi/sdk-variables@0.30.19

## 0.30.18

### Patch Changes

- v0.30.18
- Updated dependencies
  - @plitzi/sdk-auth@0.30.18
  - @plitzi/sdk-collections@0.30.18
  - @plitzi/sdk-dev-tools@0.30.18
  - @plitzi/sdk-elements@0.30.18
  - @plitzi/sdk-event-bridge@0.30.18
  - @plitzi/sdk-interactions@0.30.18
  - @plitzi/sdk-navigation@0.30.18
  - @plitzi/sdk-plugins@0.30.18
  - @plitzi/sdk-schema@0.30.18
  - @plitzi/sdk-shared@0.30.18
  - @plitzi/nexus@0.30.18
  - @plitzi/sdk-style@0.30.18
  - @plitzi/sdk-variables@0.30.18

## 0.30.17

### Patch Changes

- v0.31.0
- Updated dependencies
  - @plitzi/sdk-auth@0.30.17
  - @plitzi/sdk-collections@0.30.17
  - @plitzi/sdk-dev-tools@0.30.17
  - @plitzi/sdk-elements@0.30.17
  - @plitzi/sdk-event-bridge@0.30.17
  - @plitzi/sdk-interactions@0.30.17
  - @plitzi/sdk-navigation@0.30.17
  - @plitzi/sdk-plugins@0.30.17
  - @plitzi/sdk-schema@0.30.17
  - @plitzi/sdk-shared@0.30.17
  - @plitzi/nexus@0.30.17
  - @plitzi/sdk-style@0.30.17
  - @plitzi/sdk-variables@0.30.17

## 0.30.16

### Patch Changes

- v0.30.16
- Updated dependencies
  - @plitzi/sdk-auth@0.30.16
  - @plitzi/sdk-collections@0.30.16
  - @plitzi/sdk-dev-tools@0.30.16
  - @plitzi/sdk-elements@0.30.16
  - @plitzi/sdk-event-bridge@0.30.16
  - @plitzi/sdk-interactions@0.30.16
  - @plitzi/sdk-navigation@0.30.16
  - @plitzi/sdk-plugins@0.30.16
  - @plitzi/sdk-schema@0.30.16
  - @plitzi/sdk-shared@0.30.16
  - @plitzi/sdk-style@0.30.16
  - @plitzi/sdk-variables@0.30.16

## 0.30.15

### Patch Changes

- v0.30.15
- Updated dependencies
  - @plitzi/sdk-auth@0.30.15
  - @plitzi/sdk-collections@0.30.15
  - @plitzi/sdk-dev-tools@0.30.15
  - @plitzi/sdk-elements@0.30.15
  - @plitzi/sdk-event-bridge@0.30.15
  - @plitzi/sdk-interactions@0.30.15
  - @plitzi/sdk-navigation@0.30.15
  - @plitzi/sdk-plugins@0.30.15
  - @plitzi/sdk-schema@0.30.15
  - @plitzi/sdk-shared@0.30.15
  - @plitzi/sdk-style@0.30.15
  - @plitzi/sdk-variables@0.30.15

## 0.30.14

### Patch Changes

- v0.30.14
- Updated dependencies
  - @plitzi/sdk-auth@0.30.14
  - @plitzi/sdk-collections@0.30.14
  - @plitzi/sdk-dev-tools@0.30.14
  - @plitzi/sdk-elements@0.30.14
  - @plitzi/sdk-event-bridge@0.30.14
  - @plitzi/sdk-interactions@0.30.14
  - @plitzi/sdk-navigation@0.30.14
  - @plitzi/sdk-plugins@0.30.14
  - @plitzi/sdk-schema@0.30.14
  - @plitzi/sdk-shared@0.30.14
  - @plitzi/sdk-style@0.30.14
  - @plitzi/sdk-variables@0.30.14

## 0.30.13

### Patch Changes

- v0.30.13
- Updated dependencies
  - @plitzi/sdk-auth@0.30.13
  - @plitzi/sdk-collections@0.30.13
  - @plitzi/sdk-dev-tools@0.30.13
  - @plitzi/sdk-elements@0.30.13
  - @plitzi/sdk-event-bridge@0.30.13
  - @plitzi/sdk-interactions@0.30.13
  - @plitzi/sdk-navigation@0.30.13
  - @plitzi/sdk-plugins@0.30.13
  - @plitzi/sdk-schema@0.30.13
  - @plitzi/sdk-shared@0.30.13
  - @plitzi/sdk-style@0.30.13
  - @plitzi/sdk-variables@0.30.13

## 0.30.12

### Patch Changes

- v0.30.12
- Updated dependencies
  - @plitzi/sdk-auth@0.30.12
  - @plitzi/sdk-collections@0.30.12
  - @plitzi/sdk-dev-tools@0.30.12
  - @plitzi/sdk-elements@0.30.12
  - @plitzi/sdk-event-bridge@0.30.12
  - @plitzi/sdk-interactions@0.30.12
  - @plitzi/sdk-navigation@0.30.12
  - @plitzi/sdk-plugins@0.30.12
  - @plitzi/sdk-schema@0.30.12
  - @plitzi/sdk-shared@0.30.12
  - @plitzi/sdk-style@0.30.12
  - @plitzi/sdk-variables@0.30.12

## 0.30.11

### Patch Changes

- v0.30.11
- Updated dependencies
  - @plitzi/sdk-auth@0.30.11
  - @plitzi/sdk-collections@0.30.11
  - @plitzi/sdk-dev-tools@0.30.11
  - @plitzi/sdk-elements@0.30.11
  - @plitzi/sdk-event-bridge@0.30.11
  - @plitzi/sdk-interactions@0.30.11
  - @plitzi/sdk-navigation@0.30.11
  - @plitzi/sdk-plugins@0.30.11
  - @plitzi/sdk-schema@0.30.11
  - @plitzi/sdk-shared@0.30.11
  - @plitzi/sdk-style@0.30.11
  - @plitzi/sdk-variables@0.30.11

## 0.30.10

### Patch Changes

- v0.30.10
- Updated dependencies
  - @plitzi/sdk-auth@0.30.10
  - @plitzi/sdk-collections@0.30.10
  - @plitzi/sdk-dev-tools@0.30.10
  - @plitzi/sdk-elements@0.30.10
  - @plitzi/sdk-event-bridge@0.30.10
  - @plitzi/sdk-interactions@0.30.10
  - @plitzi/sdk-navigation@0.30.10
  - @plitzi/sdk-plugins@0.30.10
  - @plitzi/sdk-schema@0.30.10
  - @plitzi/sdk-shared@0.30.10
  - @plitzi/sdk-style@0.30.10
  - @plitzi/sdk-variables@0.30.10

## 0.30.9

### Patch Changes

- v0.30.9
- Updated dependencies
  - @plitzi/sdk-auth@0.30.9
  - @plitzi/sdk-collections@0.30.9
  - @plitzi/sdk-dev-tools@0.30.9
  - @plitzi/sdk-elements@0.30.9
  - @plitzi/sdk-event-bridge@0.30.9
  - @plitzi/sdk-interactions@0.30.9
  - @plitzi/sdk-navigation@0.30.9
  - @plitzi/sdk-plugins@0.30.9
  - @plitzi/sdk-schema@0.30.9
  - @plitzi/sdk-shared@0.30.9
  - @plitzi/sdk-style@0.30.9
  - @plitzi/sdk-variables@0.30.9

## 0.30.8

### Patch Changes

- v0.30.8
- Updated dependencies
  - @plitzi/sdk-interactions@0.30.8
  - @plitzi/sdk-elements@0.30.8
  - @plitzi/sdk-auth@0.30.8
  - @plitzi/sdk-collections@0.30.8
  - @plitzi/sdk-dev-tools@0.30.8
  - @plitzi/sdk-event-bridge@0.30.8
  - @plitzi/sdk-navigation@0.30.8
  - @plitzi/sdk-plugins@0.30.8
  - @plitzi/sdk-schema@0.30.8
  - @plitzi/sdk-shared@0.30.8
  - @plitzi/sdk-style@0.30.8
  - @plitzi/sdk-variables@0.30.8

## 0.30.7

### Patch Changes

- v0.30.7
- Updated dependencies
  - @plitzi/sdk-auth@0.30.7
  - @plitzi/sdk-collections@0.30.7
  - @plitzi/sdk-dev-tools@0.30.7
  - @plitzi/sdk-elements@0.30.7
  - @plitzi/sdk-event-bridge@0.30.7
  - @plitzi/sdk-interactions@0.30.7
  - @plitzi/sdk-navigation@0.30.7
  - @plitzi/sdk-plugins@0.30.7
  - @plitzi/sdk-schema@0.30.7
  - @plitzi/sdk-shared@0.30.7
  - @plitzi/sdk-style@0.30.7
  - @plitzi/sdk-variables@0.30.7

## 0.30.6

### Patch Changes

- v0.30.6
- Updated dependencies
  - @plitzi/sdk-shared@0.30.6
  - @plitzi/sdk-style@0.30.6
  - @plitzi/sdk-auth@0.30.6
  - @plitzi/sdk-collections@0.30.6
  - @plitzi/sdk-dev-tools@0.30.6
  - @plitzi/sdk-elements@0.30.6
  - @plitzi/sdk-event-bridge@0.30.6
  - @plitzi/sdk-interactions@0.30.6
  - @plitzi/sdk-navigation@0.30.6
  - @plitzi/sdk-plugins@0.30.6
  - @plitzi/sdk-schema@0.30.6
  - @plitzi/sdk-variables@0.30.6

## 0.30.5

### Patch Changes

- v0.30.5
- Updated dependencies
  - @plitzi/sdk-auth@0.30.5
  - @plitzi/sdk-collections@0.30.5
  - @plitzi/sdk-dev-tools@0.30.5
  - @plitzi/sdk-elements@0.30.5
  - @plitzi/sdk-event-bridge@0.30.5
  - @plitzi/sdk-interactions@0.30.5
  - @plitzi/sdk-navigation@0.30.5
  - @plitzi/sdk-plugins@0.30.5
  - @plitzi/sdk-schema@0.30.5
  - @plitzi/sdk-shared@0.30.5
  - @plitzi/sdk-style@0.30.5
  - @plitzi/sdk-variables@0.30.5

## 0.30.4

### Patch Changes

- v0.30.4
- Updated dependencies
  - @plitzi/sdk-auth@0.30.4
  - @plitzi/sdk-collections@0.30.4
  - @plitzi/sdk-dev-tools@0.30.4
  - @plitzi/sdk-elements@0.30.4
  - @plitzi/sdk-event-bridge@0.30.4
  - @plitzi/sdk-interactions@0.30.4
  - @plitzi/sdk-navigation@0.30.4
  - @plitzi/sdk-plugins@0.30.4
  - @plitzi/sdk-schema@0.30.4
  - @plitzi/sdk-shared@0.30.4
  - @plitzi/sdk-style@0.30.4
  - @plitzi/sdk-variables@0.30.4

## 0.30.3

### Patch Changes

- v0.30.3
- Updated dependencies
  - @plitzi/sdk-auth@0.30.3
  - @plitzi/sdk-collections@0.30.3
  - @plitzi/sdk-dev-tools@0.30.3
  - @plitzi/sdk-elements@0.30.3
  - @plitzi/sdk-event-bridge@0.30.3
  - @plitzi/sdk-interactions@0.30.3
  - @plitzi/sdk-navigation@0.30.3
  - @plitzi/sdk-plugins@0.30.3
  - @plitzi/sdk-schema@0.30.3
  - @plitzi/sdk-shared@0.30.3
  - @plitzi/sdk-style@0.30.3
  - @plitzi/sdk-variables@0.30.3

## 0.30.2

### Patch Changes

- v0.30.2
- Updated dependencies
  - @plitzi/sdk-interactions@0.30.2
  - @plitzi/sdk-collections@0.30.2
  - @plitzi/sdk-navigation@0.30.2
  - @plitzi/sdk-dev-tools@0.30.2
  - @plitzi/sdk-variables@0.30.2
  - @plitzi/sdk-elements@0.30.2
  - @plitzi/sdk-schema@0.30.2
  - @plitzi/sdk-shared@0.30.2
  - @plitzi/sdk-style@0.30.2
  - @plitzi/sdk-auth@0.30.2
  - @plitzi/sdk-event-bridge@0.30.2
  - @plitzi/sdk-plugins@0.30.2

## 0.30.1

### Patch Changes

- v0.30.1
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.30.1
  - @plitzi/sdk-interactions@0.30.1
  - @plitzi/sdk-collections@0.30.1
  - @plitzi/sdk-navigation@0.30.1
  - @plitzi/sdk-dev-tools@0.30.1
  - @plitzi/sdk-variables@0.30.1
  - @plitzi/sdk-elements@0.30.1
  - @plitzi/sdk-plugins@0.30.1
  - @plitzi/sdk-schema@0.30.1
  - @plitzi/sdk-shared@0.30.1
  - @plitzi/sdk-style@0.30.1
  - @plitzi/sdk-auth@0.30.1

## 0.30.0

### Minor Changes

- v0.30.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.30.0
  - @plitzi/sdk-collections@0.30.0
  - @plitzi/sdk-dev-tools@0.30.0
  - @plitzi/sdk-elements@0.30.0
  - @plitzi/sdk-event-bridge@0.30.0
  - @plitzi/sdk-interactions@0.30.0
  - @plitzi/sdk-navigation@0.30.0
  - @plitzi/sdk-plugins@0.30.0
  - @plitzi/sdk-schema@0.30.0
  - @plitzi/sdk-shared@0.30.0
  - @plitzi/sdk-style@0.30.0
  - @plitzi/sdk-variables@0.30.0

## 0.29.0

### Minor Changes

- v0.29.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.29.0
  - @plitzi/sdk-collections@0.29.0
  - @plitzi/sdk-dev-tools@0.29.0
  - @plitzi/sdk-elements@0.29.0
  - @plitzi/sdk-event-bridge@0.29.0
  - @plitzi/sdk-interactions@0.29.0
  - @plitzi/sdk-navigation@0.29.0
  - @plitzi/sdk-plugins@0.29.0
  - @plitzi/sdk-schema@0.29.0
  - @plitzi/sdk-shared@0.29.0
  - @plitzi/sdk-style@0.29.0
  - @plitzi/sdk-variables@0.29.0

## 0.28.14

### Patch Changes

- v0.28.14
- Updated dependencies
  - @plitzi/sdk-elements@0.28.14
  - @plitzi/sdk-shared@0.28.14
  - @plitzi/sdk-auth@0.28.14
  - @plitzi/sdk-collections@0.28.14
  - @plitzi/sdk-dev-tools@0.28.14
  - @plitzi/sdk-event-bridge@0.28.14
  - @plitzi/sdk-interactions@0.28.14
  - @plitzi/sdk-navigation@0.28.14
  - @plitzi/sdk-plugins@0.28.14
  - @plitzi/sdk-schema@0.28.14
  - @plitzi/sdk-style@0.28.14
  - @plitzi/sdk-variables@0.28.14

## 0.28.13

### Patch Changes

- v0.28.13
- Updated dependencies
  - @plitzi/sdk-auth@0.28.13
  - @plitzi/sdk-dev-tools@0.28.13
  - @plitzi/sdk-elements@0.28.13
  - @plitzi/sdk-event-bridge@0.28.13
  - @plitzi/sdk-interactions@0.28.13
  - @plitzi/sdk-navigation@0.28.13
  - @plitzi/sdk-plugins@0.28.13
  - @plitzi/sdk-schema@0.28.13
  - @plitzi/sdk-shared@0.28.13
  - @plitzi/sdk-style@0.28.13
  - @plitzi/sdk-variables@0.28.13

## 0.28.12

### Patch Changes

- v0.28.12
- Updated dependencies
  - @plitzi/sdk-auth@0.28.12
  - @plitzi/sdk-dev-tools@0.28.12
  - @plitzi/sdk-elements@0.28.12
  - @plitzi/sdk-event-bridge@0.28.12
  - @plitzi/sdk-interactions@0.28.12
  - @plitzi/sdk-navigation@0.28.12
  - @plitzi/sdk-plugins@0.28.12
  - @plitzi/sdk-schema@0.28.12
  - @plitzi/sdk-shared@0.28.12
  - @plitzi/sdk-style@0.28.12
  - @plitzi/sdk-variables@0.28.12

## 0.28.11

### Patch Changes

- v0.28.11
- Updated dependencies
  - @plitzi/sdk-auth@0.28.11
  - @plitzi/sdk-dev-tools@0.28.11
  - @plitzi/sdk-elements@0.28.11
  - @plitzi/sdk-event-bridge@0.28.11
  - @plitzi/sdk-interactions@0.28.11
  - @plitzi/sdk-navigation@0.28.11
  - @plitzi/sdk-plugins@0.28.11
  - @plitzi/sdk-schema@0.28.11
  - @plitzi/sdk-shared@0.28.11
  - @plitzi/sdk-style@0.28.11
  - @plitzi/sdk-variables@0.28.11

## 0.28.10

### Patch Changes

- v0.28.10
- Updated dependencies
  - @plitzi/sdk-auth@0.28.10
  - @plitzi/sdk-dev-tools@0.28.10
  - @plitzi/sdk-elements@0.28.10
  - @plitzi/sdk-event-bridge@0.28.10
  - @plitzi/sdk-interactions@0.28.10
  - @plitzi/sdk-navigation@0.28.10
  - @plitzi/sdk-plugins@0.28.10
  - @plitzi/sdk-schema@0.28.10
  - @plitzi/sdk-shared@0.28.10
  - @plitzi/sdk-style@0.28.10
  - @plitzi/sdk-variables@0.28.10

## 0.28.9

### Patch Changes

- v0.28.9
- Updated dependencies
  - @plitzi/sdk-auth@0.28.9
  - @plitzi/sdk-dev-tools@0.28.9
  - @plitzi/sdk-elements@0.28.9
  - @plitzi/sdk-event-bridge@0.28.9
  - @plitzi/sdk-interactions@0.28.9
  - @plitzi/sdk-navigation@0.28.9
  - @plitzi/sdk-plugins@0.28.9
  - @plitzi/sdk-schema@0.28.9
  - @plitzi/sdk-shared@0.28.9
  - @plitzi/sdk-style@0.28.9
  - @plitzi/sdk-variables@0.28.9

## 0.28.8

### Patch Changes

- v0.28.8
- Updated dependencies
  - @plitzi/sdk-auth@0.28.8
  - @plitzi/sdk-dev-tools@0.28.8
  - @plitzi/sdk-elements@0.28.8
  - @plitzi/sdk-event-bridge@0.28.8
  - @plitzi/sdk-interactions@0.28.8
  - @plitzi/sdk-navigation@0.28.8
  - @plitzi/sdk-plugins@0.28.8
  - @plitzi/sdk-schema@0.28.8
  - @plitzi/sdk-shared@0.28.8
  - @plitzi/sdk-style@0.28.8
  - @plitzi/sdk-variables@0.28.8

## 0.28.7

### Patch Changes

- v0.28.7
- Updated dependencies
  - @plitzi/sdk-auth@0.28.7
  - @plitzi/sdk-dev-tools@0.28.7
  - @plitzi/sdk-elements@0.28.7
  - @plitzi/sdk-event-bridge@0.28.7
  - @plitzi/sdk-interactions@0.28.7
  - @plitzi/sdk-navigation@0.28.7
  - @plitzi/sdk-plugins@0.28.7
  - @plitzi/sdk-schema@0.28.7
  - @plitzi/sdk-shared@0.28.7
  - @plitzi/sdk-style@0.28.7
  - @plitzi/sdk-variables@0.28.7

## 0.28.6

### Patch Changes

- v0.28.6
- Updated dependencies
  - @plitzi/sdk-auth@0.28.6
  - @plitzi/sdk-dev-tools@0.28.6
  - @plitzi/sdk-elements@0.28.6
  - @plitzi/sdk-event-bridge@0.28.6
  - @plitzi/sdk-interactions@0.28.6
  - @plitzi/sdk-navigation@0.28.6
  - @plitzi/sdk-plugins@0.28.6
  - @plitzi/sdk-schema@0.28.6
  - @plitzi/sdk-shared@0.28.6
  - @plitzi/sdk-style@0.28.6
  - @plitzi/sdk-variables@0.28.6

## 0.28.5

### Patch Changes

- v0.28.5
- Updated dependencies
  - @plitzi/sdk-auth@0.28.5
  - @plitzi/sdk-dev-tools@0.28.5
  - @plitzi/sdk-elements@0.28.5
  - @plitzi/sdk-event-bridge@0.28.5
  - @plitzi/sdk-interactions@0.28.5
  - @plitzi/sdk-navigation@0.28.5
  - @plitzi/sdk-plugins@0.28.5
  - @plitzi/sdk-schema@0.28.5
  - @plitzi/sdk-shared@0.28.5
  - @plitzi/sdk-style@0.28.5
  - @plitzi/sdk-variables@0.28.5

## 0.28.4

### Patch Changes

- v0.28.4
- Updated dependencies
  - @plitzi/sdk-auth@0.28.4
  - @plitzi/sdk-dev-tools@0.28.4
  - @plitzi/sdk-elements@0.28.4
  - @plitzi/sdk-event-bridge@0.28.4
  - @plitzi/sdk-interactions@0.28.4
  - @plitzi/sdk-navigation@0.28.4
  - @plitzi/sdk-plugins@0.28.4
  - @plitzi/sdk-schema@0.28.4
  - @plitzi/sdk-shared@0.28.4
  - @plitzi/sdk-style@0.28.4
  - @plitzi/sdk-variables@0.28.4

## 0.28.3

### Patch Changes

- v0.28.3
- Updated dependencies
  - @plitzi/sdk-auth@0.28.3
  - @plitzi/sdk-dev-tools@0.28.3
  - @plitzi/sdk-elements@0.28.3
  - @plitzi/sdk-event-bridge@0.28.3
  - @plitzi/sdk-interactions@0.28.3
  - @plitzi/sdk-navigation@0.28.3
  - @plitzi/sdk-plugins@0.28.3
  - @plitzi/sdk-schema@0.28.3
  - @plitzi/sdk-shared@0.28.3
  - @plitzi/sdk-style@0.28.3
  - @plitzi/sdk-variables@0.28.3

## 0.28.2

### Patch Changes

- v0.28.2
- Updated dependencies
  - @plitzi/sdk-auth@0.28.2
  - @plitzi/sdk-dev-tools@0.28.2
  - @plitzi/sdk-elements@0.28.2
  - @plitzi/sdk-event-bridge@0.28.2
  - @plitzi/sdk-interactions@0.28.2
  - @plitzi/sdk-navigation@0.28.2
  - @plitzi/sdk-plugins@0.28.2
  - @plitzi/sdk-schema@0.28.2
  - @plitzi/sdk-shared@0.28.2
  - @plitzi/sdk-style@0.28.2
  - @plitzi/sdk-variables@0.28.2

## 0.28.1

### Patch Changes

- v0.28.1
- Updated dependencies
  - @plitzi/sdk-auth@0.28.1
  - @plitzi/sdk-dev-tools@0.28.1
  - @plitzi/sdk-elements@0.28.1
  - @plitzi/sdk-event-bridge@0.28.1
  - @plitzi/sdk-interactions@0.28.1
  - @plitzi/sdk-navigation@0.28.1
  - @plitzi/sdk-plugins@0.28.1
  - @plitzi/sdk-schema@0.28.1
  - @plitzi/sdk-shared@0.28.1
  - @plitzi/sdk-style@0.28.1
  - @plitzi/sdk-variables@0.28.1

## 0.28.0

### Minor Changes

- v0.28.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.28.0
  - @plitzi/sdk-dev-tools@0.28.0
  - @plitzi/sdk-elements@0.28.0
  - @plitzi/sdk-event-bridge@0.28.0
  - @plitzi/sdk-interactions@0.28.0
  - @plitzi/sdk-navigation@0.28.0
  - @plitzi/sdk-plugins@0.28.0
  - @plitzi/sdk-schema@0.28.0
  - @plitzi/sdk-shared@0.28.0
  - @plitzi/sdk-style@0.28.0
  - @plitzi/sdk-variables@0.28.0

## 0.27.23

### Patch Changes

- v0.27.23
- Updated dependencies
  - @plitzi/sdk-shared@0.27.23
  - @plitzi/sdk-auth@0.27.23
  - @plitzi/sdk-dev-tools@0.27.23
  - @plitzi/sdk-elements@0.27.23
  - @plitzi/sdk-event-bridge@0.27.23
  - @plitzi/sdk-interactions@0.27.23
  - @plitzi/sdk-navigation@0.27.23
  - @plitzi/sdk-plugins@0.27.23
  - @plitzi/sdk-schema@0.27.23
  - @plitzi/sdk-style@0.27.23
  - @plitzi/sdk-variables@0.27.23

## 0.27.22

### Patch Changes

- v0.27.22
- Updated dependencies
  - @plitzi/sdk-auth@0.27.22
  - @plitzi/sdk-dev-tools@0.27.22
  - @plitzi/sdk-elements@0.27.22
  - @plitzi/sdk-event-bridge@0.27.22
  - @plitzi/sdk-interactions@0.27.22
  - @plitzi/sdk-navigation@0.27.22
  - @plitzi/sdk-plugins@0.27.22
  - @plitzi/sdk-schema@0.27.22
  - @plitzi/sdk-shared@0.27.22
  - @plitzi/sdk-style@0.27.22
  - @plitzi/sdk-variables@0.27.22

## 0.27.21

### Patch Changes

- v0.27.21
- Updated dependencies
  - @plitzi/sdk-auth@0.27.21
  - @plitzi/sdk-dev-tools@0.27.21
  - @plitzi/sdk-elements@0.27.21
  - @plitzi/sdk-event-bridge@0.27.21
  - @plitzi/sdk-interactions@0.27.21
  - @plitzi/sdk-navigation@0.27.21
  - @plitzi/sdk-plugins@0.27.21
  - @plitzi/sdk-schema@0.27.21
  - @plitzi/sdk-shared@0.27.21
  - @plitzi/sdk-style@0.27.21
  - @plitzi/sdk-variables@0.27.21

## 0.27.20

### Patch Changes

- v0.27.20
- Updated dependencies
  - @plitzi/sdk-auth@0.27.20
  - @plitzi/sdk-dev-tools@0.27.20
  - @plitzi/sdk-elements@0.27.20
  - @plitzi/sdk-event-bridge@0.27.20
  - @plitzi/sdk-interactions@0.27.20
  - @plitzi/sdk-navigation@0.27.20
  - @plitzi/sdk-plugins@0.27.20
  - @plitzi/sdk-schema@0.27.20
  - @plitzi/sdk-shared@0.27.20
  - @plitzi/sdk-style@0.27.20
  - @plitzi/sdk-variables@0.27.20

## 0.27.19

### Patch Changes

- v0.27.19
- Updated dependencies
  - @plitzi/sdk-auth@0.27.19
  - @plitzi/sdk-dev-tools@0.27.19
  - @plitzi/sdk-elements@0.27.19
  - @plitzi/sdk-event-bridge@0.27.19
  - @plitzi/sdk-interactions@0.27.19
  - @plitzi/sdk-navigation@0.27.19
  - @plitzi/sdk-plugins@0.27.19
  - @plitzi/sdk-schema@0.27.19
  - @plitzi/sdk-shared@0.27.19
  - @plitzi/sdk-style@0.27.19
  - @plitzi/sdk-variables@0.27.19

## 0.27.18

### Patch Changes

- v0.27.18
- Updated dependencies
  - @plitzi/sdk-auth@0.27.18
  - @plitzi/sdk-dev-tools@0.27.18
  - @plitzi/sdk-elements@0.27.18
  - @plitzi/sdk-event-bridge@0.27.18
  - @plitzi/sdk-interactions@0.27.18
  - @plitzi/sdk-navigation@0.27.18
  - @plitzi/sdk-plugins@0.27.18
  - @plitzi/sdk-schema@0.27.18
  - @plitzi/sdk-shared@0.27.18
  - @plitzi/sdk-style@0.27.18
  - @plitzi/sdk-variables@0.27.18

## 0.27.17

### Patch Changes

- v0.27.17
- Updated dependencies
  - @plitzi/sdk-interactions@0.27.17
  - @plitzi/sdk-variables@0.27.17
  - @plitzi/sdk-shared@0.27.17
  - @plitzi/sdk-style@0.27.17
  - @plitzi/sdk-auth@0.27.17
  - @plitzi/sdk-dev-tools@0.27.17
  - @plitzi/sdk-elements@0.27.17
  - @plitzi/sdk-event-bridge@0.27.17
  - @plitzi/sdk-navigation@0.27.17
  - @plitzi/sdk-plugins@0.27.17
  - @plitzi/sdk-schema@0.27.17

## 0.27.16

### Patch Changes

- v0.27.16
- Updated dependencies
  - @plitzi/sdk-shared@0.27.16
  - @plitzi/sdk-auth@0.27.16
  - @plitzi/sdk-dev-tools@0.27.16
  - @plitzi/sdk-elements@0.27.16
  - @plitzi/sdk-event-bridge@0.27.16
  - @plitzi/sdk-interactions@0.27.16
  - @plitzi/sdk-navigation@0.27.16
  - @plitzi/sdk-plugins@0.27.16
  - @plitzi/sdk-schema@0.27.16
  - @plitzi/sdk-style@0.27.16
  - @plitzi/sdk-variables@0.27.16

## 0.27.15

### Patch Changes

- v0.27.15
- Updated dependencies
  - @plitzi/sdk-auth@0.27.15
  - @plitzi/sdk-dev-tools@0.27.15
  - @plitzi/sdk-elements@0.27.15
  - @plitzi/sdk-event-bridge@0.27.15
  - @plitzi/sdk-interactions@0.27.15
  - @plitzi/sdk-navigation@0.27.15
  - @plitzi/sdk-plugins@0.27.15
  - @plitzi/sdk-schema@0.27.15
  - @plitzi/sdk-shared@0.27.15
  - @plitzi/sdk-style@0.27.15
  - @plitzi/sdk-variables@0.27.15

## 0.27.14

### Patch Changes

- v0.27.14
- Updated dependencies
  - @plitzi/sdk-auth@0.27.14
  - @plitzi/sdk-dev-tools@0.27.14
  - @plitzi/sdk-elements@0.27.14
  - @plitzi/sdk-event-bridge@0.27.14
  - @plitzi/sdk-interactions@0.27.14
  - @plitzi/sdk-navigation@0.27.14
  - @plitzi/sdk-plugins@0.27.14
  - @plitzi/sdk-schema@0.27.14
  - @plitzi/sdk-shared@0.27.14
  - @plitzi/sdk-style@0.27.14
  - @plitzi/sdk-variables@0.27.14

## 0.27.13

### Patch Changes

- v0.27.13
- Updated dependencies
  - @plitzi/sdk-auth@0.27.13
  - @plitzi/sdk-dev-tools@0.27.13
  - @plitzi/sdk-elements@0.27.13
  - @plitzi/sdk-event-bridge@0.27.13
  - @plitzi/sdk-interactions@0.27.13
  - @plitzi/sdk-navigation@0.27.13
  - @plitzi/sdk-plugins@0.27.13
  - @plitzi/sdk-schema@0.27.13
  - @plitzi/sdk-shared@0.27.13
  - @plitzi/sdk-style@0.27.13
  - @plitzi/sdk-variables@0.27.13

## 0.27.12

### Patch Changes

- v0.27.12
- Updated dependencies
  - @plitzi/sdk-auth@0.27.12
  - @plitzi/sdk-dev-tools@0.27.12
  - @plitzi/sdk-elements@0.27.12
  - @plitzi/sdk-event-bridge@0.27.12
  - @plitzi/sdk-interactions@0.27.12
  - @plitzi/sdk-navigation@0.27.12
  - @plitzi/sdk-plugins@0.27.12
  - @plitzi/sdk-schema@0.27.12
  - @plitzi/sdk-shared@0.27.12
  - @plitzi/sdk-style@0.27.12
  - @plitzi/sdk-variables@0.27.12

## 0.27.11

### Patch Changes

- v0.27.11
- Updated dependencies
  - @plitzi/sdk-style@0.27.11
  - @plitzi/sdk-auth@0.27.11
  - @plitzi/sdk-dev-tools@0.27.11
  - @plitzi/sdk-elements@0.27.11
  - @plitzi/sdk-event-bridge@0.27.11
  - @plitzi/sdk-interactions@0.27.11
  - @plitzi/sdk-navigation@0.27.11
  - @plitzi/sdk-plugins@0.27.11
  - @plitzi/sdk-schema@0.27.11
  - @plitzi/sdk-shared@0.27.11
  - @plitzi/sdk-variables@0.27.11

## 0.27.10

### Patch Changes

- v0.27.10
- Updated dependencies
  - @plitzi/sdk-auth@0.27.10
  - @plitzi/sdk-dev-tools@0.27.10
  - @plitzi/sdk-elements@0.27.10
  - @plitzi/sdk-event-bridge@0.27.10
  - @plitzi/sdk-interactions@0.27.10
  - @plitzi/sdk-navigation@0.27.10
  - @plitzi/sdk-plugins@0.27.10
  - @plitzi/sdk-schema@0.27.10
  - @plitzi/sdk-shared@0.27.10
  - @plitzi/sdk-style@0.27.10
  - @plitzi/sdk-variables@0.27.10

## 0.27.9

### Patch Changes

- v0.27.9
- Updated dependencies
  - @plitzi/sdk-auth@0.27.9
  - @plitzi/sdk-dev-tools@0.27.9
  - @plitzi/sdk-elements@0.27.9
  - @plitzi/sdk-event-bridge@0.27.9
  - @plitzi/sdk-interactions@0.27.9
  - @plitzi/sdk-navigation@0.27.9
  - @plitzi/sdk-plugins@0.27.9
  - @plitzi/sdk-schema@0.27.9
  - @plitzi/sdk-shared@0.27.9
  - @plitzi/sdk-style@0.27.9
  - @plitzi/sdk-variables@0.27.9

## 0.27.8

### Patch Changes

- v0.27.8
- Updated dependencies
  - @plitzi/sdk-shared@0.27.8
  - @plitzi/sdk-auth@0.27.8
  - @plitzi/sdk-dev-tools@0.27.8
  - @plitzi/sdk-elements@0.27.8
  - @plitzi/sdk-event-bridge@0.27.8
  - @plitzi/sdk-interactions@0.27.8
  - @plitzi/sdk-navigation@0.27.8
  - @plitzi/sdk-plugins@0.27.8
  - @plitzi/sdk-schema@0.27.8
  - @plitzi/sdk-style@0.27.8
  - @plitzi/sdk-variables@0.27.8

## 0.27.7

### Patch Changes

- v0.27.7
- Updated dependencies
  - @plitzi/sdk-auth@0.27.7
  - @plitzi/sdk-dev-tools@0.27.7
  - @plitzi/sdk-elements@0.27.7
  - @plitzi/sdk-event-bridge@0.27.7
  - @plitzi/sdk-interactions@0.27.7
  - @plitzi/sdk-navigation@0.27.7
  - @plitzi/sdk-plugins@0.27.7
  - @plitzi/sdk-schema@0.27.7
  - @plitzi/sdk-shared@0.27.7
  - @plitzi/sdk-style@0.27.7
  - @plitzi/sdk-variables@0.27.7

## 0.27.6

### Patch Changes

- v0.27.6
- Updated dependencies
  - @plitzi/sdk-auth@0.27.6
  - @plitzi/sdk-dev-tools@0.27.6
  - @plitzi/sdk-elements@0.27.6
  - @plitzi/sdk-event-bridge@0.27.6
  - @plitzi/sdk-interactions@0.27.6
  - @plitzi/sdk-navigation@0.27.6
  - @plitzi/sdk-plugins@0.27.6
  - @plitzi/sdk-schema@0.27.6
  - @plitzi/sdk-shared@0.27.6
  - @plitzi/sdk-style@0.27.6
  - @plitzi/sdk-variables@0.27.6

## 0.27.5

### Patch Changes

- v0.27.5
- Updated dependencies
  - @plitzi/sdk-auth@0.27.5
  - @plitzi/sdk-dev-tools@0.27.5
  - @plitzi/sdk-elements@0.27.5
  - @plitzi/sdk-event-bridge@0.27.5
  - @plitzi/sdk-interactions@0.27.5
  - @plitzi/sdk-navigation@0.27.5
  - @plitzi/sdk-plugins@0.27.5
  - @plitzi/sdk-schema@0.27.5
  - @plitzi/sdk-shared@0.27.5
  - @plitzi/sdk-style@0.27.5
  - @plitzi/sdk-variables@0.27.5

## 0.27.4

### Patch Changes

- v0.27.4
- Updated dependencies
  - @plitzi/sdk-auth@0.27.4
  - @plitzi/sdk-dev-tools@0.27.4
  - @plitzi/sdk-elements@0.27.4
  - @plitzi/sdk-event-bridge@0.27.4
  - @plitzi/sdk-interactions@0.27.4
  - @plitzi/sdk-navigation@0.27.4
  - @plitzi/sdk-plugins@0.27.4
  - @plitzi/sdk-schema@0.27.4
  - @plitzi/sdk-shared@0.27.4
  - @plitzi/sdk-style@0.27.4
  - @plitzi/sdk-variables@0.27.4

## 0.27.3

### Patch Changes

- v0.27.3
- Updated dependencies
  - @plitzi/sdk-auth@0.27.3
  - @plitzi/sdk-dev-tools@0.27.3
  - @plitzi/sdk-elements@0.27.3
  - @plitzi/sdk-event-bridge@0.27.3
  - @plitzi/sdk-interactions@0.27.3
  - @plitzi/sdk-navigation@0.27.3
  - @plitzi/sdk-plugins@0.27.3
  - @plitzi/sdk-schema@0.27.3
  - @plitzi/sdk-shared@0.27.3
  - @plitzi/sdk-style@0.27.3
  - @plitzi/sdk-variables@0.27.3

## 0.27.2

### Patch Changes

- v0.27.2
- Updated dependencies
  - @plitzi/sdk-auth@0.27.2
  - @plitzi/sdk-dev-tools@0.27.2
  - @plitzi/sdk-elements@0.27.2
  - @plitzi/sdk-event-bridge@0.27.2
  - @plitzi/sdk-interactions@0.27.2
  - @plitzi/sdk-navigation@0.27.2
  - @plitzi/sdk-plugins@0.27.2
  - @plitzi/sdk-schema@0.27.2
  - @plitzi/sdk-shared@0.27.2
  - @plitzi/sdk-style@0.27.2
  - @plitzi/sdk-variables@0.27.2

## 0.27.1

### Patch Changes

- v0.27.1
- Updated dependencies
  - @plitzi/sdk-navigation@0.27.1
  - @plitzi/sdk-dev-tools@0.27.1
  - @plitzi/sdk-elements@0.27.1
  - @plitzi/sdk-shared@0.27.1
  - @plitzi/sdk-auth@0.27.1
  - @plitzi/sdk-event-bridge@0.27.1
  - @plitzi/sdk-interactions@0.27.1
  - @plitzi/sdk-plugins@0.27.1
  - @plitzi/sdk-schema@0.27.1
  - @plitzi/sdk-style@0.27.1
  - @plitzi/sdk-variables@0.27.1

## 0.27.0

### Minor Changes

- v0.27.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.27.0
  - @plitzi/sdk-dev-tools@0.27.0
  - @plitzi/sdk-elements@0.27.0
  - @plitzi/sdk-event-bridge@0.27.0
  - @plitzi/sdk-interactions@0.27.0
  - @plitzi/sdk-navigation@0.27.0
  - @plitzi/sdk-plugins@0.27.0
  - @plitzi/sdk-schema@0.27.0
  - @plitzi/sdk-shared@0.27.0
  - @plitzi/sdk-style@0.27.0
  - @plitzi/sdk-variables@0.27.0

## 0.26.5

### Patch Changes

- v0.26.5
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.26.5
  - @plitzi/sdk-interactions@0.26.5
  - @plitzi/sdk-navigation@0.26.5
  - @plitzi/sdk-dev-tools@0.26.5
  - @plitzi/sdk-variables@0.26.5
  - @plitzi/sdk-elements@0.26.5
  - @plitzi/sdk-plugins@0.26.5
  - @plitzi/sdk-schema@0.26.5
  - @plitzi/sdk-shared@0.26.5
  - @plitzi/sdk-style@0.26.5
  - @plitzi/sdk-auth@0.26.5

## 0.26.4

### Patch Changes

- v0.26.4
- Updated dependencies
  - @plitzi/sdk-auth@0.26.4
  - @plitzi/sdk-dev-tools@0.26.4
  - @plitzi/sdk-elements@0.26.4
  - @plitzi/sdk-event-bridge@0.26.4
  - @plitzi/sdk-interactions@0.26.4
  - @plitzi/sdk-navigation@0.26.4
  - @plitzi/sdk-plugins@0.26.4
  - @plitzi/sdk-schema@0.26.4
  - @plitzi/sdk-shared@0.26.4
  - @plitzi/sdk-style@0.26.4
  - @plitzi/sdk-variables@0.26.4

## 0.26.3

### Patch Changes

- v0.26.3
- Updated dependencies
  - @plitzi/sdk-auth@0.26.3
  - @plitzi/sdk-dev-tools@0.26.3
  - @plitzi/sdk-elements@0.26.3
  - @plitzi/sdk-event-bridge@0.26.3
  - @plitzi/sdk-interactions@0.26.3
  - @plitzi/sdk-navigation@0.26.3
  - @plitzi/sdk-plugins@0.26.3
  - @plitzi/sdk-schema@0.26.3
  - @plitzi/sdk-shared@0.26.3
  - @plitzi/sdk-style@0.26.3
  - @plitzi/sdk-variables@0.26.3

## 0.26.2

### Patch Changes

- v0.26.2
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.26.2
  - @plitzi/sdk-interactions@0.26.2
  - @plitzi/sdk-navigation@0.26.2
  - @plitzi/sdk-dev-tools@0.26.2
  - @plitzi/sdk-variables@0.26.2
  - @plitzi/sdk-elements@0.26.2
  - @plitzi/sdk-plugins@0.26.2
  - @plitzi/sdk-schema@0.26.2
  - @plitzi/sdk-shared@0.26.2
  - @plitzi/sdk-style@0.26.2
  - @plitzi/sdk-auth@0.26.2

## 0.26.1

### Patch Changes

- v0.26.1
- Updated dependencies
  - @plitzi/sdk-auth@0.26.1
  - @plitzi/sdk-dev-tools@0.26.1
  - @plitzi/sdk-elements@0.26.1
  - @plitzi/sdk-event-bridge@0.26.1
  - @plitzi/sdk-interactions@0.26.1
  - @plitzi/sdk-navigation@0.26.1
  - @plitzi/sdk-plugins@0.26.1
  - @plitzi/sdk-schema@0.26.1
  - @plitzi/sdk-shared@0.26.1
  - @plitzi/sdk-style@0.26.1
  - @plitzi/sdk-variables@0.26.1

## 0.26.0

### Minor Changes

- v0.26.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.26.0
  - @plitzi/sdk-dev-tools@0.26.0
  - @plitzi/sdk-elements@0.26.0
  - @plitzi/sdk-event-bridge@0.26.0
  - @plitzi/sdk-interactions@0.26.0
  - @plitzi/sdk-navigation@0.26.0
  - @plitzi/sdk-plugins@0.26.0
  - @plitzi/sdk-schema@0.26.0
  - @plitzi/sdk-shared@0.26.0
  - @plitzi/sdk-style@0.26.0
  - @plitzi/sdk-variables@0.26.0

## 0.25.12

### Patch Changes

- v0.25.12
- Updated dependencies
  - @plitzi/sdk-auth@0.25.12
  - @plitzi/sdk-dev-tools@0.25.12
  - @plitzi/sdk-elements@0.25.12
  - @plitzi/sdk-event-bridge@0.25.12
  - @plitzi/sdk-interactions@0.25.12
  - @plitzi/sdk-navigation@0.25.12
  - @plitzi/sdk-plugins@0.25.12
  - @plitzi/sdk-schema@0.25.12
  - @plitzi/sdk-shared@0.25.12
  - @plitzi/sdk-style@0.25.12
  - @plitzi/sdk-variables@0.25.12

## 0.25.11

### Patch Changes

- v0.25.11
- Updated dependencies
  - @plitzi/sdk-auth@0.25.11
  - @plitzi/sdk-dev-tools@0.25.11
  - @plitzi/sdk-elements@0.25.11
  - @plitzi/sdk-event-bridge@0.25.11
  - @plitzi/sdk-interactions@0.25.11
  - @plitzi/sdk-navigation@0.25.11
  - @plitzi/sdk-plugins@0.25.11
  - @plitzi/sdk-schema@0.25.11
  - @plitzi/sdk-shared@0.25.11
  - @plitzi/sdk-style@0.25.11
  - @plitzi/sdk-variables@0.25.11

## 0.25.10

### Patch Changes

- v0.25.10
- Updated dependencies
  - @plitzi/sdk-auth@0.25.10
  - @plitzi/sdk-dev-tools@0.25.10
  - @plitzi/sdk-elements@0.25.10
  - @plitzi/sdk-event-bridge@0.25.10
  - @plitzi/sdk-interactions@0.25.10
  - @plitzi/sdk-navigation@0.25.10
  - @plitzi/sdk-plugins@0.25.10
  - @plitzi/sdk-schema@0.25.10
  - @plitzi/sdk-shared@0.25.10
  - @plitzi/sdk-style@0.25.10
  - @plitzi/sdk-variables@0.25.10

## 0.25.9

### Patch Changes

- v0.25.9
- Updated dependencies
  - @plitzi/sdk-auth@0.25.9
  - @plitzi/sdk-dev-tools@0.25.9
  - @plitzi/sdk-elements@0.25.9
  - @plitzi/sdk-event-bridge@0.25.9
  - @plitzi/sdk-interactions@0.25.9
  - @plitzi/sdk-navigation@0.25.9
  - @plitzi/sdk-plugins@0.25.9
  - @plitzi/sdk-schema@0.25.9
  - @plitzi/sdk-shared@0.25.9
  - @plitzi/sdk-style@0.25.9
  - @plitzi/sdk-variables@0.25.9

## 0.25.8

### Patch Changes

- v0.25.8
- Updated dependencies
  - @plitzi/sdk-auth@0.25.8
  - @plitzi/sdk-dev-tools@0.25.8
  - @plitzi/sdk-elements@0.25.8
  - @plitzi/sdk-event-bridge@0.25.8
  - @plitzi/sdk-interactions@0.25.8
  - @plitzi/sdk-navigation@0.25.8
  - @plitzi/sdk-plugins@0.25.8
  - @plitzi/sdk-schema@0.25.8
  - @plitzi/sdk-shared@0.25.8
  - @plitzi/sdk-style@0.25.8
  - @plitzi/sdk-variables@0.25.8

## 0.25.7

### Patch Changes

- v0.25.7
- Updated dependencies
  - @plitzi/sdk-elements@0.25.7
  - @plitzi/sdk-auth@0.25.7
  - @plitzi/sdk-dev-tools@0.25.7
  - @plitzi/sdk-event-bridge@0.25.7
  - @plitzi/sdk-interactions@0.25.7
  - @plitzi/sdk-navigation@0.25.7
  - @plitzi/sdk-plugins@0.25.7
  - @plitzi/sdk-schema@0.25.7
  - @plitzi/sdk-shared@0.25.7
  - @plitzi/sdk-style@0.25.7
  - @plitzi/sdk-variables@0.25.7

## 0.25.6

### Patch Changes

- v0.25.6
- Updated dependencies
  - @plitzi/sdk-variables@0.25.6
  - @plitzi/sdk-auth@0.25.6
  - @plitzi/sdk-dev-tools@0.25.6
  - @plitzi/sdk-elements@0.25.6
  - @plitzi/sdk-event-bridge@0.25.6
  - @plitzi/sdk-interactions@0.25.6
  - @plitzi/sdk-navigation@0.25.6
  - @plitzi/sdk-plugins@0.25.6
  - @plitzi/sdk-schema@0.25.6
  - @plitzi/sdk-shared@0.25.6
  - @plitzi/sdk-style@0.25.6

## 0.25.5

### Patch Changes

- v0.25.5
- Updated dependencies
  - @plitzi/sdk-auth@0.25.5
  - @plitzi/sdk-dev-tools@0.25.5
  - @plitzi/sdk-elements@0.25.5
  - @plitzi/sdk-event-bridge@0.25.5
  - @plitzi/sdk-interactions@0.25.5
  - @plitzi/sdk-navigation@0.25.5
  - @plitzi/sdk-plugins@0.25.5
  - @plitzi/sdk-schema@0.25.5
  - @plitzi/sdk-shared@0.25.5
  - @plitzi/sdk-style@0.25.5
  - @plitzi/sdk-variables@0.25.5

## 0.25.4

### Patch Changes

- v0.25.4
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.25.4
  - @plitzi/sdk-interactions@0.25.4
  - @plitzi/sdk-navigation@0.25.4
  - @plitzi/sdk-dev-tools@0.25.4
  - @plitzi/sdk-variables@0.25.4
  - @plitzi/sdk-elements@0.25.4
  - @plitzi/sdk-plugins@0.25.4
  - @plitzi/sdk-schema@0.25.4
  - @plitzi/sdk-shared@0.25.4
  - @plitzi/sdk-style@0.25.4
  - @plitzi/sdk-auth@0.25.4

## 0.25.3

### Patch Changes

- v0.25.3
- Updated dependencies
  - @plitzi/sdk-auth@0.25.3
  - @plitzi/sdk-dev-tools@0.25.3
  - @plitzi/sdk-elements@0.25.3
  - @plitzi/sdk-event-bridge@0.25.3
  - @plitzi/sdk-interactions@0.25.3
  - @plitzi/sdk-navigation@0.25.3
  - @plitzi/sdk-plugins@0.25.3
  - @plitzi/sdk-schema@0.25.3
  - @plitzi/sdk-shared@0.25.3
  - @plitzi/sdk-style@0.25.3
  - @plitzi/sdk-variables@0.25.3

## 0.25.2

### Patch Changes

- v0.25.2
- Updated dependencies
  - @plitzi/sdk-navigation@0.25.2
  - @plitzi/sdk-elements@0.25.2
  - @plitzi/sdk-schema@0.25.2
  - @plitzi/sdk-shared@0.25.2
  - @plitzi/sdk-style@0.25.2
  - @plitzi/sdk-auth@0.25.2
  - @plitzi/sdk-dev-tools@0.25.2
  - @plitzi/sdk-event-bridge@0.25.2
  - @plitzi/sdk-interactions@0.25.2
  - @plitzi/sdk-plugins@0.25.2
  - @plitzi/sdk-variables@0.25.2

## 0.25.1

### Patch Changes

- v0.25.1
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.25.1
  - @plitzi/sdk-interactions@0.25.1
  - @plitzi/sdk-navigation@0.25.1
  - @plitzi/sdk-dev-tools@0.25.1
  - @plitzi/sdk-variables@0.25.1
  - @plitzi/sdk-elements@0.25.1
  - @plitzi/sdk-plugins@0.25.1
  - @plitzi/sdk-schema@0.25.1
  - @plitzi/sdk-shared@0.25.1
  - @plitzi/sdk-style@0.25.1
  - @plitzi/sdk-auth@0.25.1

## 0.25.0

### Minor Changes

- v0.25.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.25.0
  - @plitzi/sdk-dev-tools@0.25.0
  - @plitzi/sdk-elements@0.25.0
  - @plitzi/sdk-event-bridge@0.25.0
  - @plitzi/sdk-interactions@0.25.0
  - @plitzi/sdk-navigation@0.25.0
  - @plitzi/sdk-plugins@0.25.0
  - @plitzi/sdk-schema@0.25.0
  - @plitzi/sdk-shared@0.25.0
  - @plitzi/sdk-style@0.25.0
  - @plitzi/sdk-variables@0.25.0

## 0.24.12

### Patch Changes

- v0.24.12
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.12
  - @plitzi/sdk-interactions@0.24.12
  - @plitzi/sdk-navigation@0.24.12
  - @plitzi/sdk-dev-tools@0.24.12
  - @plitzi/sdk-variables@0.24.12
  - @plitzi/sdk-elements@0.24.12
  - @plitzi/sdk-plugins@0.24.12
  - @plitzi/sdk-schema@0.24.12
  - @plitzi/sdk-shared@0.24.12
  - @plitzi/sdk-style@0.24.12
  - @plitzi/sdk-auth@0.24.12

## 0.24.11

### Patch Changes

- v0.24.11
- Updated dependencies
  - @plitzi/sdk-auth@0.24.11
  - @plitzi/sdk-dev-tools@0.24.11
  - @plitzi/sdk-elements@0.24.11
  - @plitzi/sdk-event-bridge@0.24.11
  - @plitzi/sdk-interactions@0.24.11
  - @plitzi/sdk-navigation@0.24.11
  - @plitzi/sdk-plugins@0.24.11
  - @plitzi/sdk-schema@0.24.11
  - @plitzi/sdk-shared@0.24.11
  - @plitzi/sdk-style@0.24.11
  - @plitzi/sdk-variables@0.24.11

## 0.24.10

### Patch Changes

- v0.24.10
- Updated dependencies
  - @plitzi/sdk-elements@0.24.10
  - @plitzi/sdk-auth@0.24.10
  - @plitzi/sdk-dev-tools@0.24.10
  - @plitzi/sdk-event-bridge@0.24.10
  - @plitzi/sdk-interactions@0.24.10
  - @plitzi/sdk-navigation@0.24.10
  - @plitzi/sdk-plugins@0.24.10
  - @plitzi/sdk-schema@0.24.10
  - @plitzi/sdk-shared@0.24.10
  - @plitzi/sdk-style@0.24.10
  - @plitzi/sdk-variables@0.24.10

## 0.24.9

### Patch Changes

- v0.24.9
- Updated dependencies
  - @plitzi/sdk-elements@0.24.9
  - @plitzi/sdk-shared@0.24.9
  - @plitzi/sdk-auth@0.24.9
  - @plitzi/sdk-dev-tools@0.24.9
  - @plitzi/sdk-event-bridge@0.24.9
  - @plitzi/sdk-interactions@0.24.9
  - @plitzi/sdk-navigation@0.24.9
  - @plitzi/sdk-plugins@0.24.9
  - @plitzi/sdk-schema@0.24.9
  - @plitzi/sdk-style@0.24.9
  - @plitzi/sdk-variables@0.24.9

## 0.24.8

### Patch Changes

- v0.24.8
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.8
  - @plitzi/sdk-interactions@0.24.8
  - @plitzi/sdk-navigation@0.24.8
  - @plitzi/sdk-dev-tools@0.24.8
  - @plitzi/sdk-variables@0.24.8
  - @plitzi/sdk-elements@0.24.8
  - @plitzi/sdk-plugins@0.24.8
  - @plitzi/sdk-schema@0.24.8
  - @plitzi/sdk-shared@0.24.8
  - @plitzi/sdk-style@0.24.8
  - @plitzi/sdk-auth@0.24.8

## 0.24.7

### Patch Changes

- v0.24.7
- Updated dependencies
  - @plitzi/sdk-auth@0.24.7
  - @plitzi/sdk-dev-tools@0.24.7
  - @plitzi/sdk-elements@0.24.7
  - @plitzi/sdk-event-bridge@0.24.7
  - @plitzi/sdk-interactions@0.24.7
  - @plitzi/sdk-navigation@0.24.7
  - @plitzi/sdk-plugins@0.24.7
  - @plitzi/sdk-schema@0.24.7
  - @plitzi/sdk-shared@0.24.7
  - @plitzi/sdk-style@0.24.7
  - @plitzi/sdk-variables@0.24.7

## 0.24.6

### Patch Changes

- v0.24.6
- Updated dependencies
  - @plitzi/sdk-style@0.24.6
  - @plitzi/sdk-auth@0.24.6
  - @plitzi/sdk-dev-tools@0.24.6
  - @plitzi/sdk-elements@0.24.6
  - @plitzi/sdk-event-bridge@0.24.6
  - @plitzi/sdk-interactions@0.24.6
  - @plitzi/sdk-navigation@0.24.6
  - @plitzi/sdk-plugins@0.24.6
  - @plitzi/sdk-schema@0.24.6
  - @plitzi/sdk-shared@0.24.6
  - @plitzi/sdk-variables@0.24.6

## 0.24.5

### Patch Changes

- v0.24.5
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.5
  - @plitzi/sdk-interactions@0.24.5
  - @plitzi/sdk-navigation@0.24.5
  - @plitzi/sdk-dev-tools@0.24.5
  - @plitzi/sdk-variables@0.24.5
  - @plitzi/sdk-elements@0.24.5
  - @plitzi/sdk-plugins@0.24.5
  - @plitzi/sdk-schema@0.24.5
  - @plitzi/sdk-shared@0.24.5
  - @plitzi/sdk-style@0.24.5
  - @plitzi/sdk-auth@0.24.5

## 0.24.4

### Patch Changes

- v0.24.4
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.4
  - @plitzi/sdk-interactions@0.24.4
  - @plitzi/sdk-navigation@0.24.4
  - @plitzi/sdk-dev-tools@0.24.4
  - @plitzi/sdk-variables@0.24.4
  - @plitzi/sdk-elements@0.24.4
  - @plitzi/sdk-plugins@0.24.4
  - @plitzi/sdk-schema@0.24.4
  - @plitzi/sdk-shared@0.24.4
  - @plitzi/sdk-style@0.24.4
  - @plitzi/sdk-auth@0.24.4

## 0.24.3

### Patch Changes

- v0.24.3
- Updated dependencies
  - @plitzi/sdk-variables@0.24.3
  - @plitzi/sdk-schema@0.24.3
  - @plitzi/sdk-style@0.24.3
  - @plitzi/sdk-auth@0.24.3
  - @plitzi/sdk-dev-tools@0.24.3
  - @plitzi/sdk-elements@0.24.3
  - @plitzi/sdk-event-bridge@0.24.3
  - @plitzi/sdk-interactions@0.24.3
  - @plitzi/sdk-navigation@0.24.3
  - @plitzi/sdk-plugins@0.24.3
  - @plitzi/sdk-shared@0.24.3

## 0.24.2

### Patch Changes

- v0.24.2
- Updated dependencies
  - @plitzi/sdk-auth@0.24.2
  - @plitzi/sdk-dev-tools@0.24.2
  - @plitzi/sdk-elements@0.24.2
  - @plitzi/sdk-event-bridge@0.24.2
  - @plitzi/sdk-interactions@0.24.2
  - @plitzi/sdk-navigation@0.24.2
  - @plitzi/sdk-plugins@0.24.2
  - @plitzi/sdk-schema@0.24.2
  - @plitzi/sdk-shared@0.24.2
  - @plitzi/sdk-style@0.24.2
  - @plitzi/sdk-variables@0.24.2

## 0.24.1

### Patch Changes

- v0.24.1
- Updated dependencies
  - @plitzi/sdk-auth@0.24.1
  - @plitzi/sdk-dev-tools@0.24.1
  - @plitzi/sdk-elements@0.24.1
  - @plitzi/sdk-event-bridge@0.24.1
  - @plitzi/sdk-interactions@0.24.1
  - @plitzi/sdk-navigation@0.24.1
  - @plitzi/sdk-plugins@0.24.1
  - @plitzi/sdk-schema@0.24.1
  - @plitzi/sdk-shared@0.24.1
  - @plitzi/sdk-style@0.24.1
  - @plitzi/sdk-variables@0.24.1

## 0.24.0

### Minor Changes

- v0.24.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.24.0
  - @plitzi/sdk-dev-tools@0.24.0
  - @plitzi/sdk-elements@0.24.0
  - @plitzi/sdk-event-bridge@0.24.0
  - @plitzi/sdk-interactions@0.24.0
  - @plitzi/sdk-navigation@0.24.0
  - @plitzi/sdk-plugins@0.24.0
  - @plitzi/sdk-schema@0.24.0
  - @plitzi/sdk-shared@0.24.0
  - @plitzi/sdk-style@0.24.0
  - @plitzi/sdk-variables@0.24.0

## 0.23.24

### Patch Changes

- v0.23.24
- Updated dependencies
  - @plitzi/sdk-auth@0.23.24
  - @plitzi/sdk-dev-tools@0.23.24
  - @plitzi/sdk-elements@0.23.24
  - @plitzi/sdk-event-bridge@0.23.24
  - @plitzi/sdk-interactions@0.23.24
  - @plitzi/sdk-navigation@0.23.24
  - @plitzi/sdk-plugins@0.23.24
  - @plitzi/sdk-schema@0.23.24
  - @plitzi/sdk-shared@0.23.24
  - @plitzi/sdk-style@0.23.24
  - @plitzi/sdk-variables@0.23.24

## 0.23.23

### Patch Changes

- v0.23.23
- Updated dependencies
  - @plitzi/sdk-auth@0.23.23
  - @plitzi/sdk-dev-tools@0.23.23
  - @plitzi/sdk-elements@0.23.23
  - @plitzi/sdk-event-bridge@0.23.23
  - @plitzi/sdk-interactions@0.23.23
  - @plitzi/sdk-navigation@0.23.23
  - @plitzi/sdk-plugins@0.23.23
  - @plitzi/sdk-schema@0.23.23
  - @plitzi/sdk-shared@0.23.23
  - @plitzi/sdk-style@0.23.23
  - @plitzi/sdk-variables@0.23.23

## 0.23.22

### Patch Changes

- v0.23.22
- Updated dependencies
  - @plitzi/sdk-auth@0.23.22
  - @plitzi/sdk-dev-tools@0.23.22
  - @plitzi/sdk-elements@0.23.22
  - @plitzi/sdk-event-bridge@0.23.22
  - @plitzi/sdk-interactions@0.23.22
  - @plitzi/sdk-navigation@0.23.22
  - @plitzi/sdk-plugins@0.23.22
  - @plitzi/sdk-schema@0.23.22
  - @plitzi/sdk-shared@0.23.22
  - @plitzi/sdk-style@0.23.22
  - @plitzi/sdk-variables@0.23.22

## 0.23.21

### Patch Changes

- v0.23.21
- Updated dependencies
  - @plitzi/sdk-auth@0.23.21
  - @plitzi/sdk-dev-tools@0.23.21
  - @plitzi/sdk-elements@0.23.21
  - @plitzi/sdk-event-bridge@0.23.21
  - @plitzi/sdk-interactions@0.23.21
  - @plitzi/sdk-navigation@0.23.21
  - @plitzi/sdk-plugins@0.23.21
  - @plitzi/sdk-schema@0.23.21
  - @plitzi/sdk-shared@0.23.21
  - @plitzi/sdk-style@0.23.21
  - @plitzi/sdk-variables@0.23.21

## 0.23.20

### Patch Changes

- v0.23.20
- Updated dependencies
  - @plitzi/sdk-auth@0.23.20
  - @plitzi/sdk-dev-tools@0.23.20
  - @plitzi/sdk-elements@0.23.20
  - @plitzi/sdk-event-bridge@0.23.20
  - @plitzi/sdk-interactions@0.23.20
  - @plitzi/sdk-navigation@0.23.20
  - @plitzi/sdk-plugins@0.23.20
  - @plitzi/sdk-schema@0.23.20
  - @plitzi/sdk-shared@0.23.20
  - @plitzi/sdk-style@0.23.20
  - @plitzi/sdk-variables@0.23.20

## 0.23.19

### Patch Changes

- v0.23.19
- Updated dependencies
  - @plitzi/sdk-auth@0.23.19
  - @plitzi/sdk-dev-tools@0.23.19
  - @plitzi/sdk-elements@0.23.19
  - @plitzi/sdk-event-bridge@0.23.19
  - @plitzi/sdk-interactions@0.23.19
  - @plitzi/sdk-navigation@0.23.19
  - @plitzi/sdk-plugins@0.23.19
  - @plitzi/sdk-schema@0.23.19
  - @plitzi/sdk-shared@0.23.19
  - @plitzi/sdk-style@0.23.19
  - @plitzi/sdk-variables@0.23.19

## 0.23.18

### Patch Changes

- v0.23.18
- Updated dependencies
  - @plitzi/sdk-auth@0.23.18
  - @plitzi/sdk-dev-tools@0.23.18
  - @plitzi/sdk-elements@0.23.18
  - @plitzi/sdk-event-bridge@0.23.18
  - @plitzi/sdk-interactions@0.23.18
  - @plitzi/sdk-navigation@0.23.18
  - @plitzi/sdk-plugins@0.23.18
  - @plitzi/sdk-schema@0.23.18
  - @plitzi/sdk-shared@0.23.18
  - @plitzi/sdk-style@0.23.18
  - @plitzi/sdk-variables@0.23.18

## 0.23.17

### Patch Changes

- v0.23.17
- Updated dependencies
  - @plitzi/sdk-auth@0.23.17
  - @plitzi/sdk-dev-tools@0.23.17
  - @plitzi/sdk-elements@0.23.17
  - @plitzi/sdk-event-bridge@0.23.17
  - @plitzi/sdk-interactions@0.23.17
  - @plitzi/sdk-navigation@0.23.17
  - @plitzi/sdk-plugins@0.23.17
  - @plitzi/sdk-schema@0.23.17
  - @plitzi/sdk-shared@0.23.17
  - @plitzi/sdk-style@0.23.17
  - @plitzi/sdk-variables@0.23.17

## 0.23.16

### Patch Changes

- v0.23.16
- Updated dependencies
  - @plitzi/sdk-auth@0.23.16
  - @plitzi/sdk-dev-tools@0.23.16
  - @plitzi/sdk-elements@0.23.16
  - @plitzi/sdk-event-bridge@0.23.16
  - @plitzi/sdk-interactions@0.23.16
  - @plitzi/sdk-navigation@0.23.16
  - @plitzi/sdk-plugins@0.23.16
  - @plitzi/sdk-schema@0.23.16
  - @plitzi/sdk-shared@0.23.16
  - @plitzi/sdk-style@0.23.16
  - @plitzi/sdk-variables@0.23.16

## 0.23.15

### Patch Changes

- v0.23.15
- Updated dependencies
  - @plitzi/sdk-auth@0.23.15
  - @plitzi/sdk-dev-tools@0.23.15
  - @plitzi/sdk-elements@0.23.15
  - @plitzi/sdk-event-bridge@0.23.15
  - @plitzi/sdk-interactions@0.23.15
  - @plitzi/sdk-navigation@0.23.15
  - @plitzi/sdk-plugins@0.23.15
  - @plitzi/sdk-schema@0.23.15
  - @plitzi/sdk-shared@0.23.15
  - @plitzi/sdk-style@0.23.15
  - @plitzi/sdk-variables@0.23.15

## 0.23.14

### Patch Changes

- v0.23.14
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.23.14
  - @plitzi/sdk-interactions@0.23.14
  - @plitzi/sdk-navigation@0.23.14
  - @plitzi/sdk-dev-tools@0.23.14
  - @plitzi/sdk-variables@0.23.14
  - @plitzi/sdk-elements@0.23.14
  - @plitzi/sdk-plugins@0.23.14
  - @plitzi/sdk-schema@0.23.14
  - @plitzi/sdk-shared@0.23.14
  - @plitzi/sdk-style@0.23.14
  - @plitzi/sdk-auth@0.23.14

## 0.23.13

### Patch Changes

- v0.23.13
- Updated dependencies
  - @plitzi/sdk-elements@0.23.13
  - @plitzi/sdk-auth@0.23.13
  - @plitzi/sdk-dev-tools@0.23.13
  - @plitzi/sdk-event-bridge@0.23.13
  - @plitzi/sdk-interactions@0.23.13
  - @plitzi/sdk-navigation@0.23.13
  - @plitzi/sdk-plugins@0.23.13
  - @plitzi/sdk-schema@0.23.13
  - @plitzi/sdk-shared@0.23.13
  - @plitzi/sdk-style@0.23.13
  - @plitzi/sdk-variables@0.23.13

## 0.23.12

### Patch Changes

- v0.23.12
- Updated dependencies
  - @plitzi/sdk-auth@0.23.12
  - @plitzi/sdk-dev-tools@0.23.12
  - @plitzi/sdk-elements@0.23.12
  - @plitzi/sdk-event-bridge@0.23.12
  - @plitzi/sdk-interactions@0.23.12
  - @plitzi/sdk-navigation@0.23.12
  - @plitzi/sdk-plugins@0.23.12
  - @plitzi/sdk-schema@0.23.12
  - @plitzi/sdk-shared@0.23.12
  - @plitzi/sdk-style@0.23.12
  - @plitzi/sdk-variables@0.23.12

## 0.23.11

### Patch Changes

- v0.23.11
- Updated dependencies
  - @plitzi/sdk-elements@0.23.11
  - @plitzi/sdk-auth@0.23.11
  - @plitzi/sdk-dev-tools@0.23.11
  - @plitzi/sdk-event-bridge@0.23.11
  - @plitzi/sdk-interactions@0.23.11
  - @plitzi/sdk-navigation@0.23.11
  - @plitzi/sdk-plugins@0.23.11
  - @plitzi/sdk-schema@0.23.11
  - @plitzi/sdk-shared@0.23.11
  - @plitzi/sdk-style@0.23.11
  - @plitzi/sdk-variables@0.23.11

## 0.23.10

### Patch Changes

- v0.23.10
- Updated dependencies
  - @plitzi/sdk-auth@0.23.10
  - @plitzi/sdk-dev-tools@0.23.10
  - @plitzi/sdk-elements@0.23.10
  - @plitzi/sdk-event-bridge@0.23.10
  - @plitzi/sdk-interactions@0.23.10
  - @plitzi/sdk-navigation@0.23.10
  - @plitzi/sdk-plugins@0.23.10
  - @plitzi/sdk-schema@0.23.10
  - @plitzi/sdk-shared@0.23.10
  - @plitzi/sdk-style@0.23.10
  - @plitzi/sdk-variables@0.23.10

## 0.23.9

### Patch Changes

- v0.23.9
- Updated dependencies
  - @plitzi/sdk-auth@0.23.9
  - @plitzi/sdk-dev-tools@0.23.9
  - @plitzi/sdk-elements@0.23.9
  - @plitzi/sdk-event-bridge@0.23.9
  - @plitzi/sdk-interactions@0.23.9
  - @plitzi/sdk-navigation@0.23.9
  - @plitzi/sdk-plugins@0.23.9
  - @plitzi/sdk-schema@0.23.9
  - @plitzi/sdk-shared@0.23.9
  - @plitzi/sdk-style@0.23.9
  - @plitzi/sdk-variables@0.23.9

## 0.23.8

### Patch Changes

- v0.23.8
- Updated dependencies
  - @plitzi/sdk-auth@0.23.8
  - @plitzi/sdk-dev-tools@0.23.8
  - @plitzi/sdk-elements@0.23.8
  - @plitzi/sdk-event-bridge@0.23.8
  - @plitzi/sdk-interactions@0.23.8
  - @plitzi/sdk-navigation@0.23.8
  - @plitzi/sdk-plugins@0.23.8
  - @plitzi/sdk-schema@0.23.8
  - @plitzi/sdk-shared@0.23.8
  - @plitzi/sdk-style@0.23.8
  - @plitzi/sdk-variables@0.23.8

## 0.23.7

### Patch Changes

- v0.23.7
- Updated dependencies
  - @plitzi/sdk-elements@0.23.7
  - @plitzi/sdk-shared@0.23.7
  - @plitzi/sdk-auth@0.23.7
  - @plitzi/sdk-dev-tools@0.23.7
  - @plitzi/sdk-event-bridge@0.23.7
  - @plitzi/sdk-interactions@0.23.7
  - @plitzi/sdk-navigation@0.23.7
  - @plitzi/sdk-plugins@0.23.7
  - @plitzi/sdk-schema@0.23.7
  - @plitzi/sdk-style@0.23.7
  - @plitzi/sdk-variables@0.23.7

## 0.23.6

### Patch Changes

- v0.23.6
- Updated dependencies
  - @plitzi/sdk-auth@0.23.6
  - @plitzi/sdk-dev-tools@0.23.6
  - @plitzi/sdk-elements@0.23.6
  - @plitzi/sdk-event-bridge@0.23.6
  - @plitzi/sdk-interactions@0.23.6
  - @plitzi/sdk-navigation@0.23.6
  - @plitzi/sdk-plugins@0.23.6
  - @plitzi/sdk-schema@0.23.6
  - @plitzi/sdk-shared@0.23.6
  - @plitzi/sdk-style@0.23.6
  - @plitzi/sdk-variables@0.23.6

## 0.23.5

### Patch Changes

- v0.23.5
- Updated dependencies
  - @plitzi/sdk-auth@0.23.5
  - @plitzi/sdk-dev-tools@0.23.5
  - @plitzi/sdk-elements@0.23.5
  - @plitzi/sdk-event-bridge@0.23.5
  - @plitzi/sdk-interactions@0.23.5
  - @plitzi/sdk-navigation@0.23.5
  - @plitzi/sdk-plugins@0.23.5
  - @plitzi/sdk-schema@0.23.5
  - @plitzi/sdk-shared@0.23.5
  - @plitzi/sdk-style@0.23.5
  - @plitzi/sdk-variables@0.23.5

## 0.23.4

### Patch Changes

- v0.23.4
- Updated dependencies
  - @plitzi/sdk-auth@0.23.4
  - @plitzi/sdk-dev-tools@0.23.4
  - @plitzi/sdk-elements@0.23.4
  - @plitzi/sdk-event-bridge@0.23.4
  - @plitzi/sdk-interactions@0.23.4
  - @plitzi/sdk-navigation@0.23.4
  - @plitzi/sdk-plugins@0.23.4
  - @plitzi/sdk-schema@0.23.4
  - @plitzi/sdk-shared@0.23.4
  - @plitzi/sdk-style@0.23.4
  - @plitzi/sdk-variables@0.23.4

## 0.23.3

### Patch Changes

- v0.23.3
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.23.3
  - @plitzi/sdk-interactions@0.23.3
  - @plitzi/sdk-navigation@0.23.3
  - @plitzi/sdk-dev-tools@0.23.3
  - @plitzi/sdk-elements@0.23.3
  - @plitzi/sdk-plugins@0.23.3
  - @plitzi/sdk-shared@0.23.3
  - @plitzi/sdk-auth@0.23.3

## 0.23.2

### Patch Changes

- v0.23.2
- Updated dependencies
  - @plitzi/sdk-auth@0.23.2
  - @plitzi/sdk-dev-tools@0.23.2
  - @plitzi/sdk-elements@0.23.2
  - @plitzi/sdk-event-bridge@0.23.2
  - @plitzi/sdk-interactions@0.23.2
  - @plitzi/sdk-navigation@0.23.2
  - @plitzi/sdk-plugins@0.23.2
  - @plitzi/sdk-shared@0.23.2

## 0.23.1

### Patch Changes

- v0.23.1
- Updated dependencies
  - @plitzi/sdk-auth@0.23.1
  - @plitzi/sdk-dev-tools@0.23.1
  - @plitzi/sdk-elements@0.23.1
  - @plitzi/sdk-event-bridge@0.23.1
  - @plitzi/sdk-interactions@0.23.1
  - @plitzi/sdk-navigation@0.23.1
  - @plitzi/sdk-plugins@0.23.1
  - @plitzi/sdk-shared@0.23.1

## 0.23.0

### Minor Changes

- v0.23.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.23.0
  - @plitzi/sdk-dev-tools@0.23.0
  - @plitzi/sdk-elements@0.23.0
  - @plitzi/sdk-event-bridge@0.23.0
  - @plitzi/sdk-interactions@0.23.0
  - @plitzi/sdk-navigation@0.23.0
  - @plitzi/sdk-plugins@0.23.0
  - @plitzi/sdk-shared@0.23.0

## 0.22.20

### Patch Changes

- v0.22.20
- Updated dependencies
  - @plitzi/sdk-auth@0.22.20
  - @plitzi/sdk-dev-tools@0.22.20
  - @plitzi/sdk-elements@0.22.20
  - @plitzi/sdk-event-bridge@0.22.20
  - @plitzi/sdk-interactions@0.22.20
  - @plitzi/sdk-navigation@0.22.20
  - @plitzi/sdk-plugins@0.22.20
  - @plitzi/sdk-shared@0.22.20

## 0.22.19

### Patch Changes

- v0.22.19
- Updated dependencies
  - @plitzi/sdk-auth@0.22.19
  - @plitzi/sdk-dev-tools@0.22.19
  - @plitzi/sdk-elements@0.22.19
  - @plitzi/sdk-event-bridge@0.22.19
  - @plitzi/sdk-interactions@0.22.19
  - @plitzi/sdk-navigation@0.22.19
  - @plitzi/sdk-plugins@0.22.19
  - @plitzi/sdk-shared@0.22.19

## 0.22.18

### Patch Changes

- v0.22.18
- Updated dependencies
  - @plitzi/sdk-auth@0.22.18
  - @plitzi/sdk-dev-tools@0.22.18
  - @plitzi/sdk-elements@0.22.18
  - @plitzi/sdk-event-bridge@0.22.18
  - @plitzi/sdk-interactions@0.22.18
  - @plitzi/sdk-navigation@0.22.18
  - @plitzi/sdk-plugins@0.22.18
  - @plitzi/sdk-shared@0.22.18

## 0.22.17

### Patch Changes

- v0.22.17
- Updated dependencies
  - @plitzi/sdk-elements@0.22.17
  - @plitzi/sdk-shared@0.22.17
  - @plitzi/sdk-auth@0.22.17
  - @plitzi/sdk-dev-tools@0.22.17
  - @plitzi/sdk-event-bridge@0.22.17
  - @plitzi/sdk-interactions@0.22.17
  - @plitzi/sdk-navigation@0.22.17
  - @plitzi/sdk-plugins@0.22.17

## 0.22.16

### Patch Changes

- v0.22.16
- Updated dependencies
  - @plitzi/sdk-auth@0.22.16
  - @plitzi/sdk-dev-tools@0.22.16
  - @plitzi/sdk-elements@0.22.16
  - @plitzi/sdk-event-bridge@0.22.16
  - @plitzi/sdk-interactions@0.22.16
  - @plitzi/sdk-navigation@0.22.16
  - @plitzi/sdk-plugins@0.22.16
  - @plitzi/sdk-shared@0.22.16

## 0.22.15

### Patch Changes

- v0.22.15
- Updated dependencies
  - @plitzi/sdk-auth@0.22.15
  - @plitzi/sdk-dev-tools@0.22.15
  - @plitzi/sdk-elements@0.22.15
  - @plitzi/sdk-event-bridge@0.22.15
  - @plitzi/sdk-interactions@0.22.15
  - @plitzi/sdk-navigation@0.22.15
  - @plitzi/sdk-plugins@0.22.15
  - @plitzi/sdk-shared@0.22.15

## 0.22.14

### Patch Changes

- v0.22.14
- Updated dependencies
  - @plitzi/sdk-auth@0.22.14
  - @plitzi/sdk-dev-tools@0.22.14
  - @plitzi/sdk-elements@0.22.14
  - @plitzi/sdk-event-bridge@0.22.14
  - @plitzi/sdk-interactions@0.22.14
  - @plitzi/sdk-navigation@0.22.14
  - @plitzi/sdk-plugins@0.22.14
  - @plitzi/sdk-shared@0.22.14

## 0.22.13

### Patch Changes

- v0.22.13
- Updated dependencies
  - @plitzi/sdk-auth@0.22.13
  - @plitzi/sdk-dev-tools@0.22.13
  - @plitzi/sdk-elements@0.22.13
  - @plitzi/sdk-event-bridge@0.22.13
  - @plitzi/sdk-interactions@0.22.13
  - @plitzi/sdk-navigation@0.22.13
  - @plitzi/sdk-plugins@0.22.13
  - @plitzi/sdk-shared@0.22.13

## 0.22.12

### Patch Changes

- v0.22.12
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.22.12
  - @plitzi/sdk-interactions@0.22.12
  - @plitzi/sdk-navigation@0.22.12
  - @plitzi/sdk-dev-tools@0.22.12
  - @plitzi/sdk-elements@0.22.12
  - @plitzi/sdk-plugins@0.22.12
  - @plitzi/sdk-shared@0.22.12
  - @plitzi/sdk-auth@0.22.12

## 0.22.11

### Patch Changes

- v0.22.11
- Updated dependencies
  - @plitzi/sdk-dev-tools@0.22.11
  - @plitzi/sdk-auth@0.22.11
  - @plitzi/sdk-elements@0.22.11
  - @plitzi/sdk-event-bridge@0.22.11
  - @plitzi/sdk-interactions@0.22.11
  - @plitzi/sdk-navigation@0.22.11
  - @plitzi/sdk-plugins@0.22.11
  - @plitzi/sdk-shared@0.22.11

## 0.22.10

### Patch Changes

- v0.22.10
- Updated dependencies
  - @plitzi/sdk-dev-tools@0.22.10
  - @plitzi/sdk-shared@0.22.10
  - @plitzi/sdk-auth@0.22.10
  - @plitzi/sdk-elements@0.22.10
  - @plitzi/sdk-event-bridge@0.22.10
  - @plitzi/sdk-interactions@0.22.10
  - @plitzi/sdk-navigation@0.22.10
  - @plitzi/sdk-plugins@0.22.10

## 0.22.9

### Patch Changes

- v0.22.9
- Updated dependencies
  - @plitzi/sdk-navigation@0.22.9
  - @plitzi/sdk-shared@0.22.9
  - @plitzi/sdk-auth@0.22.9
  - @plitzi/sdk-elements@0.22.9
  - @plitzi/sdk-event-bridge@0.22.9
  - @plitzi/sdk-interactions@0.22.9
  - @plitzi/sdk-plugins@0.22.9

## 0.22.8

### Patch Changes

- v0.22.8
- Updated dependencies
  - @plitzi/sdk-navigation@0.22.8
  - @plitzi/sdk-shared@0.22.8
  - @plitzi/sdk-auth@0.22.8
  - @plitzi/sdk-elements@0.22.8
  - @plitzi/sdk-event-bridge@0.22.8
  - @plitzi/sdk-interactions@0.22.8
  - @plitzi/sdk-plugins@0.22.8

## 0.22.7

### Patch Changes

- v0.22.7
- Updated dependencies
  - @plitzi/sdk-auth@0.22.7
  - @plitzi/sdk-elements@0.22.7
  - @plitzi/sdk-event-bridge@0.22.7
  - @plitzi/sdk-interactions@0.22.7
  - @plitzi/sdk-navigation@0.22.7
  - @plitzi/sdk-plugins@0.22.7
  - @plitzi/sdk-shared@0.22.7

## 0.22.6

### Patch Changes

- v0.22.6
- Updated dependencies
  - @plitzi/sdk-navigation@0.22.6
  - @plitzi/sdk-auth@0.22.6
  - @plitzi/sdk-elements@0.22.6
  - @plitzi/sdk-event-bridge@0.22.6
  - @plitzi/sdk-interactions@0.22.6
  - @plitzi/sdk-plugins@0.22.6
  - @plitzi/sdk-shared@0.22.6

## 0.22.5

### Patch Changes

- v0.22.5
- Updated dependencies
  - @plitzi/sdk-auth@0.22.5
  - @plitzi/sdk-elements@0.22.5
  - @plitzi/sdk-event-bridge@0.22.5
  - @plitzi/sdk-interactions@0.22.5
  - @plitzi/sdk-navigation@0.22.5
  - @plitzi/sdk-plugins@0.22.5
  - @plitzi/sdk-shared@0.22.5

## 0.22.4

### Patch Changes

- v0.22.4
- Updated dependencies
  - @plitzi/sdk-auth@0.22.4
  - @plitzi/sdk-elements@0.22.4
  - @plitzi/sdk-event-bridge@0.22.4
  - @plitzi/sdk-interactions@0.22.4
  - @plitzi/sdk-navigation@0.22.4
  - @plitzi/sdk-plugins@0.22.4
  - @plitzi/sdk-shared@0.22.4

## 0.22.3

### Patch Changes

- v0.22.3
- Updated dependencies
  - @plitzi/sdk-auth@0.22.3
  - @plitzi/sdk-event-bridge@0.22.3
  - @plitzi/sdk-interactions@0.22.3
  - @plitzi/sdk-navigation@0.22.3
  - @plitzi/sdk-plugins@0.22.3
  - @plitzi/sdk-shared@0.22.3

## 0.22.2

### Patch Changes

- v0.22.2
- Updated dependencies
  - @plitzi/sdk-navigation@0.22.2
  - @plitzi/sdk-shared@0.22.2
  - @plitzi/sdk-auth@0.22.2
  - @plitzi/sdk-event-bridge@0.22.2
  - @plitzi/sdk-interactions@0.22.2
  - @plitzi/sdk-plugins@0.22.2

## 0.22.1

### Patch Changes

- v0.22.1
- Updated dependencies
  - @plitzi/sdk-shared@0.22.1
  - @plitzi/sdk-auth@0.22.1
  - @plitzi/sdk-event-bridge@0.22.1
  - @plitzi/sdk-interactions@0.22.1
  - @plitzi/sdk-navigation@0.22.1
  - @plitzi/sdk-plugins@0.22.1

## 0.22.0

### Patch Changes

- v0.22.0
- Updated dependencies
  - @plitzi/sdk-auth@0.22.0
  - @plitzi/sdk-event-bridge@0.22.0
  - @plitzi/sdk-interactions@0.22.0
  - @plitzi/sdk-navigation@0.22.0
  - @plitzi/sdk-plugins@0.22.0
  - @plitzi/sdk-shared@0.22.0

## 0.22.0

### Minor Changes

- v0.22.0-rc1

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-event-bridge@0.22.0
  - @plitzi/sdk-interactions@0.22.0
  - @plitzi/sdk-shared@0.22.0
  - @plitzi/sdk-auth@0.22.0
  - @plitzi/sdk-navigation@0.22.0
  - @plitzi/sdk-plugins@0.22.0

## 0.21.1

### Patch Changes

- v0.21.1
- Updated dependencies
  - @plitzi/sdk-shared@0.21.1
  - @plitzi/sdk-auth@0.21.1
  - @plitzi/sdk-event-bridge@0.21.1
  - @plitzi/sdk-interactions@0.21.1
  - @plitzi/sdk-navigation@0.21.1
  - @plitzi/sdk-plugins@0.21.1

## 0.21.0

### Minor Changes

- v0.21.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.21.0
  - @plitzi/sdk-event-bridge@0.21.0
  - @plitzi/sdk-interactions@0.21.0
  - @plitzi/sdk-navigation@0.21.0
  - @plitzi/sdk-plugins@0.21.0
  - @plitzi/sdk-shared@0.21.0

## 0.20.24

### Patch Changes

- v0.20.24
- Updated dependencies
  - @plitzi/sdk-shared@0.20.24
  - @plitzi/sdk-auth@0.20.24
  - @plitzi/sdk-event-bridge@0.20.24
  - @plitzi/sdk-interactions@0.20.24
  - @plitzi/sdk-navigation@0.20.24
  - @plitzi/sdk-plugins@0.20.24

## 0.20.23

### Patch Changes

- v0.20.23
- Updated dependencies
  - @plitzi/sdk-shared@0.20.23
  - @plitzi/sdk-auth@0.20.23
  - @plitzi/sdk-event-bridge@0.20.23
  - @plitzi/sdk-interactions@0.20.23
  - @plitzi/sdk-navigation@0.20.23
  - @plitzi/sdk-plugins@0.20.23

## 0.20.22

### Patch Changes

- v0.20.22
- Updated dependencies
  - @plitzi/sdk-auth@0.20.22
  - @plitzi/sdk-event-bridge@0.20.22
  - @plitzi/sdk-interactions@0.20.22
  - @plitzi/sdk-navigation@0.20.22
  - @plitzi/sdk-plugins@0.20.22
  - @plitzi/sdk-shared@0.20.22

## 0.20.21

### Patch Changes

- v0.20.21
- Updated dependencies
  - @plitzi/sdk-auth@0.20.21
  - @plitzi/sdk-event-bridge@0.20.21
  - @plitzi/sdk-interactions@0.20.21
  - @plitzi/sdk-navigation@0.20.21
  - @plitzi/sdk-plugins@0.20.21
  - @plitzi/sdk-shared@0.20.21

## 0.20.20

### Patch Changes

- v0.20.20
- Updated dependencies
  - @plitzi/sdk-auth@0.20.20
  - @plitzi/sdk-event-bridge@0.20.20
  - @plitzi/sdk-interactions@0.20.20
  - @plitzi/sdk-navigation@0.20.20
  - @plitzi/sdk-plugins@0.20.20
  - @plitzi/sdk-shared@0.20.20

## 0.20.19

### Patch Changes

- v0.20.19
- Updated dependencies
  - @plitzi/sdk-auth@0.20.19
  - @plitzi/sdk-event-bridge@0.20.19
  - @plitzi/sdk-interactions@0.20.19
  - @plitzi/sdk-navigation@0.20.19
  - @plitzi/sdk-plugins@0.20.19
  - @plitzi/sdk-shared@0.20.19

## 0.20.18

### Patch Changes

- v0.20.18
- Updated dependencies
  - @plitzi/sdk-auth@0.20.18
  - @plitzi/sdk-event-bridge@0.20.18
  - @plitzi/sdk-interactions@0.20.18
  - @plitzi/sdk-navigation@0.20.18
  - @plitzi/sdk-plugins@0.20.18
  - @plitzi/sdk-shared@0.20.18

## 0.20.17

### Patch Changes

- v0.20.17
- Updated dependencies
  - @plitzi/sdk-navigation@0.20.17
  - @plitzi/sdk-shared@0.20.17
  - @plitzi/sdk-auth@0.20.17
  - @plitzi/sdk-event-bridge@0.20.17
  - @plitzi/sdk-interactions@0.20.17
  - @plitzi/sdk-plugins@0.20.17

## 0.20.16

### Patch Changes

- v0.20.16
- Updated dependencies
  - @plitzi/sdk-auth@0.20.16
  - @plitzi/sdk-event-bridge@0.20.16
  - @plitzi/sdk-interactions@0.20.16
  - @plitzi/sdk-navigation@0.20.16
  - @plitzi/sdk-plugins@0.20.16
  - @plitzi/sdk-shared@0.20.16

## 0.20.15

### Patch Changes

- v0.20.15
- Updated dependencies
  - @plitzi/sdk-auth@0.20.15
  - @plitzi/sdk-event-bridge@0.20.15
  - @plitzi/sdk-interactions@0.20.15
  - @plitzi/sdk-navigation@0.20.15
  - @plitzi/sdk-plugins@0.20.15
  - @plitzi/sdk-shared@0.20.15

## 0.20.14

### Patch Changes

- v0.20.14
- Updated dependencies
  - @plitzi/sdk-navigation@0.20.14
  - @plitzi/sdk-auth@0.20.14
  - @plitzi/sdk-event-bridge@0.20.14
  - @plitzi/sdk-interactions@0.20.14
  - @plitzi/sdk-plugins@0.20.14
  - @plitzi/sdk-shared@0.20.14

## 0.20.13

### Patch Changes

- v0.20.13
- Updated dependencies
  - @plitzi/sdk-auth@0.20.13
  - @plitzi/sdk-event-bridge@0.20.13
  - @plitzi/sdk-interactions@0.20.13
  - @plitzi/sdk-navigation@0.20.13
  - @plitzi/sdk-plugins@0.20.13
  - @plitzi/sdk-shared@0.20.13

## 0.20.12

### Patch Changes

- v0.20.12
- Updated dependencies
  - @plitzi/sdk-auth@0.20.12
  - @plitzi/sdk-event-bridge@0.20.12
  - @plitzi/sdk-interactions@0.20.12
  - @plitzi/sdk-navigation@0.20.12
  - @plitzi/sdk-plugins@0.20.12
  - @plitzi/sdk-shared@0.20.12

## 0.20.11

### Patch Changes

- v0.20.11
- Updated dependencies
  - @plitzi/sdk-auth@0.20.11
  - @plitzi/sdk-event-bridge@0.20.11
  - @plitzi/sdk-interactions@0.20.11
  - @plitzi/sdk-navigation@0.20.11
  - @plitzi/sdk-plugins@0.20.11
  - @plitzi/sdk-shared@0.20.11

## 0.20.10

### Patch Changes

- v0.20.10
- Updated dependencies
  - @plitzi/sdk-auth@0.20.10
  - @plitzi/sdk-event-bridge@0.20.10
  - @plitzi/sdk-interactions@0.20.10
  - @plitzi/sdk-navigation@0.20.10
  - @plitzi/sdk-plugins@0.20.10
  - @plitzi/sdk-shared@0.20.10

## 0.20.9

### Patch Changes

- v0.20.9
- Updated dependencies
  - @plitzi/sdk-auth@0.20.9
  - @plitzi/sdk-event-bridge@0.20.9
  - @plitzi/sdk-interactions@0.20.9
  - @plitzi/sdk-plugins@0.20.9
  - @plitzi/sdk-shared@0.20.9

## 0.20.8

### Patch Changes

- v0.20.8
- Updated dependencies
  - @plitzi/sdk-auth@0.20.8
  - @plitzi/sdk-event-bridge@0.20.8
  - @plitzi/sdk-interactions@0.20.8
  - @plitzi/sdk-plugins@0.20.8
  - @plitzi/sdk-shared@0.20.8

## 0.20.7

### Patch Changes

- v0.20.7
- Updated dependencies
  - @plitzi/sdk-shared@0.20.7
  - @plitzi/sdk-event-bridge@0.20.7
  - @plitzi/sdk-interactions@0.20.7
  - @plitzi/sdk-plugins@0.20.7

## 0.20.6

### Patch Changes

- v0.20.6
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.20.6
  - @plitzi/sdk-interactions@0.20.6
  - @plitzi/sdk-plugins@0.20.6
  - @plitzi/sdk-shared@0.20.6

## 0.20.5

### Patch Changes

- v0.20.5
- Updated dependencies
  - @plitzi/sdk-interactions@0.20.5
  - @plitzi/sdk-shared@0.20.5
  - @plitzi/sdk-event-bridge@0.20.5
  - @plitzi/sdk-plugins@0.20.5

## 0.20.4

### Patch Changes

- v0.20.4
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.20.4
  - @plitzi/sdk-interactions@0.20.4
  - @plitzi/sdk-shared@0.20.4

## 0.20.3

### Patch Changes

- v0.20.3
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.20.3
  - @plitzi/sdk-interactions@0.20.3
  - @plitzi/sdk-shared@0.20.3

## 0.20.2

### Patch Changes

- v0.20.2
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.20.2
  - @plitzi/sdk-interactions@0.20.2
  - @plitzi/sdk-shared@0.20.2

## 0.20.1

### Patch Changes

- v0.20.1
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.20.1
  - @plitzi/sdk-interactions@0.20.1
  - @plitzi/sdk-shared@0.20.1

## 0.20.0

### Minor Changes

- v0.20.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.20.0
  - @plitzi/sdk-event-bridge@0.20.0
  - @plitzi/sdk-interactions@0.20.0

## 0.19.3

### Patch Changes

- v0.19.3
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.19.3
  - @plitzi/sdk-interactions@0.19.3
  - @plitzi/sdk-shared@0.19.3

## 0.19.2

### Patch Changes

- v0.19.2
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.19.2
  - @plitzi/sdk-interactions@0.19.2
  - @plitzi/sdk-shared@0.19.2

## 0.19.1

### Patch Changes

- v0.19.1

## 0.19.0

### Minor Changes

- v0.19.0

## 0.18.5

### Patch Changes

- v0.18.5

## 0.18.4

### Patch Changes

- 5ec8b31: v0.18.4
