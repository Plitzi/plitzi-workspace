# @plitzi/sdk-authoring

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
