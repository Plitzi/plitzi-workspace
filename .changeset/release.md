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

- **Editor:** each file has its own, with its own undo history. Opening another file no longer marks the one you
  left as changed. Before this, it could also write the newly opened file's text into the one you left. The cause was
  in `@plitzi/plitzi-ui`'s CodeMirror, fixed in 1.6.25, which every package now depends on. That release also sets
  code editors (several lines) in a monospaced face again.
- **Header:** says whether there are unsaved changes, and in how many files. ⌘S saves. Removing the functions is a
  quiet button beside Save, no longer a red one.
- **File list:** files are grouped by folder. A new one is named where the list starts (Enter adds it, Escape cancels).
- **Tasks:** each is a card with its title, what it does and how much time it gets, one click from Try.
- **Routes:** shown with their method and their `/fn` address.
- **Try:** fills a task's params the way its step does, from their defaults: a select, a switch or text. JSON stays a
  toggle away.

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
