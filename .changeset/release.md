---
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

## Components replace segments

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
