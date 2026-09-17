# @plitzi/cli

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
  - @plitzi/sdk-authoring@0.36.0

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
  - @plitzi/sdk-authoring@0.35.10

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
  - @plitzi/sdk-authoring@0.35.9

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
  - @plitzi/sdk-authoring@0.35.8

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
  - @plitzi/sdk-authoring@0.35.7

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
  - @plitzi/sdk-authoring@0.35.6

## 0.35.5

### Patch Changes

- v0.35.5
- Updated dependencies
  - @plitzi/sdk-authoring@0.35.5

## 0.35.4

### Patch Changes

- v0.35.4
- Updated dependencies
  - @plitzi/sdk-authoring@0.35.4

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
  - @plitzi/sdk-authoring@0.35.3

## 0.35.2

### Patch Changes

- v0.35.2
- Updated dependencies [470aaf8]
- Updated dependencies
- Updated dependencies [470aaf8]
  - @plitzi/sdk-authoring@0.35.2

## 0.35.1

### Patch Changes

- v0.35.1
- Updated dependencies
  - @plitzi/sdk-authoring@0.35.1

## 0.35.0

### Minor Changes

- v0.35.0

### Patch Changes

- @plitzi/sdk-authoring@0.35.0

## 0.34.1

### Patch Changes

- cba7b8b: `plitzi create` installs on release day under npm, pnpm and Yarn, says why when it cannot, and tests every page.

  Every case below was reproduced by scaffolding a project and installing it, not inferred.

  - **npm: the generated project installs.** It pinned `eslint@^9` beside `@eslint/js@^10`, whose peer is `eslint@^10`,
    so npm stopped on `ERESOLVE` before writing `node_modules`. `eslint` is now `^10`, and a test holds the two majors
    together.
  - **npm: no unreviewed install scripts.** npm 11 lists them on every install and has announced it will block them.
    `package.json` now carries `allowScripts` (esbuild approved, fsevents — a prebuilt binary — refused).
  - **pnpm: the install no longer fails.** pnpm stopped with `ERR_PNPM_IGNORED_BUILDS` over esbuild. The project now
    gets a `pnpm-workspace.yaml` with `allowBuilds: { esbuild: true }` and `@plitzi/*` excluded from
    `minimumReleaseAge`.
  - **Yarn: `@plitzi/*` is not quarantined.** Yarn refuses packages younger than a day (YN0016), which on release
    day is every one of ours. `.yarnrc.yml` now preapproves `@plitzi/*`, and nothing else — and only when the
    installed Yarn is 4.10 or later, because Yarn 4.9 refuses the whole file over a setting it does not know.
  - **A failed install is a failed command.** The summary used to print after the manager's errors and read as
    success. It is now preceded by a red line naming the command, a hint for that manager's usual refusal, and exit
    code 1.
  - **The visual test covers every page a visit can open.** It checked only `/`. It now runs one test per page,
    skipping pages behind a session or with route params, and elements shown only under a condition.

- v0.34.1
- Updated dependencies [cba7b8b]
- Updated dependencies
  - @plitzi/sdk-authoring@0.35.0

## 0.34.0

### Minor Changes

- v0.34.0
- 5aceda0: A command line, with one command that matters: `plitzi init`.

  It scaffolds a server that renders a space living in Plitzi — `package.json`, `tsconfig.json`, `src/main.ts`,
  `.env`, `.gitignore` and a README — so the first run is `npm install && npm start`. Everything it writes was
  already documented, which was the problem: a person had to read four things and write three files correctly
  before they could tell whether any of it worked.

  It never mints a credential. The self-hosting key comes from Credentials in the builder, is written to `.env`,
  and `.gitignore` is written in the same breath.

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

- Updated dependencies [2c89e00]
- Updated dependencies [5aceda0]
- Updated dependencies
- Updated dependencies [9c3292c]
  - @plitzi/sdk-authoring@0.34.0
