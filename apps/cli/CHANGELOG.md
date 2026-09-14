# @plitzi/cli

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
