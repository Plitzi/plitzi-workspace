# @plitzi/sdk-dev-tools

## 0.38.3

### Patch Changes

- e047e1d: ## `plitzi upgrade`: a project brought up to its CLI

  A project written by an older CLI had no way up but `plitzi create` in a scratch folder and a file-by-file comparison:
  `skills update` brought the skills and nothing else, so the `check` and `shot` scripts they teach did not exist.
  `plitzi upgrade` (also `update`) shows what this CLI writes today for what is the CLI's in the project, and `--write`
  makes it. One part or several: `plitzi upgrade skills`, `plitzi upgrade files packages`.

  - **`files`:** the CLI's machinery — `author.ts`, `main.ts`, the Playwright, TypeScript and lint configs, AGENTS.md. One
    nobody changed since the CLI wrote it is replaced, a missing one added; one the project made its own is shown as a
    diff and left, until `--take <file>` (or `all`). `plitzi create` now records what it wrote, by digest, in
    `.plitzi/scaffold.json`; a project made before that sees every file that differs as its own.
  - **`packages`:** `package.json` merged, never replaced — the scripts and dependencies it lacks added, `@plitzi/*`
    raised to this version, then the install (`--no-install` to leave it). A script of the project's own stays.
  - **`skills`:** `.claude/skills/plitzi-*` from the packages installed, each replaced whole, and the ones a newer CLI
    writes added. `plitzi skills update` is `plitzi upgrade skills --write`.
  - **`renames`:** a name a version renamed with no alias, at its file and line — `canTemplate` → `canSnippet`,
    `authorTemplate` → `authorSnippet` and its kin (renamed only where imported from `@plitzi/sdk-authoring`) — renamed
    with `--write`.

  `npm run author` says when the skills or the CLI's files are older than the SDK installed, and `plitzi --version`
  prints the CLI's.

  ## Page checks that can be the definition of done

  `inspectPage`, `plitzi check` and the scaffold's visual test failed pages that were whole, so an agent learnt to ignore
  them:

  - **A breakpoint hiding an element on purpose** — the desktop navigation on a phone, a bottom bar only a phone shows —
    is no longer "not visible": an element whose `display` or `visibility` a breakpoint rule sets is checked at the width
    it shows at.
  - **A lazy image out of sight** waits whichever side it is out of: below the fold, as before, or beside the screen in a
    carousel's track — cut off by any ancestor that clips, as the browser decides when to fetch it.
  - **A plugin that draws nothing** says so: `drawsNothing: true` in its declaration (a clock that fires a flow), and its
    handle is `boxless`, so no check waits for it on screen.

  `plitzi check --json` and `PageReport` carry `issues` beside `problems`: each with its `code` (`element-hidden`,
  `image-not-loaded`, `sideways-scroll`…), the `elementId` it is about and, in `check`, the `width`.

  ## Authoring
  - **A link's `content` names it.** `control-without-name` read only a link's `label`, so applying the
    `content-attribute` suggestion as written turned every link into a warning.
  - **`plitzi fix` writes `content-attribute`** where it has one reading: a button's or link's children that are only
    `text(…)` and `fontAwesome({ icon })` become its own `content` and `icon` — the words kept as written, an import left
    unused taken out. A child with an id, options or a class of the space's own stays, and is said. `npm run author`'s
    `[fix]` line counts these too.
  - **The recipes, the skill's examples and the catalog template** hold to the suggestions as well as the warnings, and
    their tests say so: six recipes and the template wrote a link's or a button's words as a child.

  ## Declared motion — in code, in the builder and over MCP

  An element says how it arrives and whether it keeps moving with `motion`, and the SDK's stylesheet plays it — no
  keyframes to write: `{ enter: 'fade-up', on: 'view' }` arrives as it scrolls into view, `{ enter: 'scale', stagger:
60 }` brings its children one by one (a grid, a list's rows), `{ loop: 'float' }` keeps it moving. Enters: `fade`,
  `fade-up`, `fade-down`, `slide-left`, `slide-right`, `scale`; loops: `float`, `pulse`, `spin`, `sway`; `duration`,
  `delay`, `stagger` in ms. Opacity and the transforms only — an arrival on `translate`/`scale`, so it composes with an
  element's own `transform` — a loop held until the page is live (`data-hydrated`), and none of it for a visitor who asked
  for less motion. `view` follows the scroll where the browser has scroll timelines and plays on load where not.

  - **Authoring:** `motion` on any factory; refused where it cannot play (`motion-invalid`, `motion-no-tag`), and carried
    by `specFromSpace` and `compareSpaces`.
  - **Builder:** a **Motion** tab in an element's tools: the presets as chips, a stage that plays the one pointed at (a
    loop shown stronger than the page plays it, and saying so), when and how long, children one by one, and the choices
    read back as a sentence — laid out side by side once the sidebar is wide enough. The canvas holds motion still while
    editing; **▶** in the header (or **Play on the canvas** in the tab) plays it from the start, restarting what already
    played, and an arrival tied to the scroll plays by the clock there, where it is usually in view already.
  - **MCP:** `motion` on `upsertElement` and `patchElement`, checked the same way; the guide names the presets.
  - **Schema:** `definition.motion` (`ElementMotion`, `@plitzi/sdk-shared/schema/motion` — the presets, `motionProblems`,
    `motionAttributes`, `isMotionAnimation`, and each preset's frames, which the stylesheet is tested against), in both
    init queries. **The platform's GraphQL schema has to declare `SpaceElementMotion`
    before this version's builder or SDK queries it.**

  ## Dev tools QA: x-ray and motion

  The **QA** tab gains an **X-ray**: every element the document wires something to — bound to data, shown on a condition,
  running a flow, moving, behind a flag — outlined in its colour and named on the page, read from the space's document by
  the element's name; its legend counts each kind on the page and picks one to show alone. Beside **Pause**, **Slow**
  plays every animation at a quarter of its speed and **Replay** plays the declared motion again from the start, without
  reloading the page.

  ## Plugins that draw

  `useCanvas2d`, `useWebGL`, `useWebGL2` and `useAnimationFrame` (`@plitzi/plitzi-sdk`): a canvas sized to the device (at
  most 2×), followed as it resizes, animating only while somebody can see it move — a live page, no reduced motion, the
  tab in front, the canvas on screen — and one still frame otherwise (the builder included). `createShaderProgram`
  compiles and links, and a shader that fails throws a `ShaderError` with the driver's log, printed as
  `[plugin <type> "<id>"] fragment shader failed: …` instead of an empty canvas; `error` and `ready` say where it is.
  `useReducedMotion` for the rest.

  ## A space re-authored without a restart

  A project's `npm run start:dev` restarts for its server code and its plugins only: a save to the space is re-authored
  in a process of its own and every open page loads again (`server.reloadPages()` over an SSE endpoint, on with
  `createServer({ devReload: true })` — never by `devMode` alone, since every open page holds a connection for it); an
  edit authoring refuses is printed and the page keeps the last space that authored. A shutdown also ends WebSockets at
  once (`1001`, going away) rather than waiting out the grace — the ten seconds a restart used to wait on an open page.

  ## Checks and authoring, from the stripe.com experiment
  - **A component's instance** is found by its own name: its root carries `data-plitzi-instance`, and the instance's
    handle selects it — `inspectPage` no longer reports every named instance as missing.
  - **Hidden at this width on purpose** — the burger on a desktop, the desktop menu on a phone — is listed apart
    (`hiddenAtWidth`, and a dim line under `plitzi check`'s ✓) rather than as a problem.
  - **An element whose every child is conditional** — four flyouts in one list, each opening on the state that names
    it — is conditional too: at rest it shows nothing, and that is it working.
  - **A carousel that scrolls by itself** (`overflow-x: auto`) is not the page scrolling sideways; the page's own pane
    still is.
  - **Templates:** `{{ state.faq ?? -1 }}` — a sign on the right of `??` — reads.
  - **A plugin attribute named as an element field** (`variant`, `class`, `id`…) is warned about
    (`plugin-attribute-reserved`): a factory never hands it to the plugin. A `variant` no class or type style declares is
    `unknown-variant`.
  - **Lists:** a list with `items` renders as the `<ul>` (or `<ol>`) its `subType` says — it was a `<div>` — with no
    markers and the same spacing, so a page looks as it did; the builder offers the list type for it too. Its rows are
    `<li>`s: `list-row-not-li` warns of one that is not — a plain container is made one by `fixSpace`, a link or a button
    is wrapped — and the recipes, the catalog template and the docs write rows as `listItem`.
  - **CSS:** `mask-size`, `mask-position`, `mask-repeat`, `mask-composite`, `-webkit-mask-image`,
    `-webkit-background-clip`, `box-decoration-break` and `-webkit-box-decoration-break`.
  - **`plitzi shot`:** `--clip <element>`, `--scroll-to <element>` and `--viewport`; `--frames` takes the same framing.
  - **SVG from files:** `svgFile` and `svgFiles` (`@plitzi/sdk-authoring/node`) read a logo or a folder of them,
    compacted (`compactSvg`, also on the main entry), instead of strings in the space's source.
  - The plugin scaffolds say that an inline `style` on `RootElement` outranks the element's classes.

- Updated dependencies [e047e1d]
  - @plitzi/sdk-navigation@0.38.3
  - @plitzi/sdk-schema@0.38.3
  - @plitzi/sdk-shared@0.38.3
  - @plitzi/sdk-style@0.38.3

## 0.38.2

### Patch Changes

- v0.38.2
- Updated dependencies
  - @plitzi/sdk-navigation@0.38.2
  - @plitzi/sdk-schema@0.38.2
  - @plitzi/sdk-shared@0.38.2
  - @plitzi/sdk-style@0.38.2

## 0.38.1

### Patch Changes

- 266e691: ## A shutdown that does not wait on idle connections

  A server shutting down while it answered a request waited, once the answer was sent, for the client to let go of the
  keep-alive connection it came on — three seconds for Node's own `fetch`, longer for others — before it could stop. The
  connection is now closed as soon as its answer is finished.

- Updated dependencies [266e691]
  - @plitzi/sdk-navigation@0.38.1
  - @plitzi/sdk-schema@0.38.1
  - @plitzi/sdk-shared@0.38.1
  - @plitzi/sdk-style@0.38.1

## 0.38.0

### Minor Changes

- v0.38.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-navigation@0.38.0
  - @plitzi/sdk-schema@0.38.0
  - @plitzi/sdk-shared@0.38.0
  - @plitzi/sdk-style@0.38.0

## 0.37.10

### Patch Changes

- 8d1cc02: ## The builder's sidebar, one entry per subject

  From 21 entries to 9. **Elements** ends with the space's **Components**, one search for both — each is dragged
  onto the canvas the same way. **Server** gathers Actions, Functions, Connectors, Credentials and Runtime behind tabs, with
  the warning that a space has no server-rendered deployment said once above them. **Variables** holds Feature Flags,
  **Assets** holds files and fonts, **Settings** holds Visitors, the Pages panel opens the **Sitemap** in place of the
  canvas, and **History** moved to the header beside undo and redo. Each grouped entry remembers the tab left open.

  The builder is drawn with the website's design system: Geist and Geist Mono, the `#5b3df5` violet, cool neutrals and
  8 / 10 / 14px radii, from the tokens `@plitzi/plitzi-ui/theme.css` now ships. The published SDK stylesheet does not
  take them, so a space's own elements look as they did.

  The Sitemap is drawn by `TreeCanvas`, a new `@plitzi/plitzi-ui` component: the site laid out as a tree on its own, panned
  and zoomed like a design canvas, a page moved by dropping it onto a folder or onto the top level. `@xyflow/react` — and
  zustand and d3 with it — is no longer a dependency of the builder.
  From the map a page is found (search lights it and the folders leading to it), opened in the canvas (double click,
  Enter or its card), and created inside a folder; folders fold away what they hold, remembered between visits; arrows walk
  it. Each card says who may open the page, its layout, the flag it exists under, where it sends somebody it refuses, and
  marks its dynamic segments and the page being edited. Fixed on the way: a page with no access level was labelled
  "Public", which in Plitzi means guests only — it is open to everyone, and now says so.

  ## Feature flags
  - **What they are:** `schema.flags`, a space's switches by name — a default and rules over the environment, the host,
    the URL and the visitor. Read with the document, stored apart from its snapshots: one set per environment, turned
    without a new revision; a snapshot keeps a copy, read only when the environment's flags (and their Redis copy)
    cannot be. See `docs/en/feature-flags.md`.
  - **Caches follow them:** `SSRSpaceDeployment.flagsVersion` (the flags' hash) keys the HTML, RSC and `offlineData`
    caches of `@plitzi/sdk-server`; `createCloudAdapters` probes `flagsHash` and fetches `SpaceFlags` only when it moved
    — a pinned revision included — and keeps the last flags in its shared cache for a cold start with Plitzi down.
  - **Who decides:** the space, then the server rendering it (`createServer({ flags })`), then the SDK embedding it (the
    `flags` prop), then a tester (the dev tools' Flags tab, only where debugging is authorized) — each only for flags the
    space declares.
  - **Gating:** `definition.flag: { name, is }` renders an element only while the flag agrees — not a visibility: gated
    off, none of it is rendered, on the server or in the browser, and RSC resolves no data for it. A gated page is not
    found. Its declaration still ships with the space's document: a flag switches a feature off, it does not hide it.
  - **Reading:** the `flags` global source (`{{ flags.x }}`), `useFlag(name)` for plugins, and `flags` in a server
    action's scope (the `getFlags` action lookup).
  - **Builder:** Feature Flags beside the variables (declare, rule, force in the canvas, publish), the gate in an element's tools, a
    marker in the tree. Its own flags come from the platform (`PlatformFlags`) instead of a constant.
  - **Authoring and MCP:** `SpaceSpec.flags`, `flag: 'name' | '!name'` on elements and pages, linter codes
    `flag-undeclared`, `flag-unknown`, `flag-unused`, `flag-rule-empty`; MCP `upsertFlag`, `deleteFlag`, `flag` on
    element and page ops, `plitzi://flags/{env}`.
  - **Global sources** are one list now (`@plitzi/sdk-shared/dataSource/globalSources`), read by the runtime and the
    authoring validator alike.

  ## Element templates are Snippets

  What the builder saves from a subtree and drops into a page was called a template, the word a space's own starting
  point already goes by. It is a **snippet** now, everywhere, with no alias for the old names:

  - **Builder:** "Save as snippet" on an element, **Snippets** in the resources list. A snippet has an icon of its own
    (an object group) beside the component's cube, in the canvas overlay and the context menu alike, and each says on
    hover what sets it apart: a component stays linked, a snippet is a copy.
  - **CDN:** a snippet is uploaded to `snippets/` in the space's folder, with the resource type `snippet`. A file already
    in `templates/` is no longer listed as one: upload it again.
  - **Authoring:** `authorSnippet`, `validateSnippet`, `SnippetSpec` and `AuthoredSnippet`, which returns `{ snippet,
warnings }`. The validator codes are `SNIPPET_*`.
  - **Shared and schema:** the `Snippet` type (`@plitzi/sdk-shared/types/SnippetTypes`), `SpaceAddSnippet` and
    `SPACE_ADD_SNIPPET`, `SCHEMA_ADD_SNIPPET` and `STYLE_ADD_SNIPPET`, `schemaAddSnippet` / `styleAddSnippet` on the
    event bridge, and `FlatMap.flatAsSnippet`.
  - **Plugins:** the builder config key `canTemplate` is `canSnippet`.
  - **One document, whoever writes it:** a snippet's `schema` is only what travels — `flat` and `variables` — whether
    `authorSnippet` wrote it or the builder saved it. Until now an authored one carried a whole space (`pages: []`, its
    settings), which the builder's preview laid over the space being edited, and one the builder saved failed
    `validateSnippet` (`INVALID_PAGES`).
  - **The same snippet, dropped twice:** the second drop renamed its elements in the editor while the server was sent
    the names it arrived with, refused them as taken, and the drop was undone. The names are now fitted where the
    snippet is dropped (`fitSnippet`, `@plitzi/sdk-schema/helpers/fitSnippet`) and carried by the insert to the server
    and every collaborator; `SCHEMA_ADD_SNIPPET` inserts under them and refuses a name taken since, as the server does.
    `SpaceAddSnippet` checks what it is sent against the `SPACE_ADD_SNIPPET` event before applying it.
  - **A snippet never restyles the space it lands in:** a class it brings under a name the space uses for something
    else is renamed (`card` → `card-2`) on its rule, its elements and the rules naming it as an ancestor, and its CSS
    recompiled; one that says the same is shared. The space keeps its rules for element types and its tokens, and a
    snippet's tokens the space lacks are now added — the editor merged its rules only, and the server neither
    (`mergeSnippetStyle`, `@plitzi/sdk-shared/style/snippetStyle`; `SnippetStyle`; `STYLE_ADD_SNIPPET` carries `style`).
  - **A snippet is known by what it holds:** `isSnippet` (`@plitzi/sdk-shared/schema/snippet`). A JSON uploaded in
    **Assets** that is a snippet goes among the snippets — before, an authored one landed as a plain file — and an upload
    declared a snippet that is not one is refused. A file among the snippets the builder cannot read is shown as such,
    with a way to remove it, instead of breaking the panel.
  - **Saving says how it went:** "Save as snippet" announces the snippet once the upload answered, and says why when it
    did not — it used to report it created before knowing, and from the context menu said nothing at all.

  Space templates — what a new space starts as — keep their name.

  ## A link to a section of a page
  - **`anchor`** on any element is its `id` in the DOM — the element's own id only ever reached it as `data-id` — so
    `/page#plans` has somewhere to land. Written by `authorSpace` (`anchor: 'plans'`), the builder (the element's
    **Anchor** field), the MCP (`upsertElement` / `patchElement`) and read back by `specFromSpace`.
  - **`link` takes `hash`**: `link({ href: 'home', hash: 'plans' })` goes to `/#plans`; a flow's `navigate('home#plans')`
    resolves the page and keeps the fragment.
  - **The router scrolls to the fragment** after every client-side navigation and on arrival, and waits up to 3 s for a
    section that renders once its data arrives — a visitor who scrolls first is left where they are.
  - **Refused while authoring:** an anchor that is not lowercase letters, digits and `-` (`anchor-invalid`), one on an
    element with no tag (`anchor-no-tag`), inside a list row or a component (`anchor-repeated`), twice on one page with
    its layouts (`anchor-duplicate`), and a link to a section the page does not have (`anchor-missing`).

  ## Every problem in one run
  - **`authorSpace` reports everything it cannot write at once**, as a `SpaceRefusedError` whose `refusals` list each
    one — instead of stopping at the first. An element it cannot write is left out and its siblings carry on; a class
    worn with `css`, `states` or a `selector` of its own is reported and written with the class, so the linter still
    reads the rest of the space and its findings join the same report.
  - **Each problem says where:** the line of your own code that called the factory (`src/site/home.ts:417`) and the
    nearest named element with the steps from it (`"store-footer" › container[1]`) — not a path of indices.
  - **The project's `npm run author`** prints one line on success, the numbered problems (no stack from inside the
    package) on failure, and one JSON object with `--json`.

  ## A class, plus one thing

  `class: [cover, { opacity: '0.25' }]` puts rules of the element's own on top of the classes it wears — the commonest
  shape there is, which until now took a class of its own every time. The rules become the class `<id>--own`, declared
  after every shared class so it wins over them, editable in the builder like any class; they take states and
  breakpoints as `styles()` does, need the element's `id`, and read back from a document as the same inline object.

  ## Every few seconds, with no plugin

  `onInterval(ms)` is a trigger every element has: a flow that repeats every `ms` milliseconds — an autoplay, a clock, a
  refresh — while the element is mounted and the tab is in view, and never in the builder outside preview. Each flow
  names its own interval and counts its own ticks (`{{ <step>.count }}`); one below 250 ms is refused (`trigger-interval`).
  It is in the builder's flow editor beside `onKey`, and `@plitzi/sdk-shared/helpers/interval` holds the rule all of them
  read.

  ## Data in `public/`, in the page from the first byte
  - **`plitzi create --mode server`** writes `public/data/` and passes `publicDir` to `createServer`: `public/data/*.json`
    is served with no change to `src/main.ts`.
  - **A server provider reads a file of the server's own:** an `apiContainer` with `runtime: 'server'` and a `query`
    that is a plain path in `publicDir` (`/data/home.json`) is resolved by the page server from disk — no connector or
    action configured — so the page arrives with the section in it rather than fetching it after load. A URL, a path
    outside `publicDir` or a `query` with `{{tokens}}` is left to the browser as before.

  ## A project's server, findable
  - **`npm start` starts beside whatever holds 8080** while developing: the next free port (`freePort`, from
    `@plitzi/sdk-server`), printed and written to `.plitzi/dev-server.json`. With `PORT` set, that port or an error.
  - **`/health` answers with the space's name**, and `npm run shot` checks it before taking a picture — another server
    on the port is reported, instead of photographed. `playwright.config.ts` and `shot` read the port from `PORT`, else
    from `.plitzi/dev-server.json`.

  ## Every document type, from the package you author with

  `@plitzi/sdk-authoring` exports the types of what it writes — `Schema`, `Style`, `SpaceFont`, `Element` and the rest
  of the documents, plus `SchemaValidationError`, `SchemaValidationOptions` and `SchemaValidationResult` — so a project
  types its own helpers without reaching into `@plitzi/sdk-shared`.

  ## Breakpoint warnings that read `display: none`

  `tablet-rule-skips-mobile` no longer warns about a tablet rule the phone hides anyway: an element with
  `display: none` under `mobile` never shows the rule it skips. When it does warn, it points to `compact`, which reaches
  both.

  ## An inline container

  `container({ subType: 'span' })` renders a `<span>`: a dot before a title, a word dressed apart, a badge in a line of
  text — inline by default, and in the builder's container settings as "Span (inline)". A span holding a heading, a
  paragraph, a list, a form or prose is warned about (`span-holds-block`).

  ## Every problem has a code, and a page that cannot miss one
  - **Every refusal and warning carries a code** — `[class-and-css]`, `[id-taken]`, `[tablet-rule-skips-mobile]` — in
    the message and in `SpaceRefusedError.refusals[].code`. `AUTHORING_CODES` (exported) is the one table they are raised
    from: whether each is refused or warned, what was wrong and what to write instead. A check raised with a code that is
    not in it does not compile.
  - **The skill's `authoring-errors.md` is generated from that table**, as is the website's Authoring errors page
    (`authoringCodesTable`), so neither can miss a code; a test fails when the page and the table disagree.
  - `AuthoringError` is what a factory or `authorSpace` throws for one problem on its own, with its `code` and `reason`.

  ## The skills, packaged for a project
  - **A cheatsheet to start from** (`CHEATSHEET.md`): the factories, fields, steps and the problems met most, on one
    page. `SKILL.md` starts there, says what to read for each kind of task, and what never to read whole.
  - **Recipes by intent, as files** (`recipes/*.ts`): show data from a file, filter a list, a detail page, link to a
    section, something every few seconds (a carousel), a marquee, a link built from a row, forms and modals, a feature
    flag, a plugin, controls usable without sight, styling, and an embed or an SVG. CI authors each one: a recipe that
    stops authoring fails the build.
  - **Every link in a skill resolves inside a project**, and none names a file only the workspace has; a test walks them
    as `plitzi create` copies them. Realtime channels have a reference of their own.
  - **Each skill file has a budget** — about 4k tokens for a `SKILL.md`, 3k for a reference — held by a test.
  - **When to use the MCP and when the CLI**, in both skills: the MCP for a space that lives on Plitzi, the CLI for one
    that lives in code; a sign-in nobody can give never blocks the second.
  - New guidance: animations (keyframes, entering with `visible`, pausing on hover, staggering), a list's `index` as
    text, rows kept by position, a provider around a layout's slot, checking motion in a test.

  ## A project an agent finds its way around
  - **`AGENTS.md` says the port, where data goes, how to look at a page, and what not to read**: the generated
    `space/offline-data.json`, `.sdk-plugins/`, a large `public/data/*.json` and the bundles in `node_modules`.
  - **`plitzi data describe <file>`** prints a JSON file's shape — every field, its type, how many rows have it — and one
    row of its longest list; `--json` for a tool.
  - **Quiet by default:** the server prints only what goes wrong (`npm start -- --verbose` for every request), and
    `typecheck` one line per error.
  - **The welcome space follows the skill's rules:** a box one class owns whole is a shorthand; a test holds it to that.
  - `.claude` is left out of a project's lint and formatting.

  ## Problems over MCP come with their code and their fix

  An agent editing a space over MCP has no skill page to look a code up in: each problem a batch meets now leads with its
  `[code]` and its hint says what to write instead, from the same `AUTHORING_CODES` row `authorSpace` raises it from
  (`authoringCodeEntry(code)` looks one up).

  ## Scrolling, as steps
  - **`scrollBy`, `scrollTo` and `scrollIntoView`** are callbacks every element answers: `scrollBy('cards', { x: '80%' })`
    moves a box by most of what it shows, `scrollTo('cards', { x: 'end' })` to an end or a place, `scrollIntoView` brings
    an element into view. In the builder's flow editor, in authoring and over MCP.
  - **`onScroll`** fires as an element's box moves — at most once a frame, and once on mount — with
    `{ x, y, atStart, atEnd }`, so an arrow can hide at the end already reached (recipe: `recipes/scroll-a-row.ts`).

  ## A list names its rows by the field you choose

  `list({ itemKey: 'slug' })` keys each row by that field of its item, so a row's state follows its item when the list is
  filtered or reordered, and a row whose item changes mounts again — a one-row list showing the current slide replays its
  entrance. Left out, rows follow the items' `id` (when every item has its own), else their position. In the builder it
  is the list's "Row key"; `list-item-key-missing` warns when fixed items lack it or share one.

  ## A skeleton while a provider loads

  `apiContainer({ loadingSlot: 'catalog-skeleton' })` names one of its children to show in place of the others until the
  first answer arrives — the shape of what is coming — and to drop after it. In the builder every child shows, so the
  slot is edited beside what it stands for; `loading-slot-unknown` refuses a slot no child answers to.

  ## `plitzi create --template blank`

  A space written in the project can start empty: tokens for both themes, a layout whose `site-main` the pages render in,
  one page, `public/data/` and no example plugin — for a project that is about to be a specific site, where the welcome
  tour is the first thing that would be deleted. `emptySpaceSpec` / `emptySpaceSource` in `@plitzi/sdk-authoring`.

  ## `plitzi add plugin` writes the shape it is told

  `--prop interval:number=5000`, `--trigger onTick:count`, `--callback reset` and `--headless` write an element in its
  final shape — typed props with defaults, bindable and with a control each in its panel; a `use<Name>Events()` hook that
  fires its events with typed payloads; a function per action; and, headless, hidden on a page and a badge in the builder
  — instead of the counter example, which is what it writes without them. Flags that cannot make an element (a type that
  is not one, an event every element already fires, a name used twice) are refused with how to write them, and the files
  are written as the project's Prettier writes them.

  ## Skills that say their version, and `plitzi skills update`

  The skills `plitzi create` copies into a project carry the version of the package they came from (`version:` in
  `SKILL.md`). `npm run author` says when the authoring skill is older than the `@plitzi/sdk-authoring` installed, and
  `plitzi skills update` replaces each Plitzi skill with the installed package's — whole, leaving any other skill alone.
  The CLI skill's references for `create --from` / `pull` and for a space's functions are files of their own now, read
  when a task names them.

  ## `plitzi explain`

  What a name means when authoring, in a few lines: an element (its attributes and their values, what it fires and
  answers, its slots), a step (its params and the function that writes it), a trigger (what it hands its flow, what fires
  it), a problem's code (what was wrong, what to write instead) or a transformer. `--list steps` names every one of a
  kind, `--json` answers in one object, and over MCP it is the resource `plitzi://explain/{name}`. Read from the same
  catalogues the checks use (`explain`, `explainList`, `explanationText` in `@plitzi/sdk-authoring`).

  ## `plitzi check` and `plitzi shot`: a page in numbers before pictures
  - **`plitzi check / --width 1440,390`** says whether a page of the running project is whole, in text: every element the
    space owes it on screen (or why not), no broken image, no sideways scroll, no text in the colour behind it, no console
    error, no refused request — per width, `--json` for a tool. A space in code is checked against what each page owes;
    any other, against what every page does.
  - **`plitzi shot`** takes the picture, and `--compare <url>` puts the same page of another site beside it — the
    differences in red, and the share that differs in each landmark (`section#plans 14%`); `--frames 4 --every 500` says
    what moves; `--wait-for` and `--reduced-motion` set it up. The comparison runs in the browser
    (`comparePictures`, `pageRegions` in `@plitzi/sdk-authoring`), so nothing is installed for it.
  - Both use the project's own Playwright and refuse a port that answers as another project. A project `create` writes
    installs `@plitzi/cli` and runs them as `npm run check` / `npm run shot`, which replaces its `scripts/shot.ts`.

  ## The builder's problems panel says the fix

  Each problem in the builder's panel shows what to write instead, from the same `AUTHORING_CODES` row `authorSpace` and
  the MCP use — `SpaceIssue.fix` over GraphQL, its code set apart.

  ## Scroll snap, and anchors under a fixed header

  `scroll-snap-type`, `scroll-snap-align` and `scroll-snap-stop` — a row of cards that comes to rest on a card — and
  `scroll-padding-top` / `scroll-margin-top` — an anchor that lands below a fixed header rather than under it — are part
  of the style vocabulary, with a "Scroll snap" section in the style editor.

  ## CSS as a React style object, and a value per breakpoint in place
  - **camelCase keys and numbers:** `{ paddingTop: 8, fontWeight: 800, WebkitLineClamp: 2 }` is `padding-top: 8px`,
    `font-weight: 800`, `-webkit-line-clamp: 2` — a bare number on a length is pixels. The document keeps kebab-case; one
    property written under both spellings is refused (`css-property-twice`).
  - **One property per breakpoint:** `{ fontSize: { desktop: '24px', compact: '18px' }, fontWeight: 700 }` changes the
    size on tablet and phone without splitting the rule set; it mixes with the per-breakpoint form.

  ## A link's mode follows from its href

  `link({ href: '/games/nebula' })` is internal, `link({ href: 'https://…' })` (or `mailto:`, `tel:`) external, and
  `link({ href: 'about' })` a page — `mode` is written only to say otherwise. A link that opens another tab gets
  `rel="noopener noreferrer"`.

  ## `from` and `as`: an element shows its data in a line
  - **`from`** binds the attribute a type shows its data in — a text's or heading's `content`, an image's `src`, a link's
    `href`, a list's `items` — and leaves it empty until the data answers: `heading({ from: 'site.data.hero.title' })`.
    It writes the same binding `bind` does; `bind` keeps the other attributes.
  - **`as`** shows it through a template (`as: '{{ source }} left'`) or a format the space names once:
    `formats: { price: "{{ source|currency('USD', 'en', { trimZeros: true }) }}" }`, then `as: 'price'` anywhere.
  - **New template filters:** `currency('USD', locale?, { trimZeros })` and `percent(decimals?)`, in `en` unless told,
    so a server and a browser in different locales write the same text.
  - Refused: `from` on a type with no main attribute, the main attribute bound twice, a format nobody declared, `as`
    without `from`.

  ## A list in one line: `items` and `row`

  `list({ id: 'grid', items: 'catalog.data.products', row: 'product-card' })` is a controlled list fed by that source,
  placing the component once per item with the row bound to its `item` prop (or its only prop). `row` can also be a
  function handed the row's names — `row: r => text({ from: `${r.item}.title` })`, `r.inTemplate.item` for a template.
  `items` (an array, or a source's name) and `from` make a list controlled without saying so. Refused: a row and
  children at once, a function row on a list with no `id`, a row naming a component that cannot take it.

  ## `activeWhen`, and a list's index is a number
  - **`activeWhen(dot, '{{ list_dots.index == state.slide }}')`** wears a class's `active` variant while a condition
    holds (`idle` otherwise) — the general form of `activeOn`, without a hand-written ternary.
  - **`list_<id>.index` is a number** from 0, so a template counts with it (`index + 1`). `==` compares text and numbers
    alike, so templates that compared it as text read the same.

  ## `cycleState` and `stepState`

  `cycleState({ key: 'slide', length: 4 })` moves a number in state round a cycle — after the last the first, `by: -1`
  before the first the last — and `stepState({ key: 'shown', by: 40, max: 'apiContainer_site.data.total' })` adds and
  stops at its bounds. Both are the `setState` they stand for, with the arithmetic written once; a length or a bound is a
  number or a template expression for one.

  ## `scope()` for what a helper builds

  `scope('promos', ref => container({ id: 'panel', … }))` prefixes every `id` given inside it (`promos-panel`), so a
  helper that builds the same block twice writes two sets of names instead of being refused `id-taken`. `ref('slides')` is
  the full name, for a binding, a step's target or a template; scopes nest. `id-taken` now points at it.

  ## Typed tokens, and `unknown-variable`
  - **`tokens(variables)`** turns the space's variables into the values a rule writes — `t.surface === 'var(--surface)'`
    — so a token that does not exist is a type error where it is written.
  - **`unknown-variable`** warns of a bare `var(--x)` nothing declares (a space variable, a selector's variable, a custom
    property a rule sets, or `customCss`): the browser drops the property and the page shows what it inherits. A
    `var(--x, fallback)` is taken as meant.

  ## Typed sources: `source()` and `twig`

  `const site = source('site', home)` names a provider's source from a sample of its answer — the JSON file it reads,
  imported — so every path is completed by the editor and checked: `site.data.hero.titel` is a type error, and refused
  `source-field-unknown` where the types were not looking. A path is the full source name, so it goes in `from`, `items`,
  `bind` and `visible` as it is, and into a template through `` twig`{{ ${site.data.total} + 1 }}` ``. A list fed by a
  path hands its `row` the item typed (`row: g => text({ from: g.item.title })`). Nothing of the sample is written into
  the space; inside a `scope()` the id is the scoped one.

  ## `tw()`: Tailwind classes as Plitzi styles

  `styles('pill', tw('inline-flex items-center gap-2 px-5 rounded-full bg-slate-950/90 hover:scale-105 md:text-sm'))`
  writes the rules the classes mean when the space is authored — Tailwind v4's scales and palette, arbitrary values,
  `[property:value]`. Its breakpoints become Plitzi's ranges (`md:` tablet and desktop, `lg:` desktop, `max-md:`,
  `max-lg:`), its states the class's states, `group-hover/<class>:` an ancestor's. Composed properties (transform,
  filter, gradient, ring and shadow) are put together once. `createTw({ colors: tokens(variables) })` names the space's
  tokens. What has no exact equivalent (`sm:`, `dark:`, `space-x-*`, `animate-*`) is refused with what to write instead.

  ## `create --template catalog`, and a file per part

  `npx @plitzi/cli create shop --template catalog` writes a complete small site to read and change: a layout with a menu,
  a product card component, `public/data/products.json` read as a typed source, a catalog filtered by category and a page
  per product — each part a short file of its own under `src/site/`, assembled by `src/space.ts`. The template is
  authored by sdk-authoring's tests, and a generated project authors, typechecks and lints clean. The skills point to it,
  and `AGENTS.md` asks for a file per part.

  ## `embed` and `svg` elements
  - **`embed({ src, title })`** puts another page in a frame — a map, a video player — lazily loaded, with `allow`,
    `sandbox` and `referrerPolicy` when it needs them. Only a web address or a path of the site is loaded, and in the
    builder the frame does not swallow the click that selects it. `embed-without-title` warns of one a screen reader
    cannot describe.
  - **`svg('<svg …>…</svg>', { label })`** draws SVG markup inside a box its class colours (`currentColor`): checked to be
    one `<svg>` (`svg-not-svg` otherwise) and sanitised as rich text is, plus what only SVG can carry (`foreignObject`,
    animations writing a `javascript:` link). Decorative unless it has a `label`, then `role="img"`. `{{ }}` tokens
    resolve in it like in any attribute.

  ## Pictures resized by the page server

  `createServer({ images: { domains: ['images.example.com'] } })` resizes other sites' pictures at `/_plitzi/img`: an
  `image` whose `src` is one of them offers a `srcset` from 320 to 1920 px, in AVIF or WebP when the browser takes them.
  Each original is downloaded once and each size made once, both kept on disk; a week on they keep answering while the
  original is revalidated with its `ETag` / `Last-Modified`, so an unchanged picture is never resized again. Only the listed hosts (`*.example.com` for subdomains) are fetched, every redirect is
  held to the list and to the outbound guard, and SVG is refused. `sharp` is an optional peer: without it pictures are
  passed through and kept. `image` also takes `sizes`, and `width`/`height` so the browser keeps the picture's space.

  ## `plitzi check` says what the page holds

  Every `plitzi check` now lists the flows that failed while the page loaded, each with the step that failed and why.
  `--state` adds the page's state and every source by its full name (with the shape of what it holds), and `--element
<id>` one element: what it reads, its own state, how many copies, whether it is on screen and its box. Read from the
  page's dev tools, which keep the flows a page runs before they mount; in a test, `readDevTools(page)` from
  `@plitzi/sdk-authoring` answers the same.

  ## `carousel`

  A structure element for slides that change, a marquee and a row that swipes: `carousel({ id: 'hero', items, row,
autoplay: 5000, children: [arrows, dots] })`. Its `row` is written into a `carouselTrack`, and its other children are
  its controls, reading `carousel_<id>.index`, `.count`, `.item` and `.items`. `mode: 'slide'` shows one at a time
  (`transition` `slide`, `fade` or `none`, back entering from the left); `'marquee'` scrolls the items past at `speed`
  px/s with no seam; `'scroll'` is a snapping row a visitor swipes. Steps `carouselNext`, `carouselPrevious`,
  `carouselGoTo`, `carouselPlay` and `carouselPause`; trigger `onChange`. Autoplay holds still under the pointer, with
  keyboard focus inside, in a hidden tab and for reduced motion, and never in the builder. Slides are announced as "2
  of 5" in a region named by `label`.

  ## `plitzi fix`: the fixes authoring knows, written in your source

  `plitzi fix` shows what authoring would fix — a key the element never reads, `'true'` where a boolean goes, a URL in
  page mode, a `state.` prefix on a state key, a binding nothing reads — as a diff of the project's own source: each
  edit made in the call that wrote the element (found by the line and column it remembers), and only where the value is
  a literal. `--write` writes them, formatted as the project formats, authors the space again in a fresh process and
  keeps them only if every fix is gone and no problem was added; one that would add a problem is put back and said with
  the reason. `npm run author` says how many of its problems have one fix. From `@plitzi/sdk-authoring`, `planFixes`
  returns the plan: every problem, and each fix with its place and edit.

  `fixSpace` now reads an element with the linter's own context, so a component instance's props and slot are no longer
  taken for attributes nobody reads — it used to remove the binding of a list row to its component's `item`.

  `plitzi import <url>` measures a page you own in the project's Playwright and writes it into the project as a place to
  start from: `tokens.ts` (the page's custom properties by name, then its dominant colours, each with the value the same
  place shows in the dark scheme; repeated corners and shadows; Google fonts), `outline.ts` (`container()`s for its
  landmarks and blocks, with their layout per breakpoint as what each narrower width changes), its repeated lists as
  `data/*.json`, `assets.json`, a screenshot per width and `IMPORT.md`. Never its words. It imports only a site that is
  the person's: a verified domain of one of their spaces covering the host (the `_plitzi` TXT record, asked of the
  platform's new `GET /account/domains/covering`), or one served from this machine; `--out`, `--widths`, `--force`,
  `--json`, `--api`. From `@plitzi/sdk-authoring`: `importProbe` (runs
  in the page), `importedFiles` and `darkScheme`.

  A compound element without the part it shows its content through — a `carousel` with no `carouselTrack`, a
  `tabContainer` missing its header or body, a `dropdown` with no `dropdownPopup` — is now refused (`part-missing`):
  it rendered nothing of what it held, without a word. The parts are read off the declarations (`elementPartTypes`, the
  `partTypes` catalog), so the builder's issues and publish gate, the MCP's validate and `authorSpace` all hold to it.
  The MCP guide says how a compound element is written.

  The dev tools catch up. **Elements** shows what is on screen as the trees it comes from — the layouts around the page,
  outermost first, the page, and every component an instance places — at their depth, searched together (a match is kept
  with what holds it), each element outlined on the page while it is pointed at. Selected, its **Runtime** tab is the
  report `window.__plitzi.element()` and `plitzi check --element` give: own state, what it reads, the component it places
  or sits in, copies and box, read again every second. That report now finds an element inside a component, which it
  missed. **Logs** has a `realtime` category: the page's connection opening and dropping, each message in (←) and out
  (→), and every topic the server refused, with why. One hook outlines an element for every tab.

  A `webHook` step that gets no answer at all — offline, refused, blocked by CORS — now fails, with the request and the
  reason, so the flow stops and its `onFailure` runs. It used to succeed with an empty response, and the flow carried on
  as if the request had been made. Any answer is still the step's result, an error status included: a flow reads
  `{{ <step>.response.status }}` to tell a 401 from a 200. `response.data` is typed as what the body parsed to.

  The server checks what a deployment's config hands it in one place (`configSeam`): each action document and connector
  manifest a lookup returns goes through the validator the builder saves with, as it is read — an action that is not a
  document is refused by name, and one in a list is left out and said rather than failing the space's schedule — and the
  database drivers and functions config are checked once, as the server starts. Four unchecked casts are gone.

  `@plitzi/sdk-shared/helpers/eventTarget` reads an event's target as a node (`nodeOf`, `isNodeTarget`) or an element
  (`elementOf`, `isElementTarget`) by its own type rather than `instanceof`, which is false for a target in the builder's
  canvas iframe. The builder, the style inspector and the dev tools use it, and type their change and key handlers by
  the input they listen on; the casts of `event.target` are gone.

  The builder's flag form checks each rule's `when` is a group of conditions before it saves, rather than passing
  whatever the field held.

  The CLI's commands now work the same way: the answer on stdout and errors and sign-in prompts on stderr, so `--json`
  is only the answer (`import --json` printed the sign-in prompt into it); exit 1 whenever a command did not do what it
  was asked (`fix --json` with a problem exited 0); and a flag's value checked where the flag is declared, refused with
  what it takes — `--width abc` or `--scheme darkk` used to check at no width or in light, saying nothing. One flag means
  one thing everywhere: `import --widths` is `--width`, like `check`, and `-o`, `-f` and `-e` are the short forms on
  every command that writes, overwrites or names an environment. `import` no longer repeats a sign-in error. `whoami`
  and `runtime status` take `--json` too; `functions` and `runtime push` refuse outside a project, as every other command
  that works on one does, instead of writing `functions/` into whatever folder they were run from; and every command
  says a finished action the same way, in green.

  The SDK's production build keeps `console.warn` and `console.error`, and drops only `log`, `info` and `debug`. It used
  to drop them all: an override of a flag the space does not declare, or a render that failed, said nothing on a
  published site — exactly where nobody can attach a debugger.

  A link to the page being shown says so: it carries `aria-current="page"` — read from the address the page was rendered
  at, so the first paint has it — and a class dresses it with the new `current` style state (`states: { current: … }`,
  a tab in the style editor, folded from `[aria-current="page"]` rules when a space is exported). A site's header now
  goes in a layout once, instead of a copy per page to mark the right navigation item.

  `notifications` dresses the whole toast, not only its colours: `font`, `fontSize`, `border`, `shadow` and `padding`
  join `radius` — the library's variables where it has them, a rule on the toast where it has none. A space no longer
  writes `.Toastify__toast { … }` into its `customCss` for them.

  A visitor whose machine asks for less motion gets it on every space: the SDK's base layer cuts animations and
  transitions to an instant (each still ends where it would) and turns smooth scrolling off. Spaces used to copy that
  rule into their own custom CSS, and one that did not moved anyway.

  Authoring suggests, beside what it refuses and warns: `authorSpace` returns `suggestions` — a shorter way to the same
  page, each with its code, the elements it is about and how many it would save, the largest first. The same header in
  every page is a layout (`repeated-on-pages`, which also names the `current` state when the copies differ only in the
  active link), one structure copied with other words a component or a list (`repeated-shape`), a `text` alone inside a
  button or a link the element's own `content` (`content-attribute`), and `customCss` that a class's states, the SDK or
  `notifications` already say (`custom-css-*`). Copies are compared by what they read too — a block reading its own
  provider is still one block, two pagers over two lists are not — a block only some pages of a layout carry is offered as
  a component rather than a layout of its own, and a text that is a shape drawn inside a button is left alone.
  `suggestSpace({ schema, style })` gives them for any document; they never block. `plitzi_validate` and `plitzi_apply`
  answer with the ones a batch opened up, `npm run author` prints them under the warnings (and `--json` carries them), and
  the authoring skill's new `reference/efficiency.md` teaches the short way first.

  A `link` has words of its own: `content`, drawn before or after its children (`contentPlacement`), as a button's — a
  link with only a label no longer needs a `text` inside it.

  A style that writes its rules beside `states`, `variants` or `ancestors` — `{ desktop: { … }, ancestors: { … } }` — is
  refused with what to write (`rule-set-mixed`: the rules go under `css`), instead of reporting `desktop: [object Object]`
  as a CSS value it could not read.

  `plitzi explain` and `plitzi://explain` name a suggestion's code `suggested`, with its short way, instead of calling it
  `warned`. The MCP server's guide teaches the short way first — a link's own `content`, the `current` state for the link
  to the page being shown, a component for a block only some pages of a layout carry — and how to read the
  `suggestions` `plitzi_validate` and `plitzi_apply` answer with.

  The MCP server dresses the notifications too: `patchSettings { notifications: { background, border, … } }`, merged
  field by field (`null` removes one), and `plitzi://settings` reads them apart from the space's own `customCss` — the
  same rule authoring writes for a space's `notifications`, kept when either changes. The builder's Export gives that
  rule back as `notifications` instead of leaving it in `customCss` (`splitNotificationsCss`, `withNotificationsCss`).

  A `button` and a `link` draw an icon beside their words: `icon` (Font Awesome classes, `'fa-solid fa-arrow-right'`) and
  `iconPlacement` (`before` or `after` the words), dressed through a new `icon` slot; it takes the size of the words and
  no space of its own — the box's `gap`, or a margin on the slot, separates them. One element instead of the element, a
  `text` and a `fontAwesome`; alone, with a `title`, it is an icon button. The builder offers the icon picker in both
  elements' settings (shared now with `fontAwesome`'s), and the `content-attribute` suggestion points at a plain
  `fontAwesome` beside the words too.

  The builder lists the suggestions: `SpaceIssues` answers `suggestions` beside `errors` and `warnings`, the problems
  panel shows them last — the short way, how many elements it saves, and each element it is about, a link to it — and
  the header's issues button, with nothing wrong, shows a light bulb and how many there are.

  The builder edits the notifications' look in the space settings (Notifications: surface, text, accents, radius, font,
  size, border, shadow, padding), checked as it is typed; the custom CSS editor shows the space's own CSS without the
  rule they are stored as, and keeps it. The mechanism moved to `@plitzi/sdk-shared/style/notifications`
  (`notificationsCss`, `notificationsProblem`, `splitNotificationsCss`, `withNotificationsCss`); `@plitzi/sdk-authoring`
  re-exports it, refusing a spec that is not sound as before.

  ## Motion that waits for the page to wake

  The SDK's root carries `data-hydrated` once the page is hydrated, so a space can hold decorative motion that runs on
  the main thread — a custom property, a `background-position`, a `top` — until then, when it would stutter behind the
  hydration's long tasks: `animation-play-state: paused` on the element, and `[data-hydrated] .x { animation-play-state:
running }`. Opacity and transform animations run on the compositor and need no gate.

  Hydration is lighter on the way: the fonts' Google URLs sort their families by code point instead of `localeCompare`,
  whose first call built a collator in the middle of the page's first render, and twig's compiled-template cache holds
  1024 templates instead of a number a large space outgrew, compiling the same ones again on every render.

  Good practices for motion, said wherever a space is written: `docs/en/motion.md`, the authoring skill (a rule in
  `SKILL.md` and `reference/colours-and-motion.md`), the MCP server's guide and quickstart, and the website's styling
  docs — animate `opacity` and `transform`, never blur, a shadow or a size; fake the expensive ones with the cheap ones;
  hold main-thread decoration until `data-hydrated`; short entrances, one slow loop per screen, no `transition: all`.

  `heavy-animation`, a new suggestion: keyframes that something runs and that animate a size or a position, a blur or a
  shadow — or, in a loop, a colour, a gradient or a custom property — are named with each property and the way out of
  its cost. A loop that starts `paused` and runs under `[data-hydrated]` is let through, a property that only switches
  (`visibility`) is not counted, and keyframes nothing runs are not mentioned. It reaches `authorSpace`, `npm run
author`, `plitzi_validate`/`plitzi_apply`, `plitzi explain` and the builder's problems panel like every suggestion. The
  stylesheet scanner `customCss` folding used is shared now (`style/stylesheet`), and reads at-rules' blocks.

  `authorSpace` suggests `heavy-animation` for keyframes something runs off the compositor — a size, a position, a
  blur, a shadow every time; a colour, a gradient or a custom property in a loop — naming each property and the way out
  of its cost. A loop that starts `paused` and runs under `[data-hydrated]` is let through; a property that only
  switches (`visibility`) is not counted. It reaches `plitzi_validate`, `npm run author` and the builder's problems
  panel like every suggestion, and never blocks. The scanner `customCss` is read with is shared now
  (`style/stylesheet`), so the fold and this read the same segments.

  `@plitzi/plitzi-ui` 1.6.29: every field is labelled by its `label` and described by its error message, the code
  editor included.

  ## A layout grid over the canvas

  The builder's header has a layout grid switch beside the element outlines: the columns a page is laid out on, drawn
  over the canvas — twelve on a desktop, eight on a tablet, four on a phone, with their gutters and margins — so an
  element is lined up by eye with the rest of the page — switching at the page's own breakpoints. It follows the canvas
  zoom, lets every click through, and is remembered between visits like the outlines.

  ## A QA tab in the dev tools

  The dev tools — wherever debugging is authorized, a pre-production deployment included — have a **QA** tab for whoever
  checks a build in the browser it will be used in. A bar of tools over the page: an **inspector** — point at any element
  for its box model, type, colours and their contrast; click to keep it in the tab with its computed box, type, classes
  and every CSS rule that reaches it as written (copyable); hold Alt over another to measure the distance between them —
  the builder's layout grid, every element's outline, the order the Tab key walks the controls in, the viewport's size
  and the breakpoint showing, animations paused, the page with reduced motion, and the page as seen without one kind of
  colour, in grayscale or out of focus. Beside it, six checks that outline what they find and scroll to it: whatever
  sticks out past the page's sides, controls and pictures with no name, text under AA contrast, pictures stretched past
  their pixels or far bigger than shown, a heading outline with no h1 or a skipped level, and touch targets under 24 × 24
  px with another too close (WCAG 2.2). The tab lays the checks and the inspector side by side when the panel is wide.
  Folding the panel away stops the inspector and the checks; the views — grid, outlines, vision — stay, in this browser.
  The tab is offered where `DevToolsContainer` is given `qa` — the SDK does, over its page; an application shell such as
  the builder does not, so its own UI is never walked by the checks. Its settings are kept under a key of their own
  (`plitzi-sdk-dev-tools-qa`), the checks run when the page is idle, and the tab order is worked out again only when the
  page changes.

  The layout grid and the breakpoints are one definition in `@plitzi/sdk-shared/style` (`LAYOUT_GRIDS`,
  `layoutGridLook`, `layoutGridCss`, `DISPLAY_MODE_MIN_WIDTH`, `displayModeAt`), which `@plitzi/sdk-style` compiles its
  media queries from and the builder's grid draws with. The SDK's stylesheet applies its reduced-motion rule under the
  class `plitzi-reduced-motion` on the document too, from the same mixin as the media query.

- Updated dependencies [8d1cc02]
  - @plitzi/sdk-navigation@0.37.10
  - @plitzi/sdk-schema@0.37.10
  - @plitzi/sdk-shared@0.37.10
  - @plitzi/sdk-style@0.37.10

## 0.37.9

### Patch Changes

- 3ae61a4: ## Components replace segments

  - **What a component is:** a reusable block written once and placed anywhere as an instance. An edit to the component
    is an edit to every instance.
  - **Where it lives:** in the space document, as `schema.components`, one tree per component and never in
    `schema.flat`. It is published, rolled back, copied by templates and exported with the space.
  - **Props and slots:**
    - A component declares props (`type`, `description`, `required`, `default`, `options`). An instance hands them in
      as its own attributes, so templates and bindings reach them. Inside, they are read as `{{ props.<name> }}`.
    - Slots are elements an instance fills; each child names its slot in `attributes.slot`.
  - **A prop an instance leaves out prints nothing.** It is its `default`, or `null`. `props` is a settled source:
    - `processTwig` takes `{ settled }` in place of `keepEmptyTokens: true`.
    - Every other empty token is still kept for a later pass.
    - `COMPONENT_PROPS_SOURCE` names the source.
  - **Fixed: a flow in a list row or a component instance acts on its own copy.** A step's target resolves in the
    replica the flow fired in first, then outwards. It used to reach whichever copy registered last.
  - **Fixed: an instance's own `visible` hides it in preview.** The same goes for an element reference.
  - **Fixed: a list row keeps its state with its record.** Rows are keyed by each record's unique `id`, so filtering no
    longer moves one row's state onto another.
  - **Closed scope:** inside, a component reads only its props and the globals. The validator, `lintSpace` and
    `authorSpace` each refuse a read of the page around an instance. Components nest, and a cycle is refused.
  - **Where to use them:**
    - In code (`@plitzi/sdk-authoring`): `SpaceSpec.components` and `component(id, { props, children })`.
      `specFromSpace` and `specToSource` read and write both.
    - In the builder:
      - a Components panel lists them, and an open component becomes the canvas;
      - an element becomes a component with **Save as component**;
      - in an instance's settings, an instance gets its props and slots, or is **detached** back into a copy.
    - In the MCP: `upsertComponent` and `deleteComponent`. Element ops work inside a component through `pageRef`.
  - **Schema helpers:** `@plitzi/sdk-schema` gains `addComponent`, `updateComponent`, `removeComponent`,
    `detachInstance`, `renameElement`, `treeOf`, `flatMapOf` and `documentIds`.
  - **GraphQL and live events:** `SpaceAddComponent`, `SpaceUpdateComponent`, `SpaceRemoveComponent` and
    `SpaceDetachInstance`, each with a live event. History records a declaration change as a `component` entry.
  - **Breaking: segments are removed.** This covers:
    - `@plitzi/sdk-shared`'s segment types, queries, mutations, context and `SEGMENT_*` events;
    - `referenceType: 'segment'`;
    - the `Segments` builder module;
    - `Space.segments` and the `Segment`/`Segments` queries;
    - `CommonState.prevSchema`.
  - **Breaking: `ElementLayout` and `LayoutBody` change shape.**
    - `ElementLayout` is `{ slots, rootId, type }`; it was `{ containerId }`.
    - `LayoutBody` takes `bodies` keyed by slot.
    - `reference`'s `referenceContainer` attribute is removed.
  - Guide: `docs/en/components.md`.

  ## Functions ask for the time they need
  - **What changes:** a task can ask for more CPU or wall time than the default with `limits`, in milliseconds. Example:
    `limits: { cpuMs: 1000, wallMs: 20_000 }`. `defineFunctions({ limits })` asks it for every task and route at once,
    and a task's own limits win over those.
  - **What a run is given:** what it asked for, or the default (100 ms of CPU, 10 s) when it asked for nothing. Never
    above the space's plan or the deployment's ceiling.
  - **Deployment ceilings:** `functions.limits` sets them. `DEFAULT_FUNCTION_CEILINGS` covers each unset one, at 2 s of
    CPU and 30 s.
  - **Asking for more than the ceiling** is a problem when the functions are saved; it is never quietly cut down.
  - **Manifest:** carries what each task asked for, and the builder shows it beside the task.

  ## Functions answer under `/fn`, not `/api`

  A space's routes are served at `/fn/<path>` (`FUNCTION_ROUTES_PREFIX`). `/api` is a slug a site wants for a page of its
  own. A page under `/fn` is refused instead (`page-route-reserved`).

  ## The builder's Functions panel

  Rebuilt around the code. The panel reads `defineFunctions` as it is typed and writes into it, so the code stays the one
  place a function is declared.

  - **Layout:** the tasks, routes and files on the left, the code in the middle, the selected task on the right.
  - **Live list:** tasks and routes are listed as the code declares them, including tasks imported from another file.
    A task you have written but not saved says so. Tasks built by calling something are counted, and listed once saved.
  - **Code and panel follow each other:** clicking a task or a route opens its file at its line. Putting the cursor inside
    a task's code selects that task.
  - **New task:** + in Tasks asks for its namespace, action and title. The task is written into `defineFunctions` with a
    `run` to start from, in the file's own quotes, and the editor opens on it.
  - **Time limit:** each task gets a slider from 100 ms to 1 s of CPU per run, with presets. The value is written into
    the task as `limits: { cpuMs }`. "Use default" takes it out. `DEFAULT_FUNCTION_TIME_LIMITS` in
    `@plitzi/sdk-shared/actions` is the default both the panel and the server use.
  - **Test:** fills a task's params the way its step does, from their defaults: a select, a switch or text. JSON stays a
    toggle away. With unsaved changes, the button reads "Save & run": it saves, then runs. If the save fails, it says why.
  - **Header:** shows Saved, Unsaved (and in how many files) or the number of problems the last save found. ⌘S saves.
    **Discard** asks first, then puts every file back to what was last saved, or back to nothing for functions never
    saved. Removing the functions is a quiet button beside Save.
  - **Problems:** clicking one opens its file at its line.
  - **Editor:** each file has its own editor and undo history. Opening another file no longer marks the one you left as
    changed. Before this, it could also write the newly opened file's text into the one you left. The cause was in
    `@plitzi/plitzi-ui`'s CodeMirror, fixed in 1.6.25, which every package now depends on. That release also sets code
    editors (several lines) in a monospaced face again. Long lines scroll inside the editor, and the line numbers stay
    in place.

  ## A space's own functions are their own category of steps

  In the action editor's step picker, the space's own functions are listed under **Functions**, apart from the
  platform's **Tasks**. The other headings now read Callbacks, Global callbacks and Utilities. The saved step is still a
  `task` node.

  - `@plitzi/sdk-server`: every registered task has an `origin`, `'deployment'` (shipped with the server or a native
    function) or `'space'` (from the space's functions). `describeCatalog`, `/_action/catalog` and the builder's
    `SpaceActionTasks` carry it (`ActionTaskDescriptor.origin`).
  - `@plitzi/sdk-shared`: an `InteractionCallback` may name the `group` the picker lists it under.

  ## Fixed: preview no longer breaks a builder that is embedded in a page

  When the builder is mounted inside a Plitzi page (the platform's `/spaces/:id/update`), going to preview with a page
  that has SEO turned on left the builder unstyled. The previewed page wrote its title and description through a head
  manager of the builder's own, and that manager rewrote the host page's head, removing the builder's own stylesheet.

  - `@plitzi/sdk-shared`: a new render setting, `ownsHead`, says whether the page may write the document head. It is on
    by default (`DEFAULT_RENDER_SETTINGS`).
  - `@plitzi/sdk-elements`: `Page` writes its SEO only where `ownsHead` is on.
  - Builder: sets `ownsHead: false` for its canvas. A page drawn there is in a frame, and the document head is the
    editor's. The canvas's own `HelmetProvider` is gone.

  ## Fixed: the builder's plan usage panel shows the space being edited
  - **The 404 is gone.** Opening Plan usage said "The account breakdown could not be read (The server answered 404.)".
    The panel asked `/account/usage`, which went away when accounts became workspaces.
  - **Only this space.** The panel listed every space of the workspace. It now reads `/spaces/:spaceId/usage`, which
    now also answers the space's own `pages` (the heaviest ten), `pagesTotal` and `periodEndsAt`. The plan's ceilings
    stay on top. Anyone who can edit the space can read it, including a guest of another workspace.
  - **It scrolls.** A long breakdown scrolls inside the modal, where it used to overflow.
  - **`getKeyDecoded(webKey, true)` reads the token's subject.** The function, in `@plitzi/sdk-shared`, looked for
    `data.spaceId`, which space tokens no longer carry, so every space decoded as 0. The builder asked about space 0, and
    the builder and the SDK kept every space's persisted state under the same key on a host. Pages served without a
    `webKey` (SSR) still decode as 0, which is what their painted-state cookie is named after.

  ## Fixed: a remote plugin in the builder reads the canvas it sits in

  The builder carries its own copy of the Plitzi runtime. A remote plugin imports `@plitzi/plitzi-sdk`, which the page's
  import map resolves to the SDK's copy. Each copy made its own React contexts, so on the builder's canvas a plugin read
  none of the canvas's providers. In the builder embedded in Plitzi's site, it read the site around the builder instead:
  the site's element as its own, the site's live mode (so it stayed interactive while being edited), and the site's store
  and interactions.

  - `@plitzi/sdk-shared` gains `sharedContext(name, default)`: a context made once per page and handed to every copy of
    the runtime that asks for it.
  - The runtime's contexts now go through it, so a provider from any copy reaches a consumer from any copy:
    - `@plitzi/sdk-shared`: service, component, schema, network, theme scope, dev tools, builder.
    - `@plitzi/sdk-elements`: element, element parent, layout body.
    - interactions, plugins, event bridge, auth, variables and style.
  - The store's contexts need `@plitzi/nexus` 1.4.0, which does the same. Every `@plitzi/*` package now asks for
    `^1.4.0`, which is published.

  ## The source of plugins and runtimes is kept on the space

  What a plugin or a runtime is built from now goes up with it, so a space can be taken back out as a project
  (`plitzi create --from`, below).

  - `@plitzi/cli`:
    - `plitzi pack plugin` writes the plugin's source beside its zip: every file of the project its elements import,
      `import type` included, and the packages they need. `--source-root` names the project those paths are relative to.
    - `plitzi upload plugin` and `plitzi runtime push` keep that source on the space, in its private bucket.
    - `plitzi pack source` writes it to a file.
    - A source that cannot be kept (a file outside the project, an undeclared package, a credential in the code) never
      stops the upload or the push: they say why, and the artifact is kept built only.
  - `@plitzi/sdk-shared/source`: the snapshot's format, the paths it may hold and the credential check, shared by the CLI
    and the platform.

  ## `plitzi create --from` and `plitzi pull`: a space on Plitzi as a project of your own

  The way back from everything the CLI puts on Plitzi. `plitzi create my-board --from pizarra` writes a server project
  holding what the space is made of, and runs it with nothing of Plitzi's: neither its servers nor its CDN. `plitzi pull`
  keeps it in step with the space. See `docs/en/projects-from-spaces.md`.

  - **What lands in the project:**
    - its pages as authoring code;
    - its server actions as `defineAction` code — JSON, with the reason said, for one that would not read back exactly;
    - its plugins and runtime as the source they were uploaded from, and its functions;
    - its files, downloaded into `public/`, with every CDN address rewritten to the project's.
  - **`src/main.ts`** serves all of it, the runtime in the same process.
  - **`.env`** gets a key made for the project's actions to sign with, and the names of the variables and credentials
    the space had. Their values stay on Plitzi.
  - **Who may run it:** the person must be signed in and able to change the space (owner, administrator or writer).
  - **Plugins** are rebuilt against the project's SDK. One uploaded before sources were kept runs as it was built, from
    `vendor/plugins/`, and the report says to upload it again.
  - **The end of `create`** says what came across differently, including a space whose visitors sign in with Plitzi.
  - `--source cloud` keeps the pages on Plitzi and runs the rest locally.
  - **Any version:** `--environment` and `--revision` take out a published snapshot — its latest, or one revision pinned
    — instead of the draft, with the source its plugins and runtime were built from then. A cloud project serves that
    revision pinned.
  - **`plitzi pull`** writes what changed on the space, keeps what changed in the project, and writes nothing when a
    file changed on both — naming them, with `--force` to take the space's copy. It never touches `.env`, only adds to
    `package.json`, and keeps `plitzi functions push` working from the project. It follows the version the project was
    made from, and `--environment`/`--revision` move it.
  - `@plitzi/sdk-authoring`:
    - `actionSpecFromEntry` reads an action document back into its `defineAction` declaration, only when the round trip
      is exact, and `actionToSource` writes it as a module.
    - `defineAction` takes `limits`.
    - `specToSource` takes `importExtension: '.ts'`, for split files that Node imports as they are.

  ## The builder shows what a snapshot holds

  **Make Snapshot** lists what it will freeze — pages, layouts and elements, server actions, connectors, functions, the
  runtime and the plugins, each with whether its source is kept — and what no snapshot freezes: the space's files, its
  variables and credentials. A space's components are part of its document, so they are frozen with its pages. **Publish Snapshot** lists what the chosen environment's snapshot holds.

  ## Fixed: a space read from Plitzi kept its server elements
  - **What happened:** a page server reading its space from Plitzi (`createCloudAdapters`) never ran an element's
    `render` action, and a browser-rendered space ignored `loadStrategy`. The space's GraphQL answered neither
    `runtime` nor `loadStrategy` of an element, nor the space's `rsc` settings.
  - **Now:** the platform answers them, and the SDK, the builder and the cloud adapters ask for them.

  ## A plugin the deployment registers is not looked for elsewhere

  `@plitzi/sdk-server` used to fetch the manifest of every plugin the space lists on its CDN, even one the deployment
  registers itself, and logged a warning when the CDN was out of reach. It now asks only for the ones it does not have.

  ## Fixed: inline code in Markdown carries nothing of the syntax tree

  A `markdown` element wrote every inline `` `code` `` as `<code node="[object Object]">`: `react-markdown` hands its
  renderers the syntax-tree node as a prop, and the inline branch spread it onto the tag. Fixed in
  `@plitzi/plitzi-ui` 1.6.26 (with a test), which every package now asks for.

  ## Dev tools hear about the render run the page stopped waiting for

  When a server element's action ran past the section's budget, the page was answered without it. The run ended a moment
  later, after the page's runs had been sent, so the dev tools never showed the one run that needed debugging. It is now
  told the moment the page stops waiting, as `aborted`, with the reason.

  ## Fixed: a tab you come back to no longer loses its session
  - **What happened:** a page left in another tab past its access token's life signed its visitor out on return. A
    reload put them right back in.
  - **Why:** the browser drops the cookie carrying the access token the moment the token expires, and the background
    tab's renewal timer had not run. The first check on return was told `missing`, which the client took as no
    session at all.
  - **Now:** a `missing` refusal is renewed instead whenever the browser can still renew, meaning it holds a refresh
    token or a session hint whose renewal window is open. The session ends only if that renewal fails.
  - **Requests made in that moment:** `reportAuthFailure` now answers whether it renewed the session. A read refused
    as the tab came back is asked again, once, once the session is renewed. This covers an api container's read and a
    server section's refresh, so they no longer show a 401 that only a reload cleared.

- Updated dependencies [3ae61a4]
  - @plitzi/sdk-navigation@0.37.9
  - @plitzi/sdk-schema@0.37.9
  - @plitzi/sdk-shared@0.37.9
  - @plitzi/sdk-style@0.37.9

## 0.37.8

### Patch Changes

- 4d10e0a: ## Fixed: an api container could not read a file from a CDN

  - **What happened:** the api container sent `Content-Type: application/json` on every request, including a GET with no
    body to describe. That made every read a non-simple cross-origin request, so the browser asked the host's
    permission first.
  - **Who it hit:** hosts that allow plain cross-origin reads (GET and HEAD from any origin, the usual CORS of a public
    bucket, the space's own CDN among them) refused that preflight. The file never loaded. Tremor's world outlines on
    `cdn-dev.plitzi.com` are one example.
  - **What changes:** a read now sends `Accept: application/json`, and `Content-Type` goes only with a body, unless the
    author set their own. Headers the author adds still make the request non-simple, as they must.

- Updated dependencies [4d10e0a]
  - @plitzi/sdk-navigation@0.37.8
  - @plitzi/sdk-schema@0.37.8
  - @plitzi/sdk-shared@0.37.8
  - @plitzi/sdk-style@0.37.8

## 0.37.7

### Patch Changes

- 4d10e0a: ## CDNs with several buckets

  A CDN is the customer's own storage account — S3 or R2, which they run and pay for — and now holds any number of
  buckets, each with its own configuration: its name at the provider, its region, `public` (served at its domain) or
  `private` (no domain, read only by the platform with the CDN's credential).

  - `Cdn` carries `buckets: CdnBucket[]`; `domain`, `visibility`, `bucketName` and `region` moved from the CDN to its
    buckets. `Resource.bucketIdentifier` names the bucket a file is in.
  - `SpaceAddCdn(name, provider, endpoint, buckets)` creates the account with its buckets; `SpaceUpdateCdn` changes the
    account only. New `SpaceAddCdnBucket`, `SpaceUpdateCdnBucket` and `SpaceRemoveCdnBucket`.
  - `SpaceResources`, `SpaceAddResource`, `SpaceRemoveResource` and `SpaceMoveResource` take `bucketIdentifier`.
  - Server code — functions and runtime — goes in the space's oldest private bucket. A bucket that keeps code a version
    runs can be neither made public, pointed at another bucket nor removed, and neither can its CDN.
  - Builder: Resources shows each CDN with its buckets — add, edit and remove buckets, upload and browse per bucket; the
    account (name, provider, endpoint, credential) is edited apart. Saving an element as a template picks a public
    bucket (`elementAsTemplate({ cdnIdentifier, bucketIdentifier }, …)`).
  - CLI: `plitzi upload plugin --bucket <identifier>` (with `--cdn` to narrow); only public buckets are offered, a private
    one is refused.

- Updated dependencies [4d10e0a]
  - @plitzi/sdk-navigation@0.37.7
  - @plitzi/sdk-schema@0.37.7
  - @plitzi/sdk-shared@0.37.7
  - @plitzi/sdk-style@0.37.7

## 0.37.6

### Patch Changes

- d6c2a21: ## Server code on a private CDN

  - **A CDN has a visibility**: `public` (the default — its files served at its domain: plugins, images, templates) or
    `private` (no domain, read only by the platform with its credential). The builder's CDN form asks for it, and every
    CDN now has **Settings** in Resources to change its configuration — until now a CDN could not be edited at all.
  - **A space's server code is kept on its private CDN**, not in the platform's database: its functions' source and
    bundle, and its runtime's packed code, named by what they hold. Saving functions or pushing a runtime to a space with
    no private CDN is refused with how to add one (`FunctionsRefusal.limit: 'storage'`). Resources lists them under
    **Server code** with the versions that run each (`Resource.usedBy`, `ResourceType` `server`); one in use cannot be
    removed. A private CDN cannot take a page's file, and `plitzi upload plugin` offers only public CDNs.
  - **A space made from a template** gets the template's functions as an offer (`FunctionsDraft.offer`): the Functions
    panel installs them (`SpaceInstallTemplateFunctions`) once the space has a private CDN.
  - Types: `Cdn.visibility`, `CdnVisibility`; `SpaceAddCdn` / `SpaceUpdateCdn` take `visibility` and a nullable `domain`.

- Updated dependencies [d6c2a21]
  - @plitzi/sdk-navigation@0.37.6
  - @plitzi/sdk-schema@0.37.6
  - @plitzi/sdk-shared@0.37.6
  - @plitzi/sdk-style@0.37.6

## 0.37.5

### Patch Changes

- a32a5a2: ## `@plitzi/sdk-shared`'s GraphQL documents are text

  - **Every document is a plain string marked `/* GraphQL */`**, the builder's as the SDK's already were, and the client
    parses what it sends — the builder with Apollo's `gql`. A server importing the package no longer loads a GraphQL
    parser or parses 115 documents at boot; `graphql` and `graphql-tag` are no longer dependencies.
  - `BuilderQueries` and `BuilderMutations` are typed `Record<keyof …Map, string>`, and every operation is named as its
    file is: `SpacePublish`, `SpaceDeploy`, `SpaceFixIssues`, `SpaceUpdate`, `SpaceUpdateSchema`, `SpaceUpdateElement(s)`,
    `SpaceRemoveElement`, `StyleUpdate` and `SegmentPublish` gain their `Mutation` suffix, and the space's subscription,
    anonymous until now, is `SpaceEventSubscription`.
  - **Breaking:** `BuilderQueries`, `BuilderMutations` and `SpaceEventSubscription` are strings, not `DocumentNode`s —
    pass them through `gql` for Apollo.

- Updated dependencies [a32a5a2]
  - @plitzi/sdk-navigation@0.37.5
  - @plitzi/sdk-schema@0.37.5
  - @plitzi/sdk-shared@0.37.5
  - @plitzi/sdk-style@0.37.5

## 0.37.4

### Patch Changes

- cadd1b9: ## `@plitzi/sdk-shared` loads without Apollo

  - **The root entry no longer needs `@apollo/client`.** It re-exported every builder query, mutation and subscription,
    written with `gql` from `@apollo/client/core` — a package it never declared. Inside the monorepo the builder's copy
    answered for it; a server installing the published packages (`@plitzi/sdk-server` and anything else that imports
    `@plitzi/sdk-shared`) failed at boot with `ERR_MODULE_NOT_FOUND: @apollo/client`. The documents are now written with
    `graphql-tag`, which Apollo's `gql` already was, and `graphql` is a dependency.
  - **The two helpers that do run Apollo leave the barrels**: `createAuthFailureLink` is imported from
    `@plitzi/sdk-shared/auth/authFailureLink` (no longer from `@plitzi/sdk-shared/auth` or the root) and
    `createStripTypenameLink` from `@plitzi/sdk-shared/helpers/stripTypename`. `@apollo/client` is an optional peer, for
    those two alone.

- Updated dependencies [cadd1b9]
  - @plitzi/sdk-navigation@0.37.4
  - @plitzi/sdk-schema@0.37.4
  - @plitzi/sdk-shared@0.37.4
  - @plitzi/sdk-style@0.37.4

## 0.37.3

### Patch Changes

- cadd1b9: ## Authoring: nothing renders wrong in silence

  - `authorSpace` reads every template with the runtime's own parser and refuses what it would read past: an operator it
    does not implement (`matches`), an unknown filter, function or tag, a stray character, an unclosed bracket.
  - Binding templates and attribute tokens are held to what is in scope: a name nothing answers to, a short source name,
    or a source read from outside the element that publishes it is refused with the name it should have been.
  - Children on a type that holds none (`heading`, `text`, `paragraph`, `image`, `formControl`…) are refused.
  - A text template feeding an attribute that holds a list (a list's `items`) is refused; `returnMode: 'value'` fixes it.
  - Warning `default-content-beside-children`: a `button` whose placeholder "Button" would print beside its children.
  - New: `bindTemplate(to, source, template, { category, returns })`; `visible: { source, template }`; a `compact`
    breakpoint key (tablet and mobile at once); handles flag `repeated` (inside a list row) and `boxless` (a provider
    with no tag); catalogues `elementLeafTypes` and `elementDefaultAttributes`.
  - Defensive by default: every field of a space, page, layout, element, binding and step is checked against what its
    type declares — an unknown key, an enumerated attribute outside its values (`subType: 'h7'`, declared per element with
    `valuesOf`), text where a flag or a list is read, an unknown binding category or transformer, a step or transformer
    param its catalog does not take (or of the wrong type), a flow with no trigger, a link or `navigate` to a page id that
    does not exist, a URL/`mailto:`/`tel:` in page mode, a controlled list with nothing to render, two pages at one
    address, an empty id, and a CSS value that is empty or breaks out of its declaration are all refused. An attribute a
    built-in element never reads is now refused (was a warning). New warnings: `unknown-element-type` (name plugin types
    with `authorSpace(space, { pluginTypes })`), `overlay-starts-open`, `provider-without-source`, `colour-without-dark`.
  - `computed` on a space: values declared once and read anywhere as `{{ computed.<name> }}` (published as the global
    source `computed`). `notifications` on a space: the toast colours and radius.
  - `didYouMean` also suggests a candidate that contains what was written (`template` → `twigTemplate`).
  - The decompiler drops a step param its action does not take, moves `settings.computed` to `computed`, and repairs a
    full URL in a page-mode link to `mode: 'external'`, each reported as a correction.
  - The skill gains `lists.md`, `plugins.md`, `authoring-errors.md` and a Recipes section (held by a test), and corrects
    the attribute template scope, the Twig subset, the filter list, trigger payloads, offline data, `isEmpty`,
    `loadStrategy` and `keepState`.

  ## One linter for every writer
  - `lintSpace({ schema, style }, catalogs)` is the document linter everything is held to: `authorSpace` (through
    `validateSpace`), `validateTemplate`, the MCP and the server's publish gate read a space with the same rules and the
    same messages. The per-rule checks that `authorSpace` and the MCP each kept are gone.
  - New rule `binding-target-unknown`: a binding onto an attribute its element never reads (`data-*`, a misspelt name)
    is refused — the value arrived and nothing showed it. `className` stays bindable.
  - The MCP lints the draft of every batch (`lintDraft`) and holds each element it touches to it; an issue already there
    is labelled pre-existing. A binding onto an element that does not exist is now refused there too (the structural pass
    runs with the source catalogue). Its own attribute and `{{ variable }}` checks for built-in types are gone — the lint
    knows every attribute — so an unknown prop or an unknown variable is an error, not a warning.
  - New rule `callback-key-unknown`: an element `setState`/`toggleState` writing a field its target never reads (or a
    state other than `visibility` / `styleSelectors.<selector>`) is refused. The params of the callbacks every element
    answers to are held to their spec (`vocabulary.sharedCallbacks`), and step params are read with their defaults
    filled in, as the runtime reads them — `autoDismissTimeout: 'soon'` is caught though `autoDismiss` was left out.
  - `lintSpace` has one test per code, and a test that fails when a rule is added without one.
  - `validateTemplate` tells a binding onto a provider left behind once (`TEMPLATE_BINDING_OUT_OF_SCOPE`), no longer also
    as `UNRESOLVED_BINDING_SOURCE`.
  - `@plitzi/sdk-schema`: `REFERENCE_ERROR_CODES` and `isIntegrityError` tell a reference left dangling from a broken tree.
  - MCP: `plitzi_validate`, `plitzi_apply` and `plitzi_render` share one pipeline (`draftBatch`), so validate answers
    exactly what apply would. A structural error a batch introduces blocks it wherever it lands; one already in an
    untouched element no longer blocks every edit. Its own checks that the lint now makes (first node a trigger, param
    types, a missing step target, a setState key on a built-in type) are gone.
  - Builder: a write the server refuses is now put back in the editor (the check never matched, so a refused change
    stayed on screen and the next save built on it); only a write the server never answered is retried. The unused
    `urgent` queue — which nothing ever processed — `count` and `getIsProcessing` are gone.
  - Builder: a problems button in the header lists what is wrong with the saved space (re-read whenever the save queue
    drains); each issue selects its element. Snapshot opens that list instead of publishing while there are errors, and
    shows it when the server refuses a publish with `SPACE_INVALID`. New builder query `SpaceIssues` (`TSpaceIssue`,
    `TSpaceIssues`).

  - `fixSpace(documents, catalogs?, codes?)` and `FIXABLE_CODES`: the issues with a single reading are fixed on a copy
    — a URL in a page-mode link or `navigate`, an attribute or step param that is a typo (renamed) or is never read
    (dropped), `'true'`/`'false'` where a flag is read, a global callback on the wrong module, a utility on an element,
    a visibility binding in `attributes`, a binding onto an attribute nothing reads, a misspelt transformer, an overlay
    that starts open, a state key with `state.` in it — each reported as a line. Held by a test per code. The builder's
    problems list offers "Fix N automatically" (server mutation `SpaceFixIssues`; each issue says whether it is
    `fixable`).
  - The linter's source scope is what the runtime walks: an element sees the providers around it and, past its page,
    the layout around the slot it renders in — no longer any provider anywhere in a layout.
  - Builder: a template that cannot be read is said under the field while it is typed, in the binding transformer and
    flow step editors.

  ## One tree walk, one tree writer
  - `@plitzi/sdk-schema/helpers/elementTree`: `parentChain`, `renderContext` and `descendants`, cycle-safe. The runtime's
    data-source visibility, the builder's reveal, `authorSpace` and the linter all walk the tree through it.
  - `FlatMap` loses what nobody called: `validate`/`isValid`/`assertValid` (the validation lives in `validateSchema`),
    `getElement`, `elementIdConflict`, `takenIds`, `renameConflict`, `parentTree`, `childTree` and the unused statics.
    `moveElement` refuses a move into the element's own subtree without walking forever on a cyclic document, and a move
    into another page or layout carries the subtree's `rootId`.
  - The MCP writes the tree through `FlatMap` (create, move, delete) like every other writer; a move into the element's
    own descendant is refused with the reason.
  - `schemaToWire`/`schemaFromWire` (sdk-shared `network/spaceEvents`): a whole schema on the live channel has `flat` as
    a list; the builder reads `SPACE_UPDATED` through `schemaFromWire`.

  - `FlatMap` no longer goes through lodash `get`/`set` with string paths: every read and write is typed. `addElement`
    and `moveElement` share one placement step and validate before they write — an insert that is refused leaves no
    element behind, and an anchor its parent does not list is refused rather than landing the element before the last
    sibling. A template's base element has no `parentId` (it was `null`, which the type does not allow).
  - Removed what nothing used: the MCP's `isActionOp`/`isConnectorOp`/`pageStylesUri`; in the builder the empty module
    barrels, the pending `Integrations` stub, `PluginSettingsForm` and the code commented out around it,
    `useInfiniteGraphQL`, a second `formatTime`, `ToggleItem`, `ButtonVoice`, and `SpaceContext`/its provider.
  - Builder resources: one preview (`ResourceContent`) for a resource on its way up, in the list and in its details — the
    list's own copy of the plugin card is gone — and one card for images and videos (`ResourceMedia`). A video was
    dragged as an image and kept its remove button under the cursor while dragged, and so did any other file; both fixed.
  - `elementsByRoot` (and `RootElements`) in `@plitzi/sdk-schema/helpers/elementTree`: the element count grouped by the
    page or layout that holds it. The builder's quota panel and the server's usage API each carried a copy.
  - Builder: a plugin removed from the resources leaves the elements panel while it is open, and one installed shows up in
    it (the panel read the component registry once); removing a plugin no longer takes every other plugin's stylesheet
    with it. Asking to remove a plugin that is still placed says on which pages, and how many of its elements will show
    as not found.
  - `rootName` in `@plitzi/sdk-schema/helpers/elementTree`, and `elementsByRoot` takes an optional filter: the same
    per-page grouping, narrowed to the elements asked about.
  - Builder: the model picker's ↑/↓ and ↵ do what its footer says (they were swallowed). Gone: the space setting `head`,
    which was never wired, a connectivity listener that only logged, and commented-out code across the builder, the SDK
    app and the packages.
  - The plugin marketplace is removed. Nothing in the builder opened it any more; a space's plugins are still installed
    from its resources. Gone with it: the builder's `Marketplace` module and the `integrations` placeholder panel,
    `PluginsContextValue.fetch`, and the builder query `Plugins` (`@plitzi/sdk-shared/network/graphql/builder/Queries/PluginsQuery`).
    The server drops the catalog behind it — the `Plugins`/`Plugin` queries, `/api/plugins` and its six tables.
  - No debug logging left in shipped code: `stringToArray` logged every call and the transition editor every change;
    `BlockJsx` and plugin loading report their failures as errors.

  ## Runtime
  - Attribute `{{ tokens }}` resolve against every source around the element — a list row, a provider, `state`, `auth`,
    `navigation.currentPageId` — not only variables and route params. Only authored values are interpolated: a value a
    binding wrote is data and is never evaluated.
  - The `twigTemplate` binding transformer takes `returnMode: 'value'`, answering a single `{{ expression }}` with its
    value (`processTwigValue`): a filtered array, a number, a boolean.
  - `keepState` no longer deletes what it kept on the next load: before the `auth` source is published the owner is
    unknown, not "the browser".
  - A `formControl` outside a `form` renders and works on its own (own value, `onChange`, follows `defaultValue`), and
    its hooks no longer run conditionally.
  - Modals and dialogs are fixed to the viewport, as tall as their content up to the screen; their close control is a
    button. `openModal` metadata that parses as a non-object (`'42'`) is kept as `content`.
  - `button` no longer takes its accessible name from `content`.
  - `apiContainer.isEmpty` reads a plain `query` answer by what arrived.
  - `container` accepts `h1`–`h6` tags, for a heading made of parts.
  - `setState` keeps decimals for `number` and has a `json` type for objects and lists; `runServerAction.input` and
    `webHook.body` are declared as the objects they take (param type `json`).
  - `addNotification`'s `appearance` is spelled correctly (was `appeareance`; existing flows need the key renamed).
    Notifications follow the space's theme and font.
  - An `image` accepts `loadMode: 'auto'`, which the builder offers.
  - `getStateManager()` gains `subscribe`.
  - Routes: a slug with more than one `{{param}}` matches (only the first was converted).
  - A plugin with several elements (`plitzi pack plugin` with more than one folder) draws each of them: every element but
    the main one rendered the main element's component, since all of them load from the one module.
  - `createServer({ allowPrivatePluginHosts })`: a schema plugin may be read from a private address — a development
    machine's bucket on localhost. Off by default: a plugin's address is typed by whoever edits a space.
  - Dev tools: with the panel collapsed, the page scrolls the document as it does in production.
  - The base stylesheet has no invalid declarations: `markdown` fills its box (`height`/`width: 100%` were quoted
    strings the browser dropped), and `text` no longer declares a size it never applied — it still inherits its own.

  ## Twig
  - `starts with`, `ends with`, `//`, `**`, `?:`, `a ? b`, subscripts on array and hash literals.
  - `format` is sprintf: flags, width, padding and precision (`'%02d'`, `'%.2f'`, `'%-8s'`).
  - `date` tokens `D`, `y`, `h`, `g`, `A`, `a`, and `\` to print a character as it is.
  - `inspectTemplate(template)` reports what a template would read past and the names it reads.

  ## CLI
  - With nobody at the terminal (an agent, CI), `create` stops and prints each missing choice — package manager, mode,
    source, and the key for a cloud project — as a question the agent must put to the user, and offers no way around
    it: it used to end with "or with --yes to take the defaults", and agents took that exit instead of asking. `--yes`
    now only answers for a person at a terminal; a script passes the flags.
  - Every project gets `tsx`, so `npm run author` works on a fresh checkout, and `npm run shot -- /path --width 390
--scheme dark` takes a full-page screenshot.
  - The generated visual test skips list rows and providers with no tag.
  - The example plugin takes its props as attributes; in a client project its numbers come from `public/data/stats.json`
    through a provider — the offline-data pattern.

  ## Examples: `browser` and `self-hosting`
  - `examples/` is two folders: `browser` (a space on your page, no server) and `self-hosting` (a server of your own,
    from a server-rendered page to a space's runtime). What a space on the platform does — Ceniza, Tremor, Fieldnotes,
    Pizarra, the server and render actions, a template — is a seeded space on the platform rather than an example here.

  ## A space's visitors: signing in, and what they may do
  - `settings.visitorRoles`: a space declares its visitor roles and what each gives (`{ author: ['postPublish'] }`),
    published and exported with it. `authorSpace` refuses a malformed one; `checkVisitorRoles` / `visitorAccess`
    (`@plitzi/sdk-shared/auth/visitorRoles`) are the one reading of them.
  - `userProvider: 'server'` (`ServerAuthProvider`): a space whose people sign in THROUGH its page server, by redirect —
    the session is a cookie on the space's host; `login` goes out, `logout` asks the server.
  - `createServer({ signIn })`: `GET /auth/sign-in` and its callback — register this host with an OAuth 2.1 authorization
    server, PKCE, state in a `__Host-` cookie, the code redeemed server to server and handed to `exchangeCredential`.
  - OAuth: `issueToken` is told the grant's `redirectUri`; a server mounted under a prefix sends people back to, and posts
    its grant screen to, its own `/authorize` (it resolved `/authorize` against the issuer and dropped the prefix).
  - `safeRedirectTarget` refuses `/\host`, which a browser reads as `//host`.
  - `spaceKvPatterns(spaceId)` (`@plitzi/sdk-server/actions`): every key a space's `kv` holds, to let them all go.
  - Builder: a **Visitors** panel — the space's roles, and who holds them, given by email.

  ## MCP: what the agent is told
  - The guide explains every operation `plitzi_apply` takes — moving and deleting elements, schema variables, design
    tokens and fonts had no word in it — and names every resource the server registers, `plitzi://fonts/{env}` (now
    registered, so it can be discovered), the layouts, the server tasks and the render guide among them. A test fails when
    an operation, a resource or a global source is missing from it.
  - The global binding sources, the transformer names and the data-sources scope note are generated from
    `@plitzi/sdk-authoring`, the catalogs the linter checks a save against. They listed `collection` and `space`, which
    no longer exist, and missed `variables`, `host`, `theme` and `computed`.
  - The guide says what an `apiContainer` publishes in each mode: through a connector `.records`/`.record`/`.pageInfo`,
    with a browser `query` the body under `.data` and the HTTP `.status`; both `.isLoading`, `.isEmpty`, `.hasError`.
  - Server actions have their own section; the tool list names `plitzi_preview`, `plitzi_screenshot` and
    `plitzi_render`; the co-worker prompt lists the layouts, fonts, connectors and actions.
  - The guide's connector examples read a record's fields under `values` (`list_posts.item.values.title`,
    `.record.values.<field>`), which is where the engine puts them; they bound to nothing as written.
  - The `plitzi-render` skill's first example no longer sets the `min-width: 0` its own rules say is unneeded; the
    authoring skill lists `host` and `computed` among the globals.
  - New guides: `docs/en/mcp.md` — connecting an agent, how it works a space, what the server guarantees, what is
    deliberately left open — and `docs/en/connectors.md`, which only existed in Spanish. RFC 0002 is removed now that it
    shipped. The repository READMEs, `claude.md`, onboarding and repository-structure list `apps/mcp`, `apps/cli`,
    `apps/desktop` and `sdk-authoring`, and no longer `sdk-collections`.

  ## Preview a published revision
  - The draft preview takes an optional `revision` (`PreviewRequestBody.revision`, carried by `PreviewClient.render`):
    a published revision of `env` rendered instead of its latest, so a capture can show one exact version — the one a
    reviewer approved rather than whatever was published after. Ignored for `main`; a revision that is not a positive
    integer is a 400.

  ## Builder: the server's reason, not "network not available"
  - A query the server refused shows the server's own message in its toast — "the storage provider refused this CDN's
    credential", "there is no bucket …" — where it used to say "Query … Failed" and, wrongly, "Network Not Available".
    Only a request that got no answer is reported as a network problem.
  - A CDN that cannot be listed says so in its panel, with the reason and a way to choose or fix its credential, instead
    of an empty list that read as "nothing uploaded".
  - Every builder preview renders again — element templates from a CDN, directory items, transformer and AI previews.
    The preview's render-settings scope inherited nothing (a nexus scope is isolated unless `inherit="live"`), so it held
    `render` alone and each element failed with "Element … not found". `useRenderOverride` now says the scope must be
    live, and a test holds it.

  ## Interactions: "Propagate Event" does what it says
  - A click, hover or focus trigger with **Propagate Event** off — the default — now answers the event for the elements
    around it too: a button inside a clickable card runs the button's flow and not the card's as well. It used to decide
    only `preventDefault`, so every clickable ancestor ran its flow after the inner one.
  - The DOM event itself is not stopped: a component's own handler (a dropdown opening from a click inside it), the dev
    tools' element picker and anything listening above the space still receive it. `preventDefault` is unchanged.
  - To keep the old behaviour on one element, turn Propagate Event on for the inner trigger.

  ## Change history
  - Every save of a space's schema and style is recorded by the server — who made it (a person, an agent, the co-worker,
    the autofix), from where, and each element, class, token or font it touched, before and after. Read-only; kept per
    plan. See `docs/en/history.md`.
  - Builder: a **History** panel — the timeline, newest first, with saves folded into rows, each unfolding into a
    field-by-field diff that links to its element; filters by who made it, the selected element, and since the last
    snapshot; each row numbered (`#50`), and each published revision marked right above the last change it includes
    ("Revision 4 · includes up to #50") — `upToSeq` on the snapshot markers `SpaceChanges` returns.
  - `@plitzi/sdk-shared/history`: `diffSchema`, `diffStyle`, `describeChange` (a save as lines: "Added text “hero” to
    page “test”", with the parent's bookkeeping left out), `fieldChanges`, `sameValue`, `jsonCopy` and the
    `SpaceChange` vocabulary; builder query `SpaceChanges` (`TSpaceChanges`, `TSnapshotMarker`).
  - `@plitzi/sdk-mcp`: `saveSchema`/`saveStyle` receive an `SSRWriteContext` (the member, one batch per tool call), and an
    optional `getChanges` adapter serves `plitzi://changes/{env}` and `plitzi://changes/{env}/{id}`.

  ## Kept state: what is never kept, and where keeping is decided
  - New space setting **`transientState`**: top-level `runtime.state` keys that are never kept, even with `keepState` on.
    They are not written, not brought back — an entry kept before a key was declared transient does not restore it —
    and a value one of them holds survives the restore, which lands late (after hydration, once auth settles) and used
    to undo anything set before it. Built on `@plitzi/nexus` 1.3.0's `partializePath`/`mergePath`; every `@plitzi/nexus`
    range here is `^1.3.0`. Covered by
    `e2e/tests/sdk/keptState.spec.ts` across a real reload. For demos, open panels, walkthrough steps: state that must start fresh every visit.
    `authorSpace` refuses a list that is not one, an empty key and a dotted one (naming the top-level key to write), and
    warns `transient-state-without-keep-state` when `keepState` is off. The builder's State Settings has the field, and
    the MCP's `patchSettings` takes it.
  - **A page no longer takes `keepState` / `stateStorage`.** The runtime only ever read them from the space's settings,
    so on a page they promised something nothing did. `authorSpace` refuses them with where they go; reading an older
    document back drops them and reports it.
  - The authoring skill no longer suggests resetting kept state from `onPageLoad` — the restore lands in the middle of
    that flow — and the MCP guide describes `keepState` as what it is: `runtime.state`, not element state.

  ## A step's params keep their type, and a failure can say why
  - **A param is its value's own type, never one guessed from its text.** Step params — the browser's flows and a
    server action's steps alike — were rendered to text and read back as JSON, so a text field holding `1234` reached
    the next step as the number 1234: a password field declared `text` then saw no password at all, and a board's lock
    was REMOVED where one was being set. One resolver now serves both sides (`processTwigParam` in
    `@plitzi/sdk-shared/helpers/twigWrapper`): a param that is one `{{ expression }}` is that expression's value as it
    is; a JSON filter alone (`{{ saved|json_encode }}`) is the value it encodes; text around the tokens is JSON only
    when it makes an object or array document, and otherwise text. Converting is left to whoever declares a type —
    `setState`'s `type`, an action's input fields — which already did. **Behaviour change:** a template that renders a
    number-looking string now hands on the string (`'{{ flag ? "1" : "" }}'` is `'1'`, not `1`).
  - **A failed server action can tell the page why.** A step's own error message still never leaves the server — it
    can hold a query or a credential's name — but a task may now throw **`ActionRefusal`** (from
    `@plitzi/sdk-server/actions`) with a message written for the person on the page, and `flow.fail` takes
    **`tellCaller`**. The run answers `status: 'failed'` with that message as `error` (in a stream's last frame too),
    and `runServerAction` hands it to the flow as `{{ step.error }}` — as it now also does for a refusal before the run
    began. The step's preview lists `reason` and `error`, so the builder offers them.
  - **One resolver for a step's params, in the browser and on the server** (`resolveStepParam`). The server only
    resolved what `hasValidToken` calls a token, so a param written as a condition or an object literal
    (`{{ { "id": run.id }|json_encode }}`) reached its task as the template text — an action's `output` built that way
    failed with "not valid JSON". Both sides now run any template syntax, keep the value's type, and read a value that
    is itself a template again up to the same ceiling.
  - **Fixed: a value with a quote or a line break broke a param written as a JSON document.**
    `{ "city": "{{ values.city }}" }` gave the step its raw text instead of the document when a visitor typed `Say "hi"`
    or pressed Enter. A value printed inside one of the document's string literals is now escaped for it; a value
    printed outside them is printed as before — it IS the JSON value there.
  - **`when` around a step that already has a `when` adds to it.** It used to replace the inner condition, so the step
    ran whenever the outer one held and nothing said so. Two `and` groups become one; otherwise both are kept, nested.
  - The schedules example's first-paint test assumed the digest was less than a day away, and failed at weekends.

  ## A page with many elements keeps its frame rate
  - **`useEventBridge` stopped re-subscribing on every render.** Its `callbacks` and `params` defaulted to `= {}` in the
    signature — a new object each render, and both are the effect's dependencies — so every element on a page (each
    subscribes through `withElement`) took its subscription off and put it back on every render it went through.
  - **`EventBridge.off` is constant time.** Whether a module had events left was a `for…in` over its keys, which still
    enumerates all of them on an object that constant deletions have turned into a dictionary: N elements
    re-subscribing cost N × N. A count per module replaces it. `EventBridgeProps.events` is typed as the bridge holds
    it — only the modules and events that have a listener — and the package has tests now.
  - **A flow reads a space's computed values once per change, not once per step.** `liveSources` evaluated every
    computed value before every step and every `when`; it now keeps the last evaluation and reuses it over the same
    snapshots of the state and the global sources.
  - **An element subscribes to the paths it reads, not to the sources they are in.** A binding on `computed.tool`
    rendered its element again whenever any computed value changed — on a board, the tool in hand changing was the
    whole page drawn again. Bindings, `when` rules and attribute templates now subscribe to each path they name
    (`templatePaths` in `@plitzi/sdk-shared/helpers/twigWrapper`). **Fixed** on the way: a binding whose template also
    read another source (`{{ theme.resolved }}` beside the bound value) and a binding shown while a `when` held were
    never told those changed.
  - **A computed value that comes out the same keeps its object.** Every computed value is evaluated again whenever the
    state changes, and a list or a record came out a new object each time, so every element reading one rendered again
    for a change to something else: on Pizarra, the elements library's hundred and sixty stars reading the favourites.
    `evaluateComputed` takes the previous evaluation and keeps each value that is deep-equal to it, and the whole when
    none changed. Switching tools there rendered 1,375 elements; it renders 19. Drawing a shape: 2,833 → 129.
  - **A step that finishes synchronously hands over to the next at once.** Every step used to wait a microtask, so a
    flow of synchronous steps rendered once per step; React now batches them into one.
  - Measured on Pizarra with 300 notes and a marquee over all of them: from 27 frames over 50 ms (the worst 330 ms,
    React's development build) to 60 fps with one 88 ms frame when the selection panels mount (production build).
  - **A test can count what an interaction renders.** `inspectRenders(page, act, { max })` in
    `@plitzi/sdk-authoring` answers every element that rendered, how often, what changed for it and which store paths
    were written; over `max`, `problems` names the elements that rendered most. It reads the render tracing the SDK
    already keeps under `debugMode`, now published as `window.plitziTracing` while it is on (`TracingReader` in
    `@plitzi/sdk-shared/store/tracing`: `lastCommitId`, `commitsSince`). The skill's new `performance` reference says
    what makes an element render, what a flow costs and where to look when something is slow.
  - **`pressShortcut(page, 'mod+z')`** presses a shortcut written as `onKey` writes it, with the keys the PAGE listens
    for: `mod` from its user agent. A driver's "Control or Meta" asks the machine running the suite, so a Mac driving an
    emulated desktop Chrome pressed ⌘ at a page listening for Ctrl.

  ## Conditions, and what authoring catches
  - **Behaviour change: a visibility, once its data answers, is a yes or a no.** A value written to `visibility` by a
    binding is now read the way `not` reads it — `false`, `0`, an empty text, an empty list are a no — and a no is
    written too. Before, only a truthy value was written, so an element shown once stayed shown when its condition came
    back empty, and a template that printed `0` showed it. A condition's template no longer needs `? 'true' : 'false'`:
    `{{ source is defined and source is empty }}` is enough. A source that has not answered yet still leaves the element
    as it starts, so a flag nobody has set keeps what it controls on screen, as spaces rely on.
  - **New warning `form-value-compared-to-blank`.** A `when` asking whether a submitted field (`….values.x`) `=` or
    `!=` `""`: a field nobody typed in is not in `values` at all, so it never matches. The warning names
    `operator: 'empty'` / `'notEmpty'`, which take a missing value and `""` alike.
  - A `when` with `isBinding` comparing a computed value with a path from the trigger is pinned by a test.
  - The examples write their conditions without `? 'true' : 'false'` — a flag is `visible: 'computed.presenter'`, its
    inverse `'!computed.hasFrames'`, a condition its own expression — and author with no warning: Pizarra's chat no
    longer sends an empty line (`notEmpty`, which the new warning found), and the blog's sidebar stops sticking on
    phones (`tablet-rule-skips-mobile`).

  ## Builds and caches
  - **`apps/sdk`'s production build no longer deletes the vendor bundles.** `emptyOutDir` emptied `dist`, where
    `vite.vendor.config.ts` builds React and its kin: a production build left pages whose script 302'd to HTML. The build
    now empties what it made and leaves the vendor files.
  - **A cached plugin is rebuilt when its source changed, whatever its version says.** The plugin manager records a
    content digest of every file a bundle was built from and compares it when a process first finds the bundle — in
    production as in development. A deployment rebuilt from new source under the same version used to serve the
    previous bundle. Bundles cached before this are built once more.
  - **A space's plugins are kept by what they are, not by their name and version.** The page server kept every plugin a
    render named — a space's external plugins, a deployment's `pluginSources` — under `name@version`, and the first
    source to arrive held that key while the process ran: a plugin published again under the same version was served
    from its old, missing URLs until a restart, and two spaces each with a `board@1.0.0` of their own were both served
    whichever the process had met first. The key now carries the source's identity (`name@version+<digest>` of where
    its files are, how they are served and its props); invalidating a release covers those keys too, and a plugin named
    by a render never answers for a bare name, which stays the plugins the server was set up with.
  - **The examples are linted** with the packages' rules (`examples/eslint.config.mjs`, a `lint` script in each), and
    what the rules found is fixed — among it, index reads the types called defined, a hook-named step helper, and the
    Permissions API assumed present. `docs/` and the skills' markdown are hand-wrapped and listed in `.prettierignore`.

  ## Kept state the first paint shows is drawn by the server
  - Kept state lives in web storage, which only the browser reads, and is restored after hydration — so anything kept
    that changes what is DRAWN (the tool a toolbar shows as last picked, a name in an avatar, a panel left off) was
    painted with the space's defaults and swapped a moment later. New space setting **`paintedState`**: the kept keys the
    first paint shows. They are written to a cookie as well (`plitzi_<webId>_painted`, with the port in the name as the
    debug cookie has it); `prepareRender` reads it, renders with the declared keys only and hands the page the same
    values as its starting `runtime.state` (the SDK's `state`), so it hydrates onto them and nothing is swapped. The HTML
    cache is keyed by that cookie. `e2e/tests/server/ssr/paintedState.spec.ts` checks the raw HTML and the hydration.
  - The cookie carries its owner, like the kept entry in web storage: the server cannot tell whose it is for a space with
    its own sign-in, so once auth has settled the page drops what it rendered with from somebody else's cookie, and an
    account change no longer returns to them. Over 3 KB it is not written (the dev tools say so), and the stale one is
    removed.
  - `authorSpace` checks it like `transientState` — a list of top-level keys — refuses a key that is both painted and
    transient, and warns `painted-state-without-keep-state`. The builder's State Settings, the MCP's `patchSettings`
    (validated the same way), its guide, the authoring skill and `docs/en/authoring-spaces.md` describe it.
  - One cookie reader for both halves of the SDK (`cookieFromHeader` in `@plitzi/sdk-shared/helpers/cookies`), which the
    theme cookie now uses as well.

  ## Testing an authored space: one call, every problem
  - **`inspectPage(page, handles, options?)`** (`@plitzi/sdk-authoring`): the open page, checked whole — every element it
    owes present and visible (its own and those of the layouts around it), images arrived, nothing scrolling sideways, no
    text in the colour painted behind it. Returns every problem at once, each naming the element and why
    (`display:none on "panel"`), and retries like an assertion. Driver-agnostic (anything with `evaluate`), no new
    dependency. `inspectDocument(page)` runs the page half for a page whose space is not in hand.
  - `onScreen(handles, page, { elements, ignore })`: what a freshly opened page owes. Page handles carry their `layout`,
    layout handles theirs.
  - `singlePageSpace(body, space?)` and `withElement(spec, id, patch)`: a one-page space, and the same space with one
    element changed — on the SPEC, so a variant is validated like any space.
  - `authorSpace(spec, { allow: [{ code, element, why }] })`: a fixture that breaks a check on purpose names that break.
    It comes back in `warnings` with the reason; an entry that matches nothing is refused.
  - Fixed: `defineAction` with several triggers chained them one after another, so a run through the first executed the
    second as a step. Every way in now heads the same chain.
  - Fixed: `provider-without-source` warned on a provider that names a `connector`.
  - The image element says when it drew its fallback: `data-plitzi-failed="<src>"`. The fallback loads, so to a browser
    a broken image looked loaded. The fallback is now state, keyed by the source: a new `src` gets its own attempt.
  - The CLI's generated visual test uses `inspectPage`.
  - The sample space (`examples/shared-space`) no longer sizes itself by the window: embedded beside a host's sidebar
    (`03-react-component`) it overflowed by the sidebar's width. Its RSC section is named `rsc-section`.

  ## A page server that starts in less memory
  - `sdk-shared` imports date-fns one function per subpath, and its locales one by one: `from 'date-fns'` loaded all
    826 of its modules (and `date-fns/locale` every language) wherever the date helpers were imported, which is on every
    page server — the largest single cost of starting at all.
  - `isDate(value, format)` moved to `@plitzi/sdk-shared/helpers/isDate` (still exported from `@plitzi/sdk-shared/helpers`):
    it needs date-fns `parse`, which alone costs about 100 MB, and nothing that only formats dates should load it. It is
    no longer exported from `helpers/formatDate`.
  - Needs `@plitzi/plitzi-ui` with the same fix in its `formatDate` (the QueryBuilder evaluator a server loads imported
    date-fns whole, and `parse` for one fixed format). Measured on the SSR example: resident memory at rest 308 → 177 MB.
  - Everything a page runs is in `plitzi-sdk.js` again, with no `withElement-<hash>.js` or `rolldown-runtime-<hash>.js`
    beside it. The plugin loader's dynamic imports split a chunk off, which every host serving the SDK by name had to
    know about. The vendor build has `codeSplitting: false`; the SDK's keeps every module its entry reaches statically in
    the entry (see "A lighter SDK" for the one chunk it does split).

  ## A page server that fits in half a CPU and 256 MB
  - **Fixed: a page server leaked on every request until it ran out of memory.** The auth/deployment middleware chain
    was rebuilt per request, and `basicAuthMiddleware` starts a credential cache with a sweep timer — each request left
    one behind that its timer kept alive for good (about a kilobyte a request; a 256 MB container died after a few
    hundred thousand). The chain is built once per server, and the credential cache finally caches.
  - **A cached page is compressed once.** The render cache keeps the Brotli and gzip bodies beside the HTML, so a hit is
    a copy instead of a compression — which was 87% of a hit's CPU. `res.send(body, { compressed })` takes the store to
    fill; `CompressedBodies` and the cache's `CachedPage` are exported.
  - **Log levels: `logLevel` (`silent` < `error` < `warn` < `info` < `debug`).** One threshold for everything a server
    says, process-wide. Default `error` — in production only what went wrong is written — and `info` with `devMode`.
    - Requests below the threshold are not turned into events; a 5xx or a request that threw is an `error`, the rest
      `info`. A refused action is a `warn`, a run that did not complete an `error`.
    - The server's own lines (`listening on`, plugin builds, manifest fetches, failures in adapters, RSC, actions, auth
      flows) are `kind: 'message'` events on the same `logger`, where they used to go straight to the console. With
      no `logger` they still go to the console.
    - The dev metrics line is `debug`.
    - `serverLog` (`error`/`warn`/`info`/`debug`/`enabled`/`emit`), `logLevelOf` and `isLogged` are exported.
      `createRunLogger`/`createRejectLogger` are held to the same threshold.
  - **`createJsonAdapters` parses a file once per version of it**, not once per request (a tenth of a render's CPU on a
    real space). A file edited by hand is read again by its mtime and size; a save drops the copy it replaced. Every
    request shares the parsed space, as they already did with `createCloudAdapters`.
  - A server with `devMode` off that runs without `NODE_ENV=production` says so once, at `error`: React chose its
    development build from `NODE_ENV` when it was imported, and renders about 40% fewer pages a second with it. The
    README no longer claims `devMode` defaults from `NODE_ENV` — it defaults to off.
  - `@plitzi/sdk-server` and `@plitzi/sdk-mcp` no longer bake `process.env.NODE_ENV` in at build time. The published
    build always read `"production"`, whatever the process was started with; a server reads it from its process now.

  ## Static files compressed, and compressed once
  - **Fixed: static files went out uncompressed.** Every body sent as a `Buffer` skips compression (the rule that
    keeps fonts and images intact), and static files were read as Buffers — so the SDK bundle, its vendor and its
    stylesheet travelled whole: 2.7 MB, 1 MB and 220 KB on a first visit. Text files (scripts, stylesheets, JSON, SVG,
    plain text) are compressed now; images and fonts still go out as the bytes on disk.
  - Each is compressed once per version of the file and kept, within 16 MB, least recently served first out — and read
    from disk only when an encoding it has not been compressed to yet is asked for. `res.send` takes a function for such a
    body: `send(() => read(), { compressed })` reads it only when the stored form is missing.
  - **Two Brotli qualities.** `compression.brotliQuality` (default 2, was 4) is for a body compressed on every request;
    `compression.keptBrotliQuality` (default 6) for one compressed once and kept — a cached page, a static file. Measured
    on a quarter core: 4 cost a tenth of the pages a second to save half a kilobyte each; 6 makes the SDK bundle 10%
    smaller than 4 for the same memory, where 9 needs ~40 MB more than a 128 MB server has.
  - The space embedded in a rendered page is serialized once per space object instead of on every render — a tenth of a
    render's CPU spent producing the same string.
  - `sdk-shared`: the dev-tools console no longer keeps logs on a server, where nobody could ever receive them and they
    held other visitors' state; and stamps a log by hand instead of through date-fns. A page renders ~25% faster on a
    quarter core with both.
  - Examples: the servers take `HOST` (still loopback by default) and derive `devMode` from `NODE_ENV` — a copy of an
    example run in production no longer runs in development mode.
  - `bench/` (private): load and footprint benchmarks of the self-hosted servers under hardware profiles, with
    baselines — `yarn bench`, see its README.

  ## Self-hosted servers run compiled, without a transpiler
  - **`plitzi create` (server mode) runs on Node alone.** `start` is `node src/main.ts` — Node 22.18+ strips the types
    itself — and `tsx` is gone: its loader thread cost a page server more memory than the server, ~270 MB to start where
    the same server starts in ~90. For production, `build` (`tsc -p tsconfig.build.json`) emits `dist/` and `start:prod`
    runs `node dist/main.js`: stripping types keeps a TypeScript transformer in the process for its whole life (~10 MB),
    compiled JavaScript does not. The project's `tsconfig` holds the code to what stripping needs
    (`allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), `engines` says `>=22.18`, relative
    imports name their `.ts` file, the plugin path resolves from the project root (the same from `src/` and `dist/`),
    and the server listens on `HOST` (loopback by default).
  - The examples run the same way: `node src/main.ts`, `node --watch-path=./src` while editing, no `tsx`.
  - `@plitzi/nexus` 1.3.1, now required (`^1.3.1`) by every package that uses it: `useStore` runs one set of hooks for a
    single path and a list of paths, instead of both side by side with the idle one disabled (a page allocates about a
    quarter less to render); `useStoreGetter` reads a function entry from the latest render instead of an earlier
    closure with the same source; and the path caches no longer evict every path of a page of a few hundred elements
    just before reading it again.
  - `bench/`: `cli-server` measures a project as `plitzi create` writes it, built and run with `start:prod`; portals are
    mounted into the container and recorded in every result; `edge-96` and `edge-64` probe the floor.
  - `sdk-elements`: an element that binds nothing no longer resolves bindings on every render, and one whose attributes
    hold no template no longer builds template data and copies its attributes to interpolate none — the work every
    element of a page did on each render, for nothing, however few of them bind or template.
  - `bench/`: the memory probe is compiled to JavaScript before a run (loaded as TypeScript, it put Node's type stripper
    into every server measured, ~10 MB counted as the server's); `--repeat N` starts a target cold N times and keeps
    each phase's median run, since on Apple silicon a container runs on a fast or a slow core for its whole life.

  ## A page server on every core
  - **`workers`: one process per core.** Node renders on one thread, so a server used one core however many the
    machine had. `workers: 'auto' | <n> | false` (and `SDK_SERVER_WORKERS`) runs the server in that many processes on
    one port; `'auto'` is the default under `NODE_ENV=production`, one process anywhere else. The count follows the
    cores the process may use — a container's CPU quota included — and a number above them is lowered, with a warning.
    One process (workers off, one asked for, one core) is the server exactly as before: nothing forked, nothing wrapped.
  - **The workers are one server.** The in-memory defaults — an action's `kv`, the job queue, draft previews, the
    sign-in rate limit — are kept once, by the process that was started, and every worker reaches the same copy over
    the cluster channel; a store the deployment supplies is used as it is. The scheduler and the job consumers run in
    one worker. `server.cache.invalidate()`, `server.plugins.register()` and `server.plugins.invalidate()` reach every
    worker. Plugins are built once, before the workers start, and their files are written atomically (a temporary file
    renamed over the target), so no process reads a half-written one.
  - **A worker that dies is replaced**, and takes its jobs with it to the replacement. Past one death per worker a minute
    the replacements wait longer each time (half a second, doubling, up to thirty), so a crash on every request is not a
    fork loop; a replacement that cannot start is retried while the others keep serving. A worker that dies before any
    has served stops the server with a non-zero exit, and a server killed outright takes its workers with it.
  - **Fixed: `server.cache.invalidate({ spaceId | environment | hostname })` matched nothing.** It read the page cache's
    key by positions it no longer had once the key gained the visitor's token, theme and dev-tools choice in front; a
    publish webhook that invalidated a space cleared no page. The key is now read by the same list that writes it.
  - `PluginManager.forget(name?, version?)` drops what a process remembers of a plugin and leaves the files: what an
    invalidation in another worker does.

  ## Fewer silent failures, less friction for an agent
  - **New lint warnings**, each with the fix in its message, held by `authorSpace`, the builder's problems list, the
    publish gate and the MCP server alike:
    - `server-data-without-rsc`: a `runtime: 'server'` provider with a `connector` or `action` in a space that does not
      turn server data on — it rendered its mock data and nothing said why. Add `rsc: { enabled: true }`.
    - `route-param-undeclared`: `navigation.routeParams.x` read on a page whose slug has no `:x` — always empty. Prose
      elements that only mention one are not read.
    - `form-control-unnamed` / `form-control-name-taken`: a control in a form with no `name` never reached the form's
      values, and two with one name wrote over each other.
    - `overlay-never-opened`: a modal or dialog that starts hidden and that no step opens.
  - **New lint error `list-items-ignored`** (fixable): a `list` with items (bound or written) and a `source` other than
    `'controlled'` rendered its children once and never read them — one empty row where the rows should be. `fixSpace`
    sets `source: 'controlled'`. It found the Feature Lab seed's catalogue rendering one blank card.
  - **The page server logs a plugin it has nothing for**: a `custom` element whose `renderType` has neither a component
    in the render nor a bundle for the browser is reported at `error`, once per space and type, naming the element and
    `plugins` + the deployment's `pluginNames`. It used to render "Custom Component … Not Found" and say nothing.
  - **A `webHook` that writes with an empty body sends `{}`**, not the JSON text `""` a JSON endpoint refuses with a 400.
  - **`webHook` takes `headers`** (by name; a template per value): an API key, an `Accept`, an idempotency key.
    `Authorization` stays `authorizationToken`'s and the content type follows the body, so neither can be named twice.
    Headers are part of what a cached read is keyed by.
  - **Fixed: a `webHook` sending a file could not be read by any server.** It set `multipart/form-data` by hand, without
    the boundary the parts are split by; `fetch` writes the type itself now.
  - `sdk-authoring`: **`setFieldValue(target, name, value)`**, the step that fills one field of a form — clearing a code
    field after a failed attempt, prefilling one from a binding.
  - **Fixed: a step parameter like `"012345"` reached the step as the number `12345`.** A value is read as a number only
    when it reads back as the same text; a code, a postcode or an id with leading zeros stays text.
  - `fixSpace(space, catalogs, codes, elements)`: `elements` narrows the fixes to some elements. It now clones only the
    elements it changes, and with nothing to fix answers the schema it was handed.
  - **MCP `plitzi_apply` / `plitzi_validate`:**
    - What was already wrong with an element a batch changes is fixed on the way, where it has one reading, and every
      fix is said in `warnings`. The fixes run on the space before the batch, so the batch's own mistakes are still
      refused.
    - An old issue is told from a new one by its code on its element, not only by its message, so a page rename or a
      changed suggestion no longer makes an old issue on an untouched element look new and block the batch. One more
      of an issue than before is still the batch's.
    - The space as it was is read only when the result has something to classify: ~15% less time a batch on the
      largest spaces.

  ## A server-rendered page carries its stylesheet once, and its data as JSON
  - **The compiled stylesheet no longer travels twice.** The runtime `<style>` a page renders already holds
    `style.cache`, verbatim, and the hydration payload carried it again. The server now leaves it out
    (`styleCacheInDocument: true` in the payload) whenever the page gives it back byte for byte — no `{{ token }}`, no
    `<`, no `\r` or `\0` — and `render()` reads it back from that `<style>` before hydrating, so the browser draws the
    same stylesheet and the store holds the same cache. The cache sits between two CSS comments in the stylesheet it was
    always in: the element, its place in the tree and the cascade are unchanged. `plitzi.com`'s home: 2.82 → 2.53 MB,
    350 → 313 KB with per-request Brotli.
  - **The payload is a `<script type="application/json">` block**, parsed with `JSON.parse` and removed once read,
    instead of a JavaScript literal inside the bootstrap module. On a first load of that page Chromium parses it in
    6.7 ms instead of 15.4 ms; the page no longer holds the space twice.
  - `sdk-shared/style`: `markStyleCache`, `styleCacheTravelsInDocument`, `styleCacheFromDocument`, `RUNTIME_STYLE_ID`.

  ## The account console, and telling devices apart
  - **`auth.plitzi.*/account` is an account console**, no longer a column beside the sign-in's brand pane: identity along
    the top, sections down the side (tabs on a phone) — **Profile** (username, and email changed through a link to the
    new address), **Security** (password, and closing the account), **Devices**, **Connections**.
  - **Devices are listed by device, not by session.** `GET /devices/sessions` groups sessions by what they were created
    from and answers this device apart; a browser that signed in forty times is one row saying "40 sessions". The list
    had shipped and drawn every session — 1,218 for one account a test suite signs in as — inside a box that scrolled.
  - **Every device is named for what it is**: the application as it registered over OAuth (`Plitzi CLI on carlos-mbp`,
    `Plitzi Desktop on studio`), a browser and its system, an automated client (Playwright, headless Chrome) — never a
    raw user agent. Sessions record their address and **when they were last used** (at most every five minutes, on the
    lookup a request already makes). A sign-in deletes the account's dead sessions.
  - **AI connectors are one per application**: Claude and ChatGPT granted the same space are two connectors, each named
    and disconnected on its own (`GET /devices/connectors`).
  - `sdk-server`: **`issueToken(user, target, context)`** — the OAuth layer tells a deployment which application a
    credential is for (`client_name`, `software_id` kept from registration), the request it is issued on, and on a
    renewal the credential it **replaces**, so a native client renewing daily stays one session. **`revokeToken`**, new
    and optional: `/revoke` now ends what the grant issued, not only its renewal — signing the CLI or the desktop app out
    removes it from the device list at once. Sessions carry `app` and `lastActiveAt` (`SessionApp`,
    `SESSION_ACTIVITY_RESOLUTION_SECONDS`, `activityDue`); the MySQL store migrates to schema step 4. The session's
    address is recorded (Express `req.ip`, or the proxies' headers); `SSRRequest.ip`.
  - `sdk-server`: **`deletionBlockers(userId)`** — an account is refused deletion (409, with the list) while it owns
    something that would be lost with it. `plitzi-sdk-server` refuses while it is the only owner of a workspace holding
    spaces, other members or a live plan; an empty personal workspace is deleted with the account.
  - **Fixed: a flow's `navigate` to a page in a folder went to the wrong address** — `/security` for `/account/security`,
    and the home page for a folder's index page. It resolves the page's full path now, as a link does
    (`navigationTarget` in `sdk-shared/navigation`).
  - **Fixed: changing your email sent a mail with no body** (the `email-change` template did not exist) and a link to no
    page. It has both now (`/confirm-email` in the auth space).
  - **Fixed: account emails interpolated values unescaped** — a username with markup in it arrived as markup in a mail
    sent from Plitzi.
  - The visual suite signs every test's session out when it ends; it had left over a thousand on one account a day.

  ## Two-step sign-in
  - **An account can turn on a second step** (an authenticator app, TOTP) from Security in the account console: a QR
    code drawn by the server, the key to type by hand, one code to confirm it works, and ten recovery codes shown once.
    Turning it off asks for the password. `GET /account/mfa/setup` answers the QR of an enrolment in progress, never of
    one already confirmed, and is never cached. The secret is encrypted at rest (`user_mfa`) and recovery codes are kept
    as digests, each good once.
  - **Signing in then asks for the code** on its own page (`/two-factor` in the auth space), which takes a recovery code
    as well. `sdk-auth`: a login answered with `mfaRequired` is a **`MfaChallenge`** (`{ ok: false, reason: 'mfa',
mfaToken }`), not a session — the provider read it as one and ended signed out. The space names where the code is
    sent with **`mfaUrl`**; the `auth.login` step's mode **`'mfa'`** sends `{ mfaToken, code }` there.
  - **Fixed: an AI connector ended from the account console came back.** Ending it — one connector, "sign out everywhere
    else", or the space's own credentials — deleted its row, and the host's next renewal put the row back. A renewal of
    a connector that has been ended now ends too (`invalid_grant`).
  - **Fixed: a new account made by signing in with GitHub or Google could not use its session.** It was created active
    but not verified — the column's default — and an unverified account holds no session, so every request after the
    sign-up answered 401. The provider verified the address, so the account is created verified; a migration verifies
    the accounts already created that way. The credential exchange made accounts the same way and is fixed with it.
  - **Fixed: a code could sign in twice.** A TOTP code is valid for its whole window, and nothing remembered that one had
    been used: seen over a shoulder or lifted by a phishing page, it opened a second session within that window. The
    step of the last code accepted is kept (`MfaRecord.lastUsedStep`; `totpStep(secret, code)` in `sdk-server/auth`
    says which step a code matched) and nothing up to it is taken again — the code that confirms the enrolment
    included (RFC 6238 §5.2). The MySQL store migrates to schema step 5 (`account_mfa.last_used_step`).
  - **Fixed: an account with a second factor was locked out by signing in often.** A right password answered with a
    challenge was not reported as a success, so the sign-in limit counted it as a failure (ten in five minutes).
  - `sdk-server`: a numeric field in an `/auth` body is read as its text (a code typed into a number field was dropped
    as missing).
  - **Fixed: signing out of the auth space could loop between two pages** (over a thousand navigations in six seconds):
    for a moment the session published to the page was still the one the provider had just ended. Once the provider says
    nobody is signed in, the page is told nobody is (`publishedSession`).
  - Builder: the space's provider settings take **`mfaUrl`** and **`sessionExchangeUrl`**; both could only be set from
    code.

  ## Requests from other sites
  - **Fixed: any website could act as a signed-in person against the api and server roles.** CORS answered every origin
    with `Access-Control-Allow-Credentials`, and the session cookie is `SameSite=None`: a page the person visited could
    read their account and write to it. Credentialed CORS is now for `PLATFORM_ORIGINS` only; every other origin is
    still answered, without the person's cookies. A published site calling its own space is unaffected — it presents
    its space credential, and a customer domain's sign-in exchange is served by its own page server, same-origin.
  - **A write carried by a session cookie from another site is refused** (403, `reason: 'foreign'`), judged by Fetch
    Metadata and the exact `Origin`: CORS keeps another site from reading, but a plain form POST needs no preflight.
    Platform origins pass, and so do the origins the request's space credential declares. Bearer requests carry no
    victim's cookie and are never asked. `sdk-server`: **`createOriginGuardMiddleware(csrf, { allowedFor, exempt,
errorKey })`** and `csrf.crossSite(carrier, alsoAllowed?)`; `plitzi-sdk-server` runs it on both roles and refuses
    to start with CSRF switched off.
  - **Analytics beacons are sent as text** (`text/plain`), which the collector reads as JSON. A beacon always goes with
    credentials, and a JSON one is preflighted: from a customer's domain it would have been refused with the rule above.
    As text it needs no preflight. **Fixed:** the `fetch` fallback (a batch over the beacon's size) arrived empty — in
    `no-cors` the browser sends text whatever the header says, and the collector did not read it.
  - **Fixed: the CSRF middleware answered 500 on Node 24.** It built its carrier by spreading the request, and `headers`
    there is a getter on the prototype that a spread does not copy. The carrier is built field by field (`carrierOf`).

  ## Plugins from the CLI
  - **`plitzi add plugin [names...]`** adds elements of your own to the project you are in — one, several at once, or one
    at a time as the need comes. It asks what to call each, what the builder shows and what it is for, checks every folder
    is free before writing any, and writes a folder per element the way `@plitzi/sdk-elements` writes its own:
    the component, `declaration.ts` (its `type`, the `triggers` it fires, the `callbacks` it answers to and the element
    the builder adds — data only), `Settings.tsx` (its builder panel) and `index.ts`
    (`Object.assign(Component, declaration, { pluginSettings: Settings })`). Each kind of project is answered as itself:
    - a project `plitzi create` wrote gets it in `src/plugins`, registered by itself (`start:dev` restarts onto it); when
      its space lives in Plitzi, it is told to place it in the builder;
    - a project from before plugins were found by folder is told the exact line its `src/main.ts` list needs;
    - a plugin package gets it in `src/` and in `src/elements.ts` / `src/declarations.ts` — rewritten only while they are
      still the lists the CLI wrote;
    - any other project is asked for the folder (`--dir`) and told how to register it for `render()`,
      `<PlitziSdk.Plugin>` and a page server.
      A name that would make a built-in element's type (`button`, `form`) is refused.
  - **`plitzi create [directory] --plugin`** writes a plugin package: its elements, a Vite preview that renders them
    inside a space, and a visual test of each. A package holds as many elements as it needs (`--elements
legend,price-tag`, or asked): the first is published as the plugin, the rest as its `plugins`. It builds nothing
    itself — no bundler config, no build dependency — since `plitzi pack plugin` is the one place a plugin is built.
    It ships its source (a page server compiles an element from it) and exports `elements` for a project registering
    them itself. `--name`, `--title`, `--description` and `--owner` answer what it otherwise asks; inside a repository it
    offers the folders that repository keeps its packages in, installs with its package manager and leaves its install
    settings alone. It replaces the `plitzi-plugin-template` repository, which is deprecated.
  - **`plitzi pack plugin [folders...]`** builds a plugin — a package's elements, or element folders of any project, a
    self-hosted one included: one ES module (esbuild; React and the SDK kept out for the page to provide, images and
    fonts kept in, since a page imports it from a blob URL), `plugin-manifest.json` written from the elements'
    declarations with each file's integrity hash, and the zip the builder takes under Resources — checked against how
    the upload and the builder read it. A package also gets its type declarations, written with its own TypeScript. A
    declaration missing what the manifest needs is refused by name.
  - **`plitzi login`, `logout`, `whoami`, `space` and `upload plugin`.** The CLI signs in the way the desktop app does:
    in the browser, through the platform's native OAuth (loopback redirect, PKCE), keeping the session and a refresh
    token in `~/.config/plitzi/connection.json` (0600), renewed on its own and revoked on `logout`. It is connected to
    **one space at a time**, chosen on the grant screen (`plitzi space`, the `space` scope) — choosing again replaces the
    connection and revokes the one before, and no command takes a space of its own. `upload plugin` puts the zip
    `pack plugin` left on one of that space's CDNs and installs it, signing in or choosing the space in the browser
    first when either is missing. Every builder open on the space loads the new version on the spot.
  - `sdk-server`: `grantTargets(user, { scope })` — the grant screen offers what the scope a client asked with chooses
    among — and the token response carries the chosen `target` (RFC 6749 §5.1), on renewal too, so a native client knows
    what it was granted.
  - `plitzi-sdk-server`: the native sign-in offers the person's spaces to a client asking with the `space` scope, and
    re-checks access to the chosen one whenever it issues a session — a refresh after losing access ends the grant.
    `GET /spaces/:id/cdns` lists a space's CDNs (never their credentials) and `POST /spaces/:id/cdns/:identifier/plugins`
    takes a plugin's zip, uploads it the way the builder does (one `uploadResource` now serves both) and installs it on
    `main`, keeping the settings of a plugin already there; the change is recorded in the space's history as the person's.
  - **Plugins change live in every builder open on the space.** Adding, updating or removing one — from a builder, or
    from `plitzi upload plugin` with none open — is announced on the space's one channel (Redis pub/sub and the GraphQL
    subscription every other edit travels on), as `SPACE_ADD_PLUGIN`, `SPACE_UPDATE_PLUGIN` and `SPACE_REMOVE_PLUGIN`.
    The other builders load, swap or drop it, its sub-plugins and its stylesheet included; the builder that made the
    change does not apply it twice.
  - **Fixed: a plugin's settings could not be saved.** `SpaceUpdatePlugin` required the plugin's address and wrote the
    settings empty every time. Both are optional now and what is not sent is kept; settings that are not an object, or
    a plugin the space does not have, are refused.
  - **Fixed: a plugin uploaded from Windows was refused** ("Type file not supported"). Chrome and Edge on Windows send a
    zip as `application/x-zip-compressed`, and both the builder and the upload accepted only `application/zip`.
  - **A project `plitzi create` writes registers every folder of `src/plugins` by itself**, under its name in camelCase
    — `readdirSync` in server mode, `import.meta.glob` in client mode — so a new element needs no line of `src/main.ts`.
  - **A new project is formatted by its own Prettier** once installed, so the first commit is already in its style. Only
    into a folder that was empty: `--force` never reformats work that was there.
  - `sdk-shared` / `plitzi-sdk`: **`PluginDeclaration`**, the declaration type of an element of somebody's own — what
    `ElementDeclarationData` says of any element, plus the `content` a manifest publishes. Exported as a type from
    `@plitzi/plitzi-sdk`.
  - **Fixed: a plugin on its own host rendered "Not Found".** `fetchManifest` sent `Content-Type` on a GET, which made the
    browser ask the host's permission first; a host that allows plain cross-origin reads — the usual CORS setting of a
    bucket — refused, and the element never loaded. It asks with `Accept` now, and answers nothing for a 404 rather than
    for a body that failed to parse.
  - `sdk-authoring`: `blankSpaceSource({ plugin: { as: 'element' } })` hosts a plugin as an element of its own type — how
    the builder adds one and how a space loading it from its manifest renders it, and takes a list to host several.
    Strings in the copy are quoted the way
    Prettier quotes them (`"Today's"`, not `'Today\'s'`), and a name with a backslash no longer breaks the file.
  - e2e: `plugin-server` generates a package with the CLI, builds it, publishes it on a host of its own and checks a page
    loads it from its manifest.

  ## Export as code: spaces from an older builder
  - `sdk-authoring`: **`specFromSpace` reads a document an older builder keyed by ObjectId.** Before an element's id was
    its name, `flat` was keyed by a Mongo ObjectId and the name lived in `idRef`; reading one kept the ObjectId, and
    `authorSpace` refused it ("not one a binding, a template or a test can name"), so the builder's Export failed on
    every such space. Each element takes its `idRef` back as its id — a positional `<type>-<n>` where it has none and
    its key is not a valid id — with every reference repointed, and the rename is reported as `legacy-element-id`.
    `withNamedIds` is exported so a caller comparing what it read compares it under the same names.
  - `sdk-authoring`: a space with no pages is refused up front with a reason a person can act on, instead of the
    authoring error about writing one.
  - Builder: Export sends the space's plugin types, so an element a plugin provides is no longer reported as unknown.

  ## Outbound requests stay outside the cluster
  - `sdk-server`: the `http.request` task and the connector engine refuse private destinations however they are written.
    An address is judged by range, so private IPv4 written as IPv6 (`[::ffff:127.0.0.1]`, `[::]`) is refused, and so
    are the multicast, CGNAT and reserved ranges. NAT64 and 6to4 addresses are judged by the IPv4 address they carry,
    so an IPv6-only cluster still reaches public IPv4 APIs. A DNS name is no longer refused just because it starts like
    an IPv6 prefix (`fcbarcelona.com`).
  - Redirects are followed one hop at a time, and each destination is checked before anything is sent to it. A public
    URL that redirects into the cluster is refused. A redirect that leaves the origin drops `Authorization` and `Cookie`.

  ## The grant screen says who is asking
  - `sdk-server`: the OAuth grant screen names the client and the host the grant is sent back to ("an app on this
    computer" for a loopback client). Anybody can register a client under any name, so the host is the part a person
    can check. `OAuthConsentView` carries it as `client: { name, redirectHost, loopback }`.
  - New `OAuthConfig.loopbackRedirectsOnly`: only `http://127.0.0.1` / `localhost` redirects are accepted, when a client
    registers and again at `/authorize`. Turn it on when every client is a native app, above all with `directTokens`,
    where the grant is the person's session.

  ## Draft previews: a secret, and one space
  - `sdk-mcp`: the `/__preview` endpoint refuses every request when preview is enabled without a `secret`, and compares
    the secret in constant time. It lives on the page server the public reaches, so "no secret" used to mean "no check".
    **A deployment with preview on must set `preview.secret`**, and every caller must send it as `x-preview-secret`.
  - `sdk-server`: a draft is only rendered for the space it was made from. `DraftPutOptions` and `DraftEntry` carry
    `spaceId`, and a token presented under another space's host is ignored. A custom `DraftStore` has to keep it.

  ## One outbound rule, everywhere
  - `sdk-server`: `@plitzi/sdk-server/kernel` exports `isBlockedHost` and `assertOutboundAllowed`, the rule the
    `http.request` task and the connector engine follow.
  - `sdk-mcp`: the widget proxy judges addresses with that rule instead of its own copy, which let IPv4 written as IPv6
    (`[::ffff:127.0.0.1]`) through.
  - `sdk-server`: a space's external plugin manifest is fetched through the same rule, redirects included.

  ## A signed-in visitor is rendered signed in, the day after too
  - `sdk-server`: a page asked for once the access cookie has expired but renewal is still possible (the session hint
    says so) is sent to renew first and comes back signed in, so the server renders the visitor the browser will end up
    with. The HTML used to be the guest page, swapped for the signed-in one after boot, and a guest-only page was shown
    and then redirected away from instead of answered with a 302.
  - New `createServer({ sessionRenewal: { url } | false })`. On by default with `auth` (its own `/refresh`); without it,
    name the endpoint — an absolute URL when another host serves `/auth`.
  - The endpoint is `GET <basePath>/refresh?redirect=<page>`, served by `createServer({ auth })` and now also by
    `mountAuthRoutes` (34 routes). It renews with the refresh cookie, writes the new session or ends a dead one, and
    always sends the browser back — to a path, or to a host sharing the session's cookie domain (`/` otherwise).
  - Only whole-tab navigations (`Sec-Fetch-Dest: document`) take part, on both halves: a renewal rotates the session,
    and an `<img>` or a frame on another site must not be able to. Anything else on `GET /refresh` is a 405. A short
    `<cookie>_renewing` cookie keeps a renewal that failed without ending the session from sending the visitor round
    again.
  - New in `@plitzi/sdk-server/auth`: `parseSessionHint`, `readSessionHint`, `sessionReturnTarget`,
    `isDocumentNavigation`, `renewForNavigation`.

  ## Scheduled jobs: a store hiccup is not an incident
  - `sdk-server`: a schedule sweep, reconcile, job claim or heartbeat that fails is reported by how long it has been
    failing. The first failure is a one-line warning with its reason (it runs again by itself, and every pass is safe
    to repeat); a pass still failing a minute later is the error, with the cause; the pass that ends such a streak says
    so. A Mongo driver resetting its pool while the host was busy used to print an error with a stack on every pass it
    caught. A deployment's own `onError` still receives every failure.
  - Tests that ran slow under a busy machine: the CLI's type-declarations test (a real compile) has a timeout of its own,
    and the workers test waits for every worker to listen rather than a fixed number of requests.

  ## Plugins held to their declarations, and fixes a full example found
  - `authorSpace(space, { plugins: [declaration] })` (also `validateSpace`, `lintSpace`, `fixSpace`): a plugin handed over
    as its declaration is checked like a built-in element — authored as its own type or hosted by
    `custom({ renderType })`. A flow on an event it never fires, a step sent to an action it does not answer and an
    attribute it does not read are refused, naming what it declares. `pluginTypes` stays as the lighter form.
  - New step builders typed from a declaration: `declaredTrigger(declaration, 'onPick')` and
    `declaredCallback(declaration, 'reset', { on: 'seats' })` — a name the declaration lacks is a compile error.
  - A `custom` host whose component was not declared is no longer refused for flows on the component's own events: the
    plugin template `plitzi add plugin` writes (`onCount`) could not be used in a flow as generated.
  - `setState` accepts `type: 'json'` in authoring, as the runtime and the docs always did; a test holds the two lists
    together.
  - The plugin cache rebuilds when a plugin's entry moved (`Widget.ts` → `Widget/index.ts`) or a file it was built from
    was deleted — a missing file used to count as unchanged, and a versioned plugin served the old bundle for good in dev.
  - A plugin handed to the SDK after mount — one the server could not import, passed once hydration is done, or a
    `<PlitziSdk.Plugin>` added later — now renders: the component registry was built once and never learned of it.
  - `dropdown`: a click inside the popup no longer reaches the trigger and closes the menu (`closeOnClickPopup: false`
    now keeps it open), and `closeOnClickBackground` closes on a click outside even without the blocking background.
  - A space's `style.theme.default` is applied: the server paints a first visit in it, and the SDK starts there. The
    theme cookie now records only a visitor's CHOICE — the theme a surface merely started in is not written — so a space
    that changes its default reaches everybody who never chose.
  - `button`, `text`, `markdown` and `heading` default line heights are ratios that land on the same pixels at their
    default sizes, so a class that resizes the text keeps the proportion instead of a fixed 24px line.
  - Skills: `plitzi-authoring` gains `reference/validation.md` (how `authorSpace` checks — first refusals one at a time,
    then the linter's list at once — a one-file author script, and what it cannot see) and plugin guidance; `@plitzi/cli`
    ships a `plitzi-cli` skill, copied into every project `plitzi create` writes and every plugin package.

  ## A flow's steps read the page as it is when they run
  - **Behaviour change.** Every step of a flow reads the sources again when it runs, instead of the page as it was when
    the trigger fired. A `when` or a `{{ state.x }}` after a `setState` sees the new value; one after a `delay`, a
    server action or anything else that waits sees what changed meanwhile, including what the person did. `computed`
    is evaluated again for each step over the state as it is then — read from the store, not from the copy the last
    render left in `runtime.sources`.
  - What this breaks: a toggle written as two `setState` steps under opposite `when` guards on the same key now flips
    and flips back. `authorSpace` warns about it (`state-toggled-in-branches`) and names `toggleState`. The Plitzi
    website's sidebar toggle was the one stored flow of that shape, and is one step now.
  - `liveSources(sources, state, computedDefinitions)` (`@plitzi/sdk-shared/dataSource`) is what an element hands a
    running flow.

  ## Keyboard shortcuts: `onKey`
  - A trigger every element has, `onKey`, with one param: `keys` — one shortcut or several with commas (`'f'`,
    `'shift+f'`, `'mod+k'`, `'plus, ='`, `'escape'`). Heard on the window while the element is mounted; ignored while
    somebody types in a field unless Ctrl/⌘/Alt is held or the key is Escape; a matching press does not also do the
    browser's default. The flow reads `{{ <step>.key }}`, the key pressed.
  - Authoring: `onKey(keys)` refuses a shortcut that cannot fire where it is written; `lintSpace` reports one written in
    the builder (`trigger-keys`).
  - `@plitzi/sdk-shared/helpers/keys`: `parseKeys` and `keyPressCombo`, the two halves of matching.

  ## `plitzi create` projects check their own plugins
  - A local project keeps `src/plugins/declarations.ts`, and every place it authors the space — the server or the
    browser entry, `npm run author`, the visual test — passes it to `authorSpace(space, { plugins: declarations })`.
    `plitzi add plugin` adds each new plugin's declaration to it (or, when the list was changed by hand, says what to
    add). A flow on an event a project's plugin never fires is refused at authoring, as it is for a built-in element.

  ## Templates: `same as`, `divisible by`, and `null`
  - `x is same as(y)` and `x is divisible by(n)` (with their `is not` forms) are Twig tests the interpreter now reads.
    Before, `same` was read as a variable nobody set, so `x is same as(false)` held exactly when `x` was UNSET — silently
    the opposite of what it says.
  - `null` and `none` are literals, as in Twig, instead of names that resolved to nothing. After `is` they are still the
    test (`x is null` holds for an unset value too).

  ## `whileRunning`: what a trigger fired again while its flow runs does
  - A trigger's `whileRunning` is `skip` (the default and what always happened: the firing is ignored — no double
    submit), `queue` (it runs after the one in progress, in order) or `parallel` (it runs at once). Authored with
    `whileRunning('queue', onClick())`, offered on the trigger in the builder, carried by the MCP and by the export to code.
  - The guard is now per FLOW rather than per event: one flow on a click still running no longer holds back another flow
    on the same click.
  - `lintSpace` refuses `whileRunning` on a step that is not the trigger, or an unknown value (`while-running`).

  ## A trigger fired while the page mounts runs its flow
  - A flow starts one microtask after its trigger fires, once the commit that fired it has run all its effects. The
    page's sources (`state`, `navigation`, the actions) register from effects React runs after those of the elements
    under them, so a plugin firing an event from its first effect used to run a flow whose steps found nothing
    registered — and did nothing, silently. `onLoad` and `onPageLoad` had each worked around it on their own.
  - An element unmounted — or mounted again, as React does twice in development — before its flow starts does not run
    it for the subscription that is gone. An element that only re-rendered keeps its subscription: `useInteractions`
    subscribes once per mount and hands new callbacks to `InteractionsManager.update`, so a form marking itself
    submitted as it fires `onSubmit` still runs the flow.

  ## Realtime channels
  - A space declares `channels` — topic patterns (`board:{id}`) with an access rule, who may send (`clients` or only
    the `server`), `presence`, `maxMessageBytes` and `messagesPerSecond`. An undeclared topic is refused by the server,
    by `authorSpace` and by `lintSpace` (`channel-topic`).
  - `sdk-server` serves `/_realtime`: one Server-Sent Events connection per page for every topic it listens to, and a
    `POST` to publish. Every message is authorised, size- and rate-checked, and stamped by the server (`from`, `user`,
    `at`); presence (`$presence`, `$join`, `$leave`) is kept by the connections, nothing stored.
  - Transport is a `PubSubAdapter` the deployment picks: `createServer({ realtime: { pubsub } })`. `createMemoryPubSub`
    (the default, across a server's workers) and `createRedisPubSub({ publisher, subscriber })` ship; anything else is
    one object of two methods. `realtime: false` turns the endpoint off.
  - A server action announces what it did with the `realtime.publish` task (`ctx.publish` for a deployment's own task).
  - On the page: the `channel` element (source `channel_<id>`: `connected`, `me`, `members`, `messages`, `last`;
    `onMessage`, `onJoin`, `onLeave`; `publish`, `setPresence`), and `useChannel` for a plugin that moves at the speed
    of a cursor. `onJoin` is somebody who came after the page, once they announced who they are, and `onLeave` somebody
    who went — both with `from`, `user` and the `state` they announced, so a flow says who (`useChannel`'s `onJoin` /
    `onLeave`, `trackPresence`'s `onArrive` / `onDepart`). Authoring: `channel(...)`, `publishOn`, `announceOn`, and `channels` on the space.
  - A page is one connection and one member per topic, however many elements and plugins listen; a publish waits for
    the connection that includes its topic, so one made right after a navigation is not refused.
  - Two transports at the same address: Server-Sent Events plus a `POST` per publish (`sse`, the default), or one
    WebSocket both ways (`realtime: { transport: 'websocket' }`), where a publish is a frame answered by an `ack`. A
    page falls back to the stream on its own where a socket cannot open (HTTP/2, a proxy that drops upgrades). A socket
    from another origin is refused unless listed in `realtime.allowedOrigins` — CORS does not protect a WebSocket.
  - Upgrades go through the same pipeline as any request (space, auth, then the realtime stage); an upgrade on any other
    path is a `404`. `makeHandler(label, buildContext, stages, { compression, upgrades })` takes an options object.
  - Channel declarations are checked in one place, `channelProblems` (`@plitzi/sdk-shared/realtime`): authoring refuses,
    `lintSpace` reports `channel-declaration`, and the MCP's `patchSettings` takes `channels` (merged per pattern, `null`
    removes one) and answers with the same sentence. The agent's guide has a "Realtime channels" section.
  - Pizarra, a collaborative whiteboard built on all of the above — channels, server actions, a canvas plugin, an agent at
    `/mcp` — is a seeded space on the platform (`pizarra.plitzi.app`) whose server code is its runtime, not an example
    here. See `docs/en/realtime.md`.
  - `lintSpace`'s `channel-topic` skips an element whose `topic` is bound: its topic is only known on the page.

  ## A page on its way out keeps what it showed
  - A server-driven section (`apiContainer` with `runtime: 'server'`, anything reading `useRscData`) on the page being
    left kept rendering its last answer. A navigation asks for the destination's payload before it goes, and the page it
    leaves is still drawn over that payload for a moment — first while it lands, then while the next page renders — with
    no slice for anything on it: every section drew itself empty on the way out (a list turned into its empty state on
    the click that opened one of its items). An element on a layout, which is on every page, is never held back.

  ## Links open where they are asked to
  - A `link` to a page of the site with a `target` of its own (`blank`…) opened in the same tab — the click was always
    taken over for in-place navigation. So was a click held with ⌘, Ctrl or Shift, or with the middle button. Only a
    plain click to the same tab navigates in place now; the rest is the browser's.

  ## `navigation.href`: the page's whole address, from the first paint
  - The navigation store (and the `navigation` global source) carries `href` — origin, path and query — beside
    `origin`, on the server as in the browser. A text or a code built from "this page's link" is right in the first
    paint, where one filled in by the browser once mounted showed its placeholder first. The builder answers it for the
    host being tested.

  ## A server provider pages, and searches, where it is
  - What a refresh of a server-driven provider asks for besides its page — the next page of a "load more", the input it
    was reloaded with — reaches what resolves it. `/_rsc` read only the query of the page's `location` and dropped the
    rest, so a provider paged in place (`pagination: 'append'`, `goToPage`) was answered its first page every time.
  - `performQuery` (authoring: `reloadApi(id, input)`) takes an `input` for a server-driven provider — a search, a
    filter, how many to show — and the provider keeps it for the pages and refreshes after it: "load more" of a search
    is more of the search, and a live refresh does not lose it.

  ## The server names a page's origin with its port
  - The origin a page is rendered with (`navigation.origin`, `location.origin`) lacked the port on the server: a site on
    `:4016` was `http://127.0.0.1` in the first paint and `http://127.0.0.1:4016` once hydrated — a text built from it
    did not hydrate, and a link built from it pointed nowhere until then. It is taken from the request's authority,
    guarded as before against a forged Host.

  ## `onPointerDown`: the press, before it is a click
  - Every element fires `onPointerDown` (authoring: `onPointerDown()`), beside `onClick`, `onHover` and the rest: the
    press itself, where a drag away from the element starts — a tile taken to a canvas, a handle pulled. Let go where it
    went down, it is a click too and `onClick` follows.

  ## `formControl` takes the focus as it appears
  - `autoFocus: true` focuses a control each time it is shown — as it mounts, and again whenever it or anything around
    it goes from hidden to shown, so a search box a shortcut opens is typed into at once however many times it opens.
    Text inputs and textareas alike; never in the builder.

  ## Elements move as they show and hide: the `hidden` style state
  - A class's `states` take `hidden`: how an element looks while its `visible` says no — where it goes as it hides and,
    written as its `@starting-style` too, where it comes from as it shows. With a transition that includes
    `display … allow-discrete`, a panel fades or slides instead of blinking, with a pace of its own each way (the base's
    transition is the way in, the one in `hidden` the way out). `ancestors` take it too, for what is inside something
    that hides. The builder's style editor has it as a tab, like `hover`. The SDK's hidden class is exported as
    `HIDDEN_CLASS` (`@plitzi/sdk-shared/style/styleStates`).
  - `transition-behavior` is in the style vocabulary, and `transition` reads `allow-discrete` into it.
  - A layered `transition`, `animation` or `background` whose layers do not all say the same things expanded the missing
    ones to `initial` — which is not allowed inside a list, so the browser dropped the whole declaration (a second layer
    without a delay voided the first one's). They are now filled with each longhand's initial value, and
    `background-color` is taken from the last layer only.

  ## `formControl` of `subType: 'color'`
  - A form control can be the browser's own colour picker: `subType: 'color'`, its value `#rrggbb`. Its `onChange` fires
    as the colour is picked, like any other control's.

  ## A render reads what a call wrote
  - `createServer` built the actions module for `render` elements on a different config object than the one the
    endpoint used — two modules, so two in-memory `kv` stores and two sets of single-flight guards. With no `kv`
    configured, what a call saved was missing from every render. Both now share one module.
  - The runner, the guards and the module's own `kv` share one default store instead of a Map apiece.

  ## `json_encode` prints JSON for every value
  - `json_encode` and `to_json` encoded objects only: `null` printed as nothing and a string printed bare, so a JSON
    document built around them — a server action's `output`, a `realtime.publish` step's `data` — stopped being JSON the
    moment a value was `null` or text, and the step failed at the end with the work already done. They now do what Twig
    does: a string is quoted and escaped, `null` and an unset value are `null`. `object_as_json` is unchanged.

  ## Keyboard shortcuts leave a text field its own editing
  - With ⌘/Ctrl held a press in a field still reaches `onKey` (so `mod+k` opens a palette from a search box), but the
    field keeps ⌘A, ⌘Z/⌘⇧Z/⌘Y, ⌘C/⌘X/⌘V and moving or deleting by word and line (`isFieldEditing`): a space binding
    `mod+a` to "select all shapes" no longer steals "select this text".

  ## Usable without sight: screen readers and browser agents

  Screen readers and browser agents (Claude in Chrome) find a page's controls in its accessibility tree. The elements
  now put the right things there, authors can say the rest, and the linter says when they have not. See
  `docs/en/accessibility.md`.

  - `modalContainer` / `dialogContainer` are a `dialog` / `alertdialog` with `aria-modal`, named by their title. They
    take the focus as they open, keep Tab inside, close on Escape (a dialog is turned down, never accepted) and give the
    focus back as they close. Their footer buttons are `type="button"`.
  - `tabContainer` is a `tablist` of `tab`s (`aria-selected`, `aria-controls`) and `tabpanel`s, with one tab in the Tab
    order; the arrow keys, Home and End move between tabs, Enter and Space select.
  - `formControl`: a control breaking a rule is `aria-invalid` and described by its message (`aria-describedby`), which
    is an `alert`. The password eye is a real button, "Show password", with `aria-pressed`. New `hideLabel`: the label
    stays out of sight and still names the field.
  - `fontAwesome` is `aria-hidden` unless its new `label` gives it a meaning (`role="img"`).
  - `image` takes `decorative`: `alt=""` whatever `alt` says. The builder's settings can now write `alt` at all.
  - `container` takes `label`: a landmark's name, a `section` becomes a region, a `div` a named group
    (`NAMEABLE_CONTAINER_TAGS`).
  - `pagination` is a `nav` named by its new `label` ("Pagination"); the current page is `aria-current="page"`.
  - The segmented `themeToggle` is a named `group` whose options carry `aria-pressed`.
  - `link`'s `label` can be written in the builder. `button` takes a `label` too (`aria-label`), for a button whose words
    do not say what it does — a key hint, a count.
  - `dropdown` marks the control that opens it (`aria-haspopup`, `aria-expanded`); opened from the keyboard the focus
    moves to the popup's first control, and it goes back to the trigger when the popup closes with the focus inside.
  - `container` takes `decorative`: an illustration built from elements, `aria-hidden` whatever it holds.
  - The SDK's button base no longer removes the focus ring for everyone: only for a pointer
    (`:focus:not(:focus-visible)`).
  - New warnings in `lintSpace`: `control-without-name`, `image-without-alt`, `click-on-static-element`,
    `dropdown-without-control`, `heading-level-skipped`, `label-ignored`, `control-in-decorative`. Nothing inside a
    `decorative` container is held to them. The blank space and the examples author with none.
  - `plitzi_screenshot` takes `view: 'accessibility' | 'both'`: the page's accessibility tree as an outline, and every
    control or picture with no name (`unnamed`). `ScreenshotInput.views`, `ScreenshotResult.accessibility`; the HTTP
    client reads the screenshot service's Puppeteer tree (service ≥ 0.1.9), the local client Playwright's or Puppeteer's.
    `outlineOfTree`, `outlineOfSnapshot` and `unnamedControls` are exported.
  - The MCP guide, its quickstart, the server instructions and the co-worker prompt teach it; so does the authoring skill
    (`reference/accessibility.md`, a recipe, the review checklist).

  ## A server with pages open shuts down
  - `close()` — and so `closeOnSignals` — waited for every open connection to end, and a realtime WebSocket, an event
    stream or an agent's listening MCP stream never does: with a page open, the first Ctrl+C or SIGTERM hung until a
    second one, or a SIGKILL, cut it. Now the server stops taking connections, the realtime hub closes its connections
    (a socket with 1001, going away), any other event stream is ended, requests being answered finish, and what is
    still open after `SHUTDOWN_GRACE_MS` (10 s) is cut. `HttpServerParts.onClosing`; `RealtimeConnection.end`,
    `hub.closeAll()`, `hub.connectionCount`.

  ## A lighter SDK

  `plitzi-sdk.js` (production) goes from 1141 KB to 766 KB minified, 342 KB to 239 KB gzipped. Nothing a page does
  changed.

  - No Apollo in the SDK. It sends three queries, always to the network, and carried a GraphQL client with a normalized
    cache, `graphql`'s parser, rxjs and optimism for them — a quarter of the bundle. A `fetch` sends them now
    (`createGraphqlClient`, `GraphqlRequestError` with `failure: 'network' | 'http' | 'graphql'`), a 401 still reaches
    the auth-failure channel, and a page that cannot load says what it said before ("Access not authorized", "Service
    not available"). `SdkQueries` in `sdk-shared` are strings rather than `gql` documents, typed
    `Record<keyof SdkQueriesMap, string>`; the builder's documents are unchanged. `@apollo/client` and `graphql` are no
    longer dependencies of `@plitzi/plitzi-sdk`.
  - The dev-tools panel is a chunk of its own, `plitzi-sdk-devtools-<hash>.js`, beside `plitzi-sdk.js`: a page loads it
    when it is allowed to debug and shows the tools, and no other page does. `DevToolsContainer` loads its badge and panel
    lazily (they were never drawn before hydration), so the builder splits them off too. The chunk imports the SDK as
    `@plitzi/plitzi-sdk` — the name every page's import map already gives it for plugins — so the panel inspects the
    page's own stores, not a second copy the `?v=` cache-buster would have loaded. The build fails if anything else ever
    splits off.
  - `date-fns-tz` is gone from `sdk-shared`: `formatDateUTC` and `formatUTCToLocal` need no time-zone library.
    `formatUTCToLocal` printed the hour that repeats when daylight saving time ends an hour off; it no longer does.
  - The SDK's demo page and the static deployment template map `react/compiler-runtime`, which the bundle imports and
    only the page server's template mapped: a statically deployed space failed to start with "Failed to resolve module
    specifier".

  ## Two writers at once, and private channels

  What an app with more than one person in it had to build for itself, now the platform's — Pizarra, the whiteboard
  example, was built on the lack of them and is simpler for it.

  - **`kv.setIf`**: writes only if the key still holds the value the flow read, and answers `written: false` when somebody
    got there first; empty `expected` = only if nothing is there yet (claim a seat, a username). `ActionKvStore.swap` for
    a deployment's own tasks.
  - **Lists**: `list.put` (one entry per id, highest score first, `keep` the top N — answering what it `dropped` — and
    `higherOnly` to keep a higher score already there), `list.range`, `list.remove`. At most 500 entries and 128 KB.
    `ActionKvStore.listPut` / `listRange` / `listRemove`.
  - **`flow.rateLimit`**: at most N runs every so many seconds, per person or for everyone, refused with its message.
  - **The `kv` adapter has a sixth operation, `swap`** (compare-and-set) — a breaking change for a deployment with its
    own adapter. Memory, the worker fleet's shared copy, MySQL, Mongo and the examples implement it; **`createRedisKv`**
    ships in `@plitzi/sdk-server/actions`, so a deployment on Redis writes no adapter at all (plitzi-sdk-server uses it).
    All of them pass one contract, racing writers included.
  - **Private channels**: a channel declared `grant: true` opens a topic only for a page that brings a grant for it —
    handed out by the `realtime.grant` task (or `ctx.grant`) after the flow decided the visitor may be there. Refused
    otherwise (`ungranted`), however well the topic's name is known. Grants live in the store the actions use, so they
    work across replicas with nothing new to configure; a day by default, thirty at most. The `channel` element and
    `useChannel` take a `grant`, the realtime client's `grant(topic, grant)` sends it; `lintSpace` reports a private
    topic opened with none (`channel-grant`).
  - **Revoking**: `realtime.revoke { topic, grant }` (or `ctx.revoke`) takes one grant back — or, naming none, every grant
    for the topic, the ones not used yet too. Whoever is on it with one, on any replica, is let go of it at once: their
    page hears `$revoked`, the others hear them leave, `useChannel` says `connected: false`; a new grant opens it again.
  - **MySQL `kv`**: a key is bytes (`VARBINARY(764)`) — `Board` and `board` were one key here and two in Redis and in
    memory — and a value a `MEDIUMTEXT`, where a `TEXT` refused, or cut short, anything past 64 KB. An existing table is
    brought up to it on first use, and only when it needs it; `mysqlJobSchemaUpgrades()` for a deployment that migrates
    its own tables (`createTables: false`).
  - Pizarra: its gallery is two of these lists — the featured boards and the rest, 200 kept, the one dropped forgotten;
    every board is written on its own with `swap` instead of one lock for all of them across every replica;
    its rate limits are `flow.rateLimit` steps in its actions; its board and room channels are private, opened with the
    grant `board-load`/`board-open` answer — a locked board's topic no longer carries a secret, only its password's
    version.

  ## Functions: a space's own server code

  A space can have its own server code: TypeScript whose **tasks** are steps in its actions and whose
  **routes** answer under `/api/` on its host, run by the platform in a sandbox. See `docs/en/functions.md`.

  - **The contract**, `@plitzi/sdk-server/functions`: `defineFunctions({ allow: { hosts }, tasks, routes })`, `ctx`
    (`kv`, `fetch` to declared hosts only — a credential NAMED and written in by the platform, its value never in the code
    —, `publish`/`grant`/`revoke`, `user` without its session, `log`, `emit`, `signal`), web-standard only.
    `dist/functions-api.d.ts` is the contract rolled up in one file, for editors (`@plitzi/sdk-server/functions-api.d.ts`).
  - **Breaking: `action.tasks` is gone.** A deployment's own tasks are functions loaded natively:
    `createServer({ functions: { native: [defineFunctions({ tasks })] } })` — the same shape a space's are. Their routes
    are served too.
  - **`loadFunctions(dir)`** (`@plitzi/sdk-server`): a `functions/` folder built as the platform builds a space's and
    loaded natively — what a self-hosted server passes to `functions.native`, and what a `plitzi create` server project
    now does with its own `functions/`. Which files are the source is one rule, `readFunctionsSource` /
    `isFunctionsSourcePath` in `@plitzi/sdk-shared/actions`, used by it, the build and the CLI.
  - **The runner**, `@plitzi/sdk-server/functions-runner` (`isolated-vm` and `core-js@3` are optional peers):
    `startFunctionsRunnerService` — its own process, one V8 isolate per invocation from a snapshot (~2 ms), CPU / wall /
    memory / output / calls limits that hold, behind a shared secret, warmed before it listens so no request pays the
    first isolate; `createRemoteRunner` — the page server's client, one WebSocket per invocation with the code's calls
    answered on it, abandoned past the invocation's wall time plus `graceMs` (5 s) even when the runner never answers;
    `createIsolateRunner({ concurrency, cacheBytes })` — compiled bundles kept by size (64 MB), least recently used out;
    `createLocalFunctions`. Isolates need Node started with `--no-node-snapshot` (isolated-vm crashes beside Node's
    startup snapshot): without it they refuse to start, naming the flag; `plitzi functions dev` re-runs itself with it.
  - **A run carries the bundle by reference**: `FunctionsBundleRef { id, load }` in `FunctionInvokeRequest` and
    `SpaceFunctions` — a runner asks for the code (`needBundle`) only when it does not keep that bundle, so a lookup never
    reads it on the way to one. `functionsInHand` makes one from a bundle already in memory.
  - **Wired into actions**: `lookups.getFunctions(spaceId, at)`; `registryFor(spaceId, at)` — the catalog, the check and
    the runs of a space see its tasks; `prepareFunctions(source)` builds, reads and checks a source before it is stored;
    `functions.limits`, `functions.admit`, `functions.onUsage` for a deployment's ceilings and budget. A run only asks for
    a space's functions when a step names a task the deployment does not have.
  - **`ctx.log`** for every task: a step's lines are kept on it (`ActionRunStep.logs`, redacted, at most 100), shown by
    a Try and in the run history. Builder test runs return `steps`.
  - **Routes** under `/api/`: the visitor's `cookie`/`authorization` never reach the code, `Set-Cookie` is dropped, a
    failure answers 500/503 with its reason in the server log only. `lintSpace` refuses a page under `/api`
    (`page-route-reserved`); the prefix is `FUNCTION_ROUTES_PREFIX` in `@plitzi/sdk-shared/actions`.
  - **Builder**: a Functions panel — the files, TypeScript that knows `ctx` in a worker of its own
    (`dist/plitzi-functions-worker.js`, loaded only when the panel opens; the host passes `functionsWorkerUrl`), Save with
    the problems where they are, what the code declares, and Try. Needs `@plitzi/plitzi-ui` 1.6.24 (`CodeMirror`
    `mode="ts"` and `extensions`).
  - **CLI**: `plitzi functions pull | push | try | dev` — `functions/` as a working copy of the space's, refused rather
    than overwritten in either direction; `dev` runs it on the machine with the project's own `@plitzi/sdk-server`.
  - **MCP**: the `upsertFunctionFile` / `deleteFunctionFile` operations (saved first in a batch, so a problem refuses
    it all), `plitzi://functions/{env}` and `/{+path}`, and `plitzi_try_function`.
  - **`crypto.subtle` derives keys**: PBKDF2 (`importKey('raw', password, 'PBKDF2')`, `deriveBits`, `deriveKey` to an
    HMAC key) beside digests and HMAC, so a space can keep a password. The runner derives, at most 1,000,000 iterations
    and 1024 bits a call, and charges what it took to the run's CPU. A key is held to the usages it was imported for.
  - **`ActionRefusal` from `@plitzi/sdk-server/functions`**: a function refuses with a reason for whoever asked — the
    page reads it as `{{ step.error }}`, a route answers `400 { error }` — natively and in the sandbox alike (the bundle
    prints the platform's class; a refusal crosses the runner as `FunctionFailure` reason `refused`). Anything else a
    function throws still stays in the run's record.
  - **`ctx.kv.change(key, change, lifetime)`**: read, change and write back, again when somebody wrote first — the loop
    every concurrent edit needs, now one (lists stand on it too; the sandbox runs the same function). **`ctx.rateLimit`**
    counts with `flow.rateLimit`'s counter and answers `{ allowed, count, remaining }`. **`ctx.sign` / `ctx.verify`**:
    HMAC with a per-space, per-environment key derived from the new `action.signingSecret`, which the code never holds.
  - **Space runtimes**, `@plitzi/sdk-server/runtime` ([docs](../docs/en/runtimes.md)): a space's own server code run as a
    process of its own beside the platform — `defineRuntime({ start })` answers its `functions` (run with the platform's
    `ctx` over the runners' protocol) and `endpoints` (web handlers, streamed). `startSpaceRuntime` hosts one,
    `createRuntimeProxyStage` forwards a space's endpoints to it, `serveRuntime` loads one into a server of its own;
    `packRuntime` / `inspectRuntime` / `loadRuntime`; `SpaceFunctions.runner` sends a space's tasks to its runtime. One
    driver for the sandbox and runtimes alike (`createFunctionsDriver`, printed into the guest). CLI: `plitzi runtime
push | status | vars`. Builder: a Runtime panel — each environment's state, and write-only variables.
    `examples/self-hosting/10-runtime` is the smallest one — a task, a route and a stream held open — served by its own
    `main.ts`; Pizarra, on the platform, is a whole product built this way. A runtime runs at a size — small, medium or large, each a plan feature
    — shown and chosen per environment in the Runtime panel and with `plitzi runtime size`. One nobody uses for a
    week — on the platform — stops by itself until started again (Start in the panel, `plitzi runtime start | stop`, a
    push or a publish) — its status says `starting` or `stopping` meanwhile; the builder's header warns a day before,
    with a way to keep it running. `createRuntimeProxyStage` takes `onForward`, told of
    each request it forwards — what counts as a runtime used. `reachSpaceInside` (the host's `insideUrl`)
    sends a runtime's `fetch` and `WebSocket` to its own space's address to an inside one — a cluster's ingress — instead
    of out through the edge and back.
  - **Authoring writes one form of each**: a trigger that `whileRunning('skip', …)` is written as the default it is, and
    `bind: []` writes no `bindings` — a document read back into code is the one written.
  - **Shared types**: `FunctionsManifest`, `FunctionsDraft`, `FunctionsProblem`, `FunctionsSaveResult`; the builder's
    `SpaceFunctions`, `SpaceSaveFunctions`, `SpaceRemoveFunctions`, `SpaceTryFunction`; `ChangeDocument` `functions`
    with entries of kind `file`; `SSRAdapters.getFunctions` / `saveFunctions` / `tryFunction`.

- Updated dependencies [cadd1b9]
  - @plitzi/sdk-navigation@0.37.3
  - @plitzi/sdk-schema@0.37.3
  - @plitzi/sdk-shared@0.37.3
  - @plitzi/sdk-style@0.37.3

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
  - @plitzi/sdk-navigation@0.37.2
  - @plitzi/sdk-schema@0.37.2
  - @plitzi/sdk-shared@0.37.2
  - @plitzi/sdk-style@0.37.2

## 0.37.1

### Patch Changes

- v0.37.1
- Updated dependencies
  - @plitzi/sdk-navigation@0.37.1
  - @plitzi/sdk-schema@0.37.1
  - @plitzi/sdk-shared@0.37.1
  - @plitzi/sdk-style@0.37.1

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
  - @plitzi/sdk-navigation@0.37.0
  - @plitzi/sdk-schema@0.37.0
  - @plitzi/sdk-shared@0.37.0
  - @plitzi/sdk-style@0.37.0

## 0.36.2

### Patch Changes

- v0.36.2
- Updated dependencies
  - @plitzi/sdk-navigation@0.36.2
  - @plitzi/sdk-schema@0.36.2
  - @plitzi/sdk-shared@0.36.2
  - @plitzi/sdk-style@0.36.2

## 0.36.1

### Patch Changes

- v0.36.1
- Updated dependencies
  - @plitzi/sdk-navigation@0.36.1
  - @plitzi/sdk-schema@0.36.1
  - @plitzi/sdk-shared@0.36.1
  - @plitzi/sdk-style@0.36.1

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
  - @plitzi/sdk-navigation@0.36.0
  - @plitzi/sdk-schema@0.36.0
  - @plitzi/sdk-shared@0.36.0
  - @plitzi/sdk-style@0.36.0

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
  - @plitzi/sdk-navigation@0.35.10
  - @plitzi/sdk-schema@0.35.10
  - @plitzi/sdk-shared@0.35.10
  - @plitzi/sdk-style@0.35.10

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
  - @plitzi/sdk-navigation@0.35.9
  - @plitzi/sdk-schema@0.35.9
  - @plitzi/sdk-shared@0.35.9
  - @plitzi/sdk-style@0.35.9

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
  - @plitzi/sdk-navigation@0.35.8
  - @plitzi/sdk-schema@0.35.8
  - @plitzi/sdk-shared@0.35.8
  - @plitzi/sdk-style@0.35.8

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
  - @plitzi/sdk-navigation@0.35.7
  - @plitzi/sdk-schema@0.35.7
  - @plitzi/sdk-shared@0.35.7
  - @plitzi/sdk-style@0.35.7

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
  - @plitzi/sdk-navigation@0.35.6
  - @plitzi/sdk-schema@0.35.6
  - @plitzi/sdk-shared@0.35.6
  - @plitzi/sdk-style@0.35.6

## 0.35.5

### Patch Changes

- v0.35.5
- Updated dependencies
  - @plitzi/sdk-navigation@0.35.5
  - @plitzi/sdk-schema@0.35.5
  - @plitzi/sdk-shared@0.35.5
  - @plitzi/sdk-style@0.35.5

## 0.35.4

### Patch Changes

- v0.35.4
- Updated dependencies
  - @plitzi/sdk-navigation@0.35.4
  - @plitzi/sdk-schema@0.35.4
  - @plitzi/sdk-shared@0.35.4
  - @plitzi/sdk-style@0.35.4

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
  - @plitzi/sdk-navigation@0.35.3
  - @plitzi/sdk-schema@0.35.3
  - @plitzi/sdk-shared@0.35.3
  - @plitzi/sdk-style@0.35.3

## 0.35.2

### Patch Changes

- v0.35.2
- Updated dependencies
- Updated dependencies [470aaf8]
  - @plitzi/sdk-navigation@0.35.2
  - @plitzi/sdk-schema@0.35.2
  - @plitzi/sdk-shared@0.35.2
  - @plitzi/sdk-style@0.35.2

## 0.35.1

### Patch Changes

- v0.35.1
- Updated dependencies
  - @plitzi/sdk-navigation@0.35.1
  - @plitzi/sdk-schema@0.35.1
  - @plitzi/sdk-shared@0.35.1
  - @plitzi/sdk-style@0.35.1

## 0.35.0

### Minor Changes

- v0.35.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-navigation@0.35.0
  - @plitzi/sdk-schema@0.35.0
  - @plitzi/sdk-shared@0.35.0
  - @plitzi/sdk-style@0.35.0

## 0.34.1

### Patch Changes

- v0.34.1
- Updated dependencies
  - @plitzi/sdk-navigation@0.34.1
  - @plitzi/sdk-schema@0.34.1
  - @plitzi/sdk-shared@0.34.1
  - @plitzi/sdk-style@0.34.1

## 0.34.0

### Minor Changes

- v0.34.0

### Patch Changes

- Updated dependencies [5aceda0]
- Updated dependencies
- Updated dependencies [5aceda0]
  - @plitzi/sdk-shared@0.34.0
  - @plitzi/sdk-navigation@0.34.0
  - @plitzi/sdk-schema@0.34.0
  - @plitzi/sdk-style@0.34.0

## 0.33.2

### Patch Changes

- v0.33.2
- Updated dependencies
  - @plitzi/sdk-navigation@0.33.2
  - @plitzi/sdk-schema@0.33.2
  - @plitzi/sdk-shared@0.33.2
  - @plitzi/sdk-style@0.33.2

## 0.33.1

### Patch Changes

- v0.33.1
- Updated dependencies
  - @plitzi/sdk-navigation@0.33.1
  - @plitzi/sdk-schema@0.33.1
  - @plitzi/sdk-shared@0.33.1
  - @plitzi/sdk-style@0.33.1

## 0.33.0

### Minor Changes

- v0.33.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-navigation@0.33.0
  - @plitzi/sdk-schema@0.33.0
  - @plitzi/sdk-shared@0.33.0
  - @plitzi/sdk-style@0.33.0

## 0.32.25

### Patch Changes

- v0.32.25
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.25
  - @plitzi/sdk-schema@0.32.25
  - @plitzi/sdk-shared@0.32.25
  - @plitzi/sdk-style@0.32.25

## 0.32.24

### Patch Changes

- v0.32.24
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.24
  - @plitzi/sdk-schema@0.32.24
  - @plitzi/sdk-shared@0.32.24
  - @plitzi/sdk-style@0.32.24

## 0.32.23

### Patch Changes

- v0.32.23
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.23
  - @plitzi/sdk-schema@0.32.23
  - @plitzi/sdk-shared@0.32.23
  - @plitzi/sdk-style@0.32.23

## 0.32.22

### Patch Changes

- v0.32.22
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.22
  - @plitzi/sdk-schema@0.32.22
  - @plitzi/sdk-shared@0.32.22
  - @plitzi/sdk-style@0.32.22

## 0.32.21

### Patch Changes

- v0.32.21
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.21
  - @plitzi/sdk-schema@0.32.21
  - @plitzi/sdk-shared@0.32.21
  - @plitzi/sdk-style@0.32.21

## 0.32.20

### Patch Changes

- v0.32.20
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.20
  - @plitzi/sdk-schema@0.32.20
  - @plitzi/sdk-shared@0.32.20
  - @plitzi/sdk-style@0.32.20

## 0.32.19

### Patch Changes

- v0.32.19
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.19
  - @plitzi/sdk-schema@0.32.19
  - @plitzi/sdk-shared@0.32.19
  - @plitzi/sdk-style@0.32.19

## 0.32.18

### Patch Changes

- v0.32.18
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.18
  - @plitzi/sdk-schema@0.32.18
  - @plitzi/sdk-shared@0.32.18
  - @plitzi/sdk-style@0.32.18

## 0.32.17

### Patch Changes

- v0.32.17
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.17
  - @plitzi/sdk-schema@0.32.17
  - @plitzi/sdk-shared@0.32.17
  - @plitzi/sdk-style@0.32.17

## 0.32.16

### Patch Changes

- v0.32.16
- Updated dependencies
  - @plitzi/sdk-navigation@0.32.16
  - @plitzi/sdk-schema@0.32.16
  - @plitzi/sdk-shared@0.32.16
  - @plitzi/sdk-style@0.32.16

## 0.32.15

### Patch Changes

- v0.32.15
- Updated dependencies
  - @plitzi/nexus@0.32.15
  - @plitzi/sdk-navigation@0.32.15
  - @plitzi/sdk-schema@0.32.15
  - @plitzi/sdk-shared@0.32.15
  - @plitzi/sdk-style@0.32.15

## 0.32.14

### Patch Changes

- v0.32.14
- Updated dependencies
  - @plitzi/nexus@0.32.14
  - @plitzi/sdk-navigation@0.32.14
  - @plitzi/sdk-schema@0.32.14
  - @plitzi/sdk-shared@0.32.14
  - @plitzi/sdk-style@0.32.14

## 0.32.13

### Patch Changes

- v0.32.13
- Updated dependencies
  - @plitzi/nexus@0.32.13
  - @plitzi/sdk-navigation@0.32.13
  - @plitzi/sdk-schema@0.32.13
  - @plitzi/sdk-shared@0.32.13
  - @plitzi/sdk-style@0.32.13

## 0.32.12

### Patch Changes

- v0.32.12
- Updated dependencies
  - @plitzi/nexus@0.32.12
  - @plitzi/sdk-navigation@0.32.12
  - @plitzi/sdk-schema@0.32.12
  - @plitzi/sdk-shared@0.32.12
  - @plitzi/sdk-style@0.32.12

## 0.32.11

### Patch Changes

- v0.32.11
- Updated dependencies
  - @plitzi/nexus@0.32.11
  - @plitzi/sdk-navigation@0.32.11
  - @plitzi/sdk-schema@0.32.11
  - @plitzi/sdk-shared@0.32.11
  - @plitzi/sdk-style@0.32.11

## 0.32.10

### Patch Changes

- v0.32.10
- Updated dependencies
  - @plitzi/nexus@0.32.10
  - @plitzi/sdk-navigation@0.32.10
  - @plitzi/sdk-schema@0.32.10
  - @plitzi/sdk-shared@0.32.10
  - @plitzi/sdk-style@0.32.10

## 0.32.9

### Patch Changes

- v0.32.9
- Updated dependencies
  - @plitzi/nexus@0.32.9
  - @plitzi/sdk-navigation@0.32.9
  - @plitzi/sdk-schema@0.32.9
  - @plitzi/sdk-shared@0.32.9
  - @plitzi/sdk-style@0.32.9

## 0.32.8

### Patch Changes

- v0.32.8
- Updated dependencies
  - @plitzi/nexus@0.32.8
  - @plitzi/sdk-navigation@0.32.8
  - @plitzi/sdk-schema@0.32.8
  - @plitzi/sdk-shared@0.32.8
  - @plitzi/sdk-style@0.32.8

## 0.32.7

### Patch Changes

- v0.32.7
- Updated dependencies
  - @plitzi/nexus@0.32.7
  - @plitzi/sdk-navigation@0.32.7
  - @plitzi/sdk-schema@0.32.7
  - @plitzi/sdk-shared@0.32.7
  - @plitzi/sdk-style@0.32.7

## 0.32.6

### Patch Changes

- v0.32.6
- Updated dependencies
  - @plitzi/nexus@0.32.6
  - @plitzi/sdk-navigation@0.32.6
  - @plitzi/sdk-schema@0.32.6
  - @plitzi/sdk-shared@0.32.6
  - @plitzi/sdk-style@0.32.6

## 0.32.5

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.5
  - @plitzi/sdk-navigation@0.32.5
  - @plitzi/sdk-schema@0.32.5
  - @plitzi/sdk-shared@0.32.5
  - @plitzi/sdk-style@0.32.5

## 0.32.4

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.4
  - @plitzi/sdk-navigation@0.32.4
  - @plitzi/sdk-schema@0.32.4
  - @plitzi/sdk-shared@0.32.4
  - @plitzi/sdk-style@0.32.4

## 0.32.3

### Patch Changes

- v0.32.3
- Updated dependencies
  - @plitzi/nexus@0.32.3
  - @plitzi/sdk-navigation@0.32.3
  - @plitzi/sdk-schema@0.32.3
  - @plitzi/sdk-shared@0.32.3
  - @plitzi/sdk-style@0.32.3

## 0.32.2

### Patch Changes

- v0.32.2
- Updated dependencies
  - @plitzi/nexus@0.32.2
  - @plitzi/sdk-navigation@0.32.2
  - @plitzi/sdk-schema@0.32.2
  - @plitzi/sdk-shared@0.32.2
  - @plitzi/sdk-style@0.32.2

## 0.32.1

### Patch Changes

- v0.32.1
- Updated dependencies
  - @plitzi/nexus@0.32.1
  - @plitzi/sdk-navigation@0.32.1
  - @plitzi/sdk-schema@0.32.1
  - @plitzi/sdk-shared@0.32.1
  - @plitzi/sdk-style@0.32.1

## 0.32.0

### Minor Changes

- v0.32.0

### Patch Changes

- Updated dependencies
  - @plitzi/nexus@0.32.0
  - @plitzi/sdk-navigation@0.32.0
  - @plitzi/sdk-schema@0.32.0
  - @plitzi/sdk-shared@0.32.0
  - @plitzi/sdk-style@0.32.0

## 0.31.2

### Patch Changes

- v0.31.2
- Updated dependencies
  - @plitzi/nexus@0.31.2
  - @plitzi/sdk-navigation@0.31.2
  - @plitzi/sdk-schema@0.31.2
  - @plitzi/sdk-shared@0.31.2
  - @plitzi/sdk-style@0.31.2

## 0.31.1

### Patch Changes

- v0.31.1
- Updated dependencies
  - @plitzi/nexus@0.31.1
  - @plitzi/sdk-navigation@0.31.1
  - @plitzi/sdk-schema@0.31.1
  - @plitzi/sdk-shared@0.31.1
  - @plitzi/sdk-style@0.31.1

## 0.31.0

### Minor Changes

- v0.31.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-navigation@0.31.0
  - @plitzi/sdk-schema@0.31.0
  - @plitzi/sdk-shared@0.31.0
  - @plitzi/nexus@0.31.0
  - @plitzi/sdk-style@0.31.0

## 0.30.19

### Patch Changes

- v0.30.19
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.19
  - @plitzi/sdk-navigation@0.30.19
  - @plitzi/sdk-schema@0.30.19
  - @plitzi/sdk-shared@0.30.19
  - @plitzi/nexus@0.30.19
  - @plitzi/sdk-style@0.30.19

## 0.30.18

### Patch Changes

- v0.30.18
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.18
  - @plitzi/sdk-navigation@0.30.18
  - @plitzi/sdk-schema@0.30.18
  - @plitzi/sdk-shared@0.30.18
  - @plitzi/nexus@0.30.18
  - @plitzi/sdk-style@0.30.18

## 0.30.17

### Patch Changes

- v0.31.0
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.17
  - @plitzi/sdk-navigation@0.30.17
  - @plitzi/sdk-schema@0.30.17
  - @plitzi/sdk-shared@0.30.17
  - @plitzi/nexus@0.30.17
  - @plitzi/sdk-style@0.30.17

## 0.30.16

### Patch Changes

- v0.30.16
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.16
  - @plitzi/sdk-navigation@0.30.16
  - @plitzi/sdk-schema@0.30.16
  - @plitzi/sdk-shared@0.30.16
  - @plitzi/sdk-style@0.30.16

## 0.30.15

### Patch Changes

- v0.30.15
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.15
  - @plitzi/sdk-navigation@0.30.15
  - @plitzi/sdk-schema@0.30.15
  - @plitzi/sdk-shared@0.30.15
  - @plitzi/sdk-style@0.30.15

## 0.30.14

### Patch Changes

- v0.30.14
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.14
  - @plitzi/sdk-navigation@0.30.14
  - @plitzi/sdk-schema@0.30.14
  - @plitzi/sdk-shared@0.30.14
  - @plitzi/sdk-style@0.30.14

## 0.30.13

### Patch Changes

- v0.30.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.13
  - @plitzi/sdk-navigation@0.30.13
  - @plitzi/sdk-schema@0.30.13
  - @plitzi/sdk-shared@0.30.13
  - @plitzi/sdk-style@0.30.13

## 0.30.12

### Patch Changes

- v0.30.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.12
  - @plitzi/sdk-navigation@0.30.12
  - @plitzi/sdk-schema@0.30.12
  - @plitzi/sdk-shared@0.30.12
  - @plitzi/sdk-style@0.30.12

## 0.30.11

### Patch Changes

- v0.30.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.11
  - @plitzi/sdk-navigation@0.30.11
  - @plitzi/sdk-schema@0.30.11
  - @plitzi/sdk-shared@0.30.11
  - @plitzi/sdk-style@0.30.11

## 0.30.10

### Patch Changes

- v0.30.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.10
  - @plitzi/sdk-navigation@0.30.10
  - @plitzi/sdk-schema@0.30.10
  - @plitzi/sdk-shared@0.30.10
  - @plitzi/sdk-style@0.30.10

## 0.30.9

### Patch Changes

- v0.30.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.9
  - @plitzi/sdk-navigation@0.30.9
  - @plitzi/sdk-schema@0.30.9
  - @plitzi/sdk-shared@0.30.9
  - @plitzi/sdk-style@0.30.9

## 0.30.8

### Patch Changes

- v0.30.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.8
  - @plitzi/sdk-navigation@0.30.8
  - @plitzi/sdk-schema@0.30.8
  - @plitzi/sdk-shared@0.30.8
  - @plitzi/sdk-style@0.30.8

## 0.30.7

### Patch Changes

- v0.30.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.7
  - @plitzi/sdk-navigation@0.30.7
  - @plitzi/sdk-schema@0.30.7
  - @plitzi/sdk-shared@0.30.7
  - @plitzi/sdk-style@0.30.7

## 0.30.6

### Patch Changes

- v0.30.6
- Updated dependencies
  - @plitzi/sdk-shared@0.30.6
  - @plitzi/sdk-style@0.30.6
  - @plitzi/sdk-data-source@0.30.6
  - @plitzi/sdk-navigation@0.30.6
  - @plitzi/sdk-schema@0.30.6

## 0.30.5

### Patch Changes

- v0.30.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.5
  - @plitzi/sdk-navigation@0.30.5
  - @plitzi/sdk-schema@0.30.5
  - @plitzi/sdk-shared@0.30.5
  - @plitzi/sdk-style@0.30.5

## 0.30.4

### Patch Changes

- v0.30.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.4
  - @plitzi/sdk-navigation@0.30.4
  - @plitzi/sdk-schema@0.30.4
  - @plitzi/sdk-shared@0.30.4
  - @plitzi/sdk-style@0.30.4

## 0.30.3

### Patch Changes

- v0.30.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.3
  - @plitzi/sdk-navigation@0.30.3
  - @plitzi/sdk-schema@0.30.3
  - @plitzi/sdk-shared@0.30.3
  - @plitzi/sdk-style@0.30.3

## 0.30.2

### Patch Changes

- v0.30.2
- Updated dependencies
  - @plitzi/sdk-navigation@0.30.2
  - @plitzi/sdk-schema@0.30.2
  - @plitzi/sdk-shared@0.30.2
  - @plitzi/sdk-style@0.30.2
  - @plitzi/sdk-data-source@0.30.2

## 0.30.1

### Patch Changes

- v0.30.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.1
  - @plitzi/sdk-navigation@0.30.1
  - @plitzi/sdk-schema@0.30.1
  - @plitzi/sdk-shared@0.30.1
  - @plitzi/sdk-style@0.30.1

## 0.30.0

### Minor Changes

- v0.30.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.30.0
  - @plitzi/sdk-navigation@0.30.0
  - @plitzi/sdk-schema@0.30.0
  - @plitzi/sdk-shared@0.30.0
  - @plitzi/sdk-style@0.30.0

## 0.29.0

### Minor Changes

- v0.29.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.29.0
  - @plitzi/sdk-navigation@0.29.0
  - @plitzi/sdk-schema@0.29.0
  - @plitzi/sdk-shared@0.29.0
  - @plitzi/sdk-style@0.29.0

## 0.28.14

### Patch Changes

- v0.28.14
- Updated dependencies
  - @plitzi/sdk-shared@0.28.14
  - @plitzi/sdk-data-source@0.28.14
  - @plitzi/sdk-navigation@0.28.14
  - @plitzi/sdk-schema@0.28.14
  - @plitzi/sdk-style@0.28.14

## 0.28.13

### Patch Changes

- v0.28.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.13
  - @plitzi/sdk-navigation@0.28.13
  - @plitzi/sdk-schema@0.28.13
  - @plitzi/sdk-shared@0.28.13
  - @plitzi/sdk-style@0.28.13

## 0.28.12

### Patch Changes

- v0.28.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.12
  - @plitzi/sdk-navigation@0.28.12
  - @plitzi/sdk-schema@0.28.12
  - @plitzi/sdk-shared@0.28.12
  - @plitzi/sdk-style@0.28.12

## 0.28.11

### Patch Changes

- v0.28.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.11
  - @plitzi/sdk-navigation@0.28.11
  - @plitzi/sdk-schema@0.28.11
  - @plitzi/sdk-shared@0.28.11
  - @plitzi/sdk-style@0.28.11

## 0.28.10

### Patch Changes

- v0.28.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.10
  - @plitzi/sdk-navigation@0.28.10
  - @plitzi/sdk-schema@0.28.10
  - @plitzi/sdk-shared@0.28.10
  - @plitzi/sdk-style@0.28.10

## 0.28.9

### Patch Changes

- v0.28.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.9
  - @plitzi/sdk-navigation@0.28.9
  - @plitzi/sdk-schema@0.28.9
  - @plitzi/sdk-shared@0.28.9
  - @plitzi/sdk-style@0.28.9

## 0.28.8

### Patch Changes

- v0.28.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.8
  - @plitzi/sdk-navigation@0.28.8
  - @plitzi/sdk-schema@0.28.8
  - @plitzi/sdk-shared@0.28.8
  - @plitzi/sdk-style@0.28.8

## 0.28.7

### Patch Changes

- v0.28.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.7
  - @plitzi/sdk-navigation@0.28.7
  - @plitzi/sdk-schema@0.28.7
  - @plitzi/sdk-shared@0.28.7
  - @plitzi/sdk-style@0.28.7

## 0.28.6

### Patch Changes

- v0.28.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.6
  - @plitzi/sdk-navigation@0.28.6
  - @plitzi/sdk-schema@0.28.6
  - @plitzi/sdk-shared@0.28.6
  - @plitzi/sdk-style@0.28.6

## 0.28.5

### Patch Changes

- v0.28.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.5
  - @plitzi/sdk-navigation@0.28.5
  - @plitzi/sdk-schema@0.28.5
  - @plitzi/sdk-shared@0.28.5
  - @plitzi/sdk-style@0.28.5

## 0.28.4

### Patch Changes

- v0.28.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.4
  - @plitzi/sdk-navigation@0.28.4
  - @plitzi/sdk-schema@0.28.4
  - @plitzi/sdk-shared@0.28.4
  - @plitzi/sdk-style@0.28.4

## 0.28.3

### Patch Changes

- v0.28.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.3
  - @plitzi/sdk-navigation@0.28.3
  - @plitzi/sdk-schema@0.28.3
  - @plitzi/sdk-shared@0.28.3
  - @plitzi/sdk-style@0.28.3

## 0.28.2

### Patch Changes

- v0.28.2
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.2
  - @plitzi/sdk-navigation@0.28.2
  - @plitzi/sdk-schema@0.28.2
  - @plitzi/sdk-shared@0.28.2
  - @plitzi/sdk-style@0.28.2

## 0.28.1

### Patch Changes

- v0.28.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.1
  - @plitzi/sdk-navigation@0.28.1
  - @plitzi/sdk-schema@0.28.1
  - @plitzi/sdk-shared@0.28.1
  - @plitzi/sdk-style@0.28.1

## 0.28.0

### Minor Changes

- v0.28.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.28.0
  - @plitzi/sdk-navigation@0.28.0
  - @plitzi/sdk-schema@0.28.0
  - @plitzi/sdk-shared@0.28.0
  - @plitzi/sdk-style@0.28.0

## 0.27.23

### Patch Changes

- v0.27.23
- Updated dependencies
  - @plitzi/sdk-shared@0.27.23
  - @plitzi/sdk-data-source@0.27.23
  - @plitzi/sdk-navigation@0.27.23
  - @plitzi/sdk-schema@0.27.23
  - @plitzi/sdk-style@0.27.23

## 0.27.22

### Patch Changes

- v0.27.22
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.22
  - @plitzi/sdk-navigation@0.27.22
  - @plitzi/sdk-schema@0.27.22
  - @plitzi/sdk-shared@0.27.22
  - @plitzi/sdk-style@0.27.22

## 0.27.21

### Patch Changes

- v0.27.21
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.21
  - @plitzi/sdk-navigation@0.27.21
  - @plitzi/sdk-schema@0.27.21
  - @plitzi/sdk-shared@0.27.21
  - @plitzi/sdk-style@0.27.21

## 0.27.20

### Patch Changes

- v0.27.20
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.20
  - @plitzi/sdk-navigation@0.27.20
  - @plitzi/sdk-schema@0.27.20
  - @plitzi/sdk-shared@0.27.20
  - @plitzi/sdk-style@0.27.20

## 0.27.19

### Patch Changes

- v0.27.19
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.19
  - @plitzi/sdk-navigation@0.27.19
  - @plitzi/sdk-schema@0.27.19
  - @plitzi/sdk-shared@0.27.19
  - @plitzi/sdk-style@0.27.19

## 0.27.18

### Patch Changes

- v0.27.18
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.18
  - @plitzi/sdk-navigation@0.27.18
  - @plitzi/sdk-schema@0.27.18
  - @plitzi/sdk-shared@0.27.18
  - @plitzi/sdk-style@0.27.18

## 0.27.17

### Patch Changes

- v0.27.17
- Updated dependencies
  - @plitzi/sdk-shared@0.27.17
  - @plitzi/sdk-style@0.27.17
  - @plitzi/sdk-data-source@0.27.17
  - @plitzi/sdk-navigation@0.27.17
  - @plitzi/sdk-schema@0.27.17

## 0.27.16

### Patch Changes

- v0.27.16
- Updated dependencies
  - @plitzi/sdk-shared@0.27.16
  - @plitzi/sdk-data-source@0.27.16
  - @plitzi/sdk-navigation@0.27.16
  - @plitzi/sdk-schema@0.27.16
  - @plitzi/sdk-style@0.27.16

## 0.27.15

### Patch Changes

- v0.27.15
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.15
  - @plitzi/sdk-navigation@0.27.15
  - @plitzi/sdk-schema@0.27.15
  - @plitzi/sdk-shared@0.27.15

## 0.27.14

### Patch Changes

- v0.27.14
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.14
  - @plitzi/sdk-navigation@0.27.14
  - @plitzi/sdk-schema@0.27.14
  - @plitzi/sdk-shared@0.27.14

## 0.27.13

### Patch Changes

- v0.27.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.13
  - @plitzi/sdk-navigation@0.27.13
  - @plitzi/sdk-schema@0.27.13
  - @plitzi/sdk-shared@0.27.13

## 0.27.12

### Patch Changes

- v0.27.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.12
  - @plitzi/sdk-navigation@0.27.12
  - @plitzi/sdk-schema@0.27.12
  - @plitzi/sdk-shared@0.27.12

## 0.27.11

### Patch Changes

- v0.27.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.11
  - @plitzi/sdk-navigation@0.27.11
  - @plitzi/sdk-schema@0.27.11
  - @plitzi/sdk-shared@0.27.11

## 0.27.10

### Patch Changes

- v0.27.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.10
  - @plitzi/sdk-navigation@0.27.10
  - @plitzi/sdk-schema@0.27.10
  - @plitzi/sdk-shared@0.27.10

## 0.27.9

### Patch Changes

- v0.27.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.9
  - @plitzi/sdk-navigation@0.27.9
  - @plitzi/sdk-schema@0.27.9
  - @plitzi/sdk-shared@0.27.9

## 0.27.8

### Patch Changes

- v0.27.8
- Updated dependencies
  - @plitzi/sdk-shared@0.27.8
  - @plitzi/sdk-data-source@0.27.8
  - @plitzi/sdk-navigation@0.27.8
  - @plitzi/sdk-schema@0.27.8

## 0.27.7

### Patch Changes

- v0.27.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.7
  - @plitzi/sdk-navigation@0.27.7
  - @plitzi/sdk-schema@0.27.7
  - @plitzi/sdk-shared@0.27.7

## 0.27.6

### Patch Changes

- v0.27.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.6
  - @plitzi/sdk-navigation@0.27.6
  - @plitzi/sdk-schema@0.27.6
  - @plitzi/sdk-shared@0.27.6

## 0.27.5

### Patch Changes

- v0.27.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.5
  - @plitzi/sdk-navigation@0.27.5
  - @plitzi/sdk-schema@0.27.5
  - @plitzi/sdk-shared@0.27.5

## 0.27.4

### Patch Changes

- v0.27.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.4
  - @plitzi/sdk-navigation@0.27.4
  - @plitzi/sdk-schema@0.27.4
  - @plitzi/sdk-shared@0.27.4

## 0.27.3

### Patch Changes

- v0.27.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.3
  - @plitzi/sdk-navigation@0.27.3
  - @plitzi/sdk-schema@0.27.3
  - @plitzi/sdk-shared@0.27.3

## 0.27.2

### Patch Changes

- v0.27.2
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.2
  - @plitzi/sdk-navigation@0.27.2
  - @plitzi/sdk-schema@0.27.2
  - @plitzi/sdk-shared@0.27.2

## 0.27.1

### Patch Changes

- v0.27.1
- Updated dependencies
  - @plitzi/sdk-navigation@0.27.1
  - @plitzi/sdk-shared@0.27.1
  - @plitzi/sdk-data-source@0.27.1
  - @plitzi/sdk-schema@0.27.1

## 0.27.0

### Minor Changes

- v0.27.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.27.0
  - @plitzi/sdk-navigation@0.27.0
  - @plitzi/sdk-schema@0.27.0
  - @plitzi/sdk-shared@0.27.0

## 0.26.5

### Patch Changes

- v0.26.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.5
  - @plitzi/sdk-navigation@0.26.5
  - @plitzi/sdk-schema@0.26.5
  - @plitzi/sdk-shared@0.26.5

## 0.26.4

### Patch Changes

- v0.26.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.4
  - @plitzi/sdk-navigation@0.26.4
  - @plitzi/sdk-schema@0.26.4
  - @plitzi/sdk-shared@0.26.4

## 0.26.3

### Patch Changes

- v0.26.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.3
  - @plitzi/sdk-navigation@0.26.3
  - @plitzi/sdk-schema@0.26.3
  - @plitzi/sdk-shared@0.26.3

## 0.26.2

### Patch Changes

- v0.26.2
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.2
  - @plitzi/sdk-navigation@0.26.2
  - @plitzi/sdk-schema@0.26.2
  - @plitzi/sdk-shared@0.26.2

## 0.26.1

### Patch Changes

- v0.26.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.1
  - @plitzi/sdk-navigation@0.26.1
  - @plitzi/sdk-schema@0.26.1
  - @plitzi/sdk-shared@0.26.1

## 0.26.0

### Minor Changes

- v0.26.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.26.0
  - @plitzi/sdk-navigation@0.26.0
  - @plitzi/sdk-schema@0.26.0
  - @plitzi/sdk-shared@0.26.0

## 0.25.12

### Patch Changes

- v0.25.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.12
  - @plitzi/sdk-navigation@0.25.12
  - @plitzi/sdk-schema@0.25.12
  - @plitzi/sdk-shared@0.25.12

## 0.25.11

### Patch Changes

- v0.25.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.11
  - @plitzi/sdk-navigation@0.25.11
  - @plitzi/sdk-schema@0.25.11
  - @plitzi/sdk-shared@0.25.11

## 0.25.10

### Patch Changes

- v0.25.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.10
  - @plitzi/sdk-navigation@0.25.10
  - @plitzi/sdk-schema@0.25.10
  - @plitzi/sdk-shared@0.25.10

## 0.25.9

### Patch Changes

- v0.25.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.9
  - @plitzi/sdk-navigation@0.25.9
  - @plitzi/sdk-schema@0.25.9
  - @plitzi/sdk-shared@0.25.9

## 0.25.8

### Patch Changes

- v0.25.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.8
  - @plitzi/sdk-navigation@0.25.8
  - @plitzi/sdk-schema@0.25.8
  - @plitzi/sdk-shared@0.25.8

## 0.25.7

### Patch Changes

- v0.25.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.7
  - @plitzi/sdk-navigation@0.25.7
  - @plitzi/sdk-schema@0.25.7
  - @plitzi/sdk-shared@0.25.7

## 0.25.6

### Patch Changes

- v0.25.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.6
  - @plitzi/sdk-navigation@0.25.6
  - @plitzi/sdk-schema@0.25.6
  - @plitzi/sdk-shared@0.25.6

## 0.25.5

### Patch Changes

- v0.25.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.5
  - @plitzi/sdk-navigation@0.25.5
  - @plitzi/sdk-schema@0.25.5
  - @plitzi/sdk-shared@0.25.5

## 0.25.4

### Patch Changes

- v0.25.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.4
  - @plitzi/sdk-navigation@0.25.4
  - @plitzi/sdk-schema@0.25.4
  - @plitzi/sdk-shared@0.25.4

## 0.25.3

### Patch Changes

- v0.25.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.3
  - @plitzi/sdk-navigation@0.25.3
  - @plitzi/sdk-schema@0.25.3
  - @plitzi/sdk-shared@0.25.3

## 0.25.2

### Patch Changes

- v0.25.2
- Updated dependencies
  - @plitzi/sdk-navigation@0.25.2
  - @plitzi/sdk-schema@0.25.2
  - @plitzi/sdk-shared@0.25.2
  - @plitzi/sdk-data-source@0.25.2

## 0.25.1

### Patch Changes

- v0.25.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.1
  - @plitzi/sdk-navigation@0.25.1
  - @plitzi/sdk-schema@0.25.1
  - @plitzi/sdk-shared@0.25.1

## 0.25.0

### Minor Changes

- v0.25.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.25.0
  - @plitzi/sdk-navigation@0.25.0
  - @plitzi/sdk-schema@0.25.0
  - @plitzi/sdk-shared@0.25.0

## 0.24.12

### Patch Changes

- v0.24.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.12
  - @plitzi/sdk-navigation@0.24.12
  - @plitzi/sdk-schema@0.24.12
  - @plitzi/sdk-shared@0.24.12

## 0.24.11

### Patch Changes

- v0.24.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.11
  - @plitzi/sdk-navigation@0.24.11
  - @plitzi/sdk-schema@0.24.11
  - @plitzi/sdk-shared@0.24.11

## 0.24.10

### Patch Changes

- v0.24.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.10
  - @plitzi/sdk-navigation@0.24.10
  - @plitzi/sdk-schema@0.24.10
  - @plitzi/sdk-shared@0.24.10

## 0.24.9

### Patch Changes

- v0.24.9
- Updated dependencies
  - @plitzi/sdk-shared@0.24.9
  - @plitzi/sdk-data-source@0.24.9
  - @plitzi/sdk-navigation@0.24.9
  - @plitzi/sdk-schema@0.24.9

## 0.24.8

### Patch Changes

- v0.24.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.8
  - @plitzi/sdk-navigation@0.24.8
  - @plitzi/sdk-schema@0.24.8
  - @plitzi/sdk-shared@0.24.8

## 0.24.7

### Patch Changes

- v0.24.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.7
  - @plitzi/sdk-navigation@0.24.7
  - @plitzi/sdk-schema@0.24.7
  - @plitzi/sdk-shared@0.24.7

## 0.24.6

### Patch Changes

- v0.24.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.6
  - @plitzi/sdk-navigation@0.24.6
  - @plitzi/sdk-schema@0.24.6
  - @plitzi/sdk-shared@0.24.6

## 0.24.5

### Patch Changes

- v0.24.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.5
  - @plitzi/sdk-navigation@0.24.5
  - @plitzi/sdk-schema@0.24.5
  - @plitzi/sdk-shared@0.24.5

## 0.24.4

### Patch Changes

- v0.24.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.4
  - @plitzi/sdk-navigation@0.24.4
  - @plitzi/sdk-schema@0.24.4
  - @plitzi/sdk-shared@0.24.4

## 0.24.3

### Patch Changes

- v0.24.3
- Updated dependencies
  - @plitzi/sdk-schema@0.24.3
  - @plitzi/sdk-data-source@0.24.3
  - @plitzi/sdk-navigation@0.24.3
  - @plitzi/sdk-shared@0.24.3

## 0.24.2

### Patch Changes

- v0.24.2
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.2
  - @plitzi/sdk-navigation@0.24.2
  - @plitzi/sdk-schema@0.24.2
  - @plitzi/sdk-shared@0.24.2

## 0.24.1

### Patch Changes

- v0.24.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.1
  - @plitzi/sdk-navigation@0.24.1
  - @plitzi/sdk-schema@0.24.1
  - @plitzi/sdk-shared@0.24.1

## 0.24.0

### Minor Changes

- v0.24.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.24.0
  - @plitzi/sdk-navigation@0.24.0
  - @plitzi/sdk-schema@0.24.0
  - @plitzi/sdk-shared@0.24.0

## 0.23.24

### Patch Changes

- v0.23.24
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.24
  - @plitzi/sdk-navigation@0.23.24
  - @plitzi/sdk-schema@0.23.24
  - @plitzi/sdk-shared@0.23.24

## 0.23.23

### Patch Changes

- v0.23.23
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.23
  - @plitzi/sdk-navigation@0.23.23
  - @plitzi/sdk-schema@0.23.23
  - @plitzi/sdk-shared@0.23.23

## 0.23.22

### Patch Changes

- v0.23.22
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.22
  - @plitzi/sdk-navigation@0.23.22
  - @plitzi/sdk-schema@0.23.22
  - @plitzi/sdk-shared@0.23.22

## 0.23.21

### Patch Changes

- v0.23.21
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.21
  - @plitzi/sdk-navigation@0.23.21
  - @plitzi/sdk-schema@0.23.21
  - @plitzi/sdk-shared@0.23.21

## 0.23.20

### Patch Changes

- v0.23.20
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.20
  - @plitzi/sdk-navigation@0.23.20
  - @plitzi/sdk-schema@0.23.20
  - @plitzi/sdk-shared@0.23.20

## 0.23.19

### Patch Changes

- v0.23.19
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.19
  - @plitzi/sdk-navigation@0.23.19
  - @plitzi/sdk-schema@0.23.19
  - @plitzi/sdk-shared@0.23.19

## 0.23.18

### Patch Changes

- v0.23.18
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.18
  - @plitzi/sdk-navigation@0.23.18
  - @plitzi/sdk-schema@0.23.18
  - @plitzi/sdk-shared@0.23.18

## 0.23.17

### Patch Changes

- v0.23.17
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.17
  - @plitzi/sdk-navigation@0.23.17
  - @plitzi/sdk-schema@0.23.17
  - @plitzi/sdk-shared@0.23.17

## 0.23.16

### Patch Changes

- v0.23.16
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.16
  - @plitzi/sdk-navigation@0.23.16
  - @plitzi/sdk-schema@0.23.16
  - @plitzi/sdk-shared@0.23.16

## 0.23.15

### Patch Changes

- v0.23.15
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.15
  - @plitzi/sdk-navigation@0.23.15
  - @plitzi/sdk-schema@0.23.15
  - @plitzi/sdk-shared@0.23.15

## 0.23.14

### Patch Changes

- v0.23.14
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.14
  - @plitzi/sdk-navigation@0.23.14
  - @plitzi/sdk-schema@0.23.14
  - @plitzi/sdk-shared@0.23.14

## 0.23.13

### Patch Changes

- v0.23.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.13
  - @plitzi/sdk-navigation@0.23.13
  - @plitzi/sdk-schema@0.23.13
  - @plitzi/sdk-shared@0.23.13

## 0.23.12

### Patch Changes

- v0.23.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.12
  - @plitzi/sdk-navigation@0.23.12
  - @plitzi/sdk-schema@0.23.12
  - @plitzi/sdk-shared@0.23.12

## 0.23.11

### Patch Changes

- v0.23.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.11
  - @plitzi/sdk-navigation@0.23.11
  - @plitzi/sdk-schema@0.23.11
  - @plitzi/sdk-shared@0.23.11

## 0.23.10

### Patch Changes

- v0.23.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.10
  - @plitzi/sdk-navigation@0.23.10
  - @plitzi/sdk-schema@0.23.10
  - @plitzi/sdk-shared@0.23.10

## 0.23.9

### Patch Changes

- v0.23.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.9
  - @plitzi/sdk-navigation@0.23.9
  - @plitzi/sdk-schema@0.23.9
  - @plitzi/sdk-shared@0.23.9

## 0.23.8

### Patch Changes

- v0.23.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.8
  - @plitzi/sdk-navigation@0.23.8
  - @plitzi/sdk-schema@0.23.8
  - @plitzi/sdk-shared@0.23.8

## 0.23.7

### Patch Changes

- v0.23.7
- Updated dependencies
  - @plitzi/sdk-shared@0.23.7
  - @plitzi/sdk-data-source@0.23.7
  - @plitzi/sdk-navigation@0.23.7
  - @plitzi/sdk-schema@0.23.7

## 0.23.6

### Patch Changes

- v0.23.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.6
  - @plitzi/sdk-navigation@0.23.6
  - @plitzi/sdk-schema@0.23.6
  - @plitzi/sdk-shared@0.23.6

## 0.23.5

### Patch Changes

- v0.23.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.5
  - @plitzi/sdk-navigation@0.23.5
  - @plitzi/sdk-schema@0.23.5
  - @plitzi/sdk-shared@0.23.5

## 0.23.4

### Patch Changes

- v0.23.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.4
  - @plitzi/sdk-navigation@0.23.4
  - @plitzi/sdk-schema@0.23.4
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

## 0.23.0

### Minor Changes

- v0.23.0

## 0.22.20

### Patch Changes

- v0.22.20

## 0.22.19

### Patch Changes

- v0.22.19

## 0.22.18

### Patch Changes

- v0.22.18

## 0.22.17

### Patch Changes

- v0.22.17

## 0.22.16

### Patch Changes

- v0.22.16

## 0.22.15

### Patch Changes

- v0.22.15

## 0.22.14

### Patch Changes

- v0.22.14

## 0.22.13

### Patch Changes

- v0.22.13

## 0.22.12

### Patch Changes

- v0.22.12

## 0.22.11

### Patch Changes

- v0.22.11

## 0.22.10

### Patch Changes

- v0.22.10
