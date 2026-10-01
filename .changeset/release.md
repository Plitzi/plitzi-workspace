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
