---
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
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
---

## Security

- **A write another site caused is refused, cookie or none** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`): the page
  server guarded nothing it answers past `/auth` — a server action (`/_action`), a realtime publish, a space's `/fn/`
  route, its runtime's endpoints, the deployment's own `data` stages, the adapter-only `loginPath`, `logoutPath` and
  `exchangePath`. A plain `text/plain` POST from any page open in the same browser ran them, with the visitor's session
  cookie when there was one (`SameSite=None` off this machine) and, in a project nobody signs in to, as whoever holds
  the server's own credentials. Every unsafe request a browser says another site caused (`Sec-Fetch-Site: cross-site`,
  or a foreign `Origin`) is now refused `403 reason: 'foreign'`, saying how to allow it: `crossSiteWrites.origins`
  (with `auth`, `identity.platformOrigins` too) and `crossSiteWrites.paths` for a form other sites post to by design.
  `Authorization`, and callers that are not browsers — webhooks, scripts — pass as before. One rule for this and the
  sign-in check (`crossSiteRequest`, `csrf.ts`). A self-hosted runtime's endpoints now sit where the platform forwards a
  space's — after the auth chain and this guard (`data`, was `preAuth`).

## Testing

- **`page check` and `page shot` anywhere the project is served** (`@plitzi/cli`): `--url <origin>` for a second server
  of it, staging or a deploy, instead of `npm start`'s port; `page check --space <module>` holds the pages to that space
  instead of the project's — an agent's page — authored with `authorIsolated`.
- **A route with a query is checked as its page** (`@plitzi/cli`): `page check "/?v=2"` matched the query as part of
  the path, found no page, and checked the space's "not found" page in its place.

- **What an element that chooses its children draws is checked** (`@plitzi/sdk-authoring`, `@plitzi/cli`): with
  `choosesChildren`, the page checks owed none of its children — and checked none of them either: a dashboard drawing
  three panels reported `checked: 1`. Each child it may draw, and what is inside one under no condition of its own,
  now carries `shownWith` (the child it comes with) on its handle: once that child is on screen it and everything
  named in it are owed like the rest of the page, and `checked` counts them. `onScreenIfChosen(handles, page)` lists
  them.
- **A page that met a server error is looked at once more** (`@plitzi/cli`): `page check` and `verify` failed a page
  for a `500` from somebody else's service having a bad second (`/fn/<space>/weather`), and passed on the next run with
  nothing changed. A page whose requests got a `5xx` is checked again once; its report is the second look, and says
  what failed the first time (`retriedAfter`). A `4xx` fails the same way twice, and is never retried.

## Plugins

- **`useNotify`** (`@plitzi/plitzi-sdk`): a plugin shows the page's notifications — `notify('Deleted 79 recordings', {
  appearance: 'danger' })` — the same toasts an `addNotification` step shows, in the space's theme and `notifications`
  look, with no trigger, flow or `window` event of the space's to wire. The step's vocabulary (`NOTIFICATION_PLACEMENTS`,
  `NOTIFICATION_APPEARANCES`, `NOTIFICATION_DEFAULTS`) is one list in `@plitzi/sdk-shared`, read by both.
- **`appearance: 'danger'` looks like one** (`@plitzi/plitzi-sdk`): it reached the toast library as a type it does not
  know, so a danger notification showed neither the error icon nor the colour `notifications.danger` sets.
  A value a notification does not take — from a flow, or a plugin in plain JavaScript — is set aside by name and said
  in the console, rather than shown as the default in silence (`readNotificationOptions`, `@plitzi/sdk-shared`).
- **`useServerAction`** (`@plitzi/plitzi-sdk`, `@plitzi/sdk-authoring`, `@plitzi/sdk-interactions`,
  `@plitzi/sdk-server`): a plugin runs one of the space's server actions, awaited —
  `useServerAction<typeof habitDone>('habits-done')({ id })` answers `{ ok, output }` or `{ ok: false, reason, error }`
  — through the `runServerAction` step itself: the same access, refusals, session handling and dev-tools entry.
  `defineAction` keeps the literal types of its `call` way in, so the input is typed by the fields it declares (the
  required ones required); `taskAction` types both ends from the task's `run`, and `FunctionTask<T, R>` takes what
  `run` answers. `CallInputOf` / `CallOutputOf` read them. One operation is one action, never a `case` in one route.
  What a run answers is typed (`ServerActionStatus`): a status the server never uses reads as a run that did not
  complete, never as one that did.
  The key those types ride under (`CALL_TYPES`) is exported, by `@plitzi/sdk-shared` and `@plitzi/sdk-authoring` with
  `TypedActionEntry`, `CallInputOf` and `CallOutputOf`: a package that emits declarations could not write the type of an
  action it exports (`TS4023` on every `export const actions = [defineAction(…)]`).
- **A plugin is drawn on the server first** (docs): a preference per device belongs in kept state (`keepState`,
  `paintedState`) as a bound prop, never read from `localStorage` while rendering — React discards the whole tree on the
  mismatch, and only in the browser of whoever saved something. `@plitzi/plitzi-ui` is not the page's: a plugin
  importing it bundles its own copy, with its own contexts and its own look. The authoring skill's `plugin-reach.md`
  says what a plugin says and to whom: a notification, another element (an event and the space's flow), a server
  action, shared state, other pages.

## Realtime

- **A channel that retains** (`@plitzi/sdk-shared`, `@plitzi/sdk-server`, `@plitzi/sdk-elements`): declared
  `retain: true` (with `publish: 'server'`, which authoring requires), the server keeps the latest message of each type
  on a topic — said by `ctx.publish` or a flow's `realtime.publish` — and hands them to every page that joins, marked
  `retained`. A page reads them as `<channel>.retained.<type>`, a plugin as `useChannel(topic).retained`, the newest of
  a type holding whichever order they arrive in; `null` forgets a type. Kept in the store the actions' `kv` uses (beside
  the grants, by compare-and-swap), so every replica hands out the same; a topic keeps at most 64 types and 512 KB, and
  a publish past that is refused before anything is sent. State every screen shares is one publish and one binding —
  no kv key, initial read or copy in `state` of the project's own. The fleet store `realtime.grants` is now
  `realtime.kv`.
- **The MCP writes every field a channel takes** (`@plitzi/sdk-mcp`): `patchSettings`'s channel had no `grant` — which
  the guide taught — nor `retain` or the limits, so an agent could not declare a private channel at all. All are there
  now, and the guide says what `retain` is for and that `channel_<id>.retained` holds it.

## Authoring

- **`plitzi explain` knows every `@plitzi` package installed** (`@plitzi/cli`): a name that was not
  `@plitzi/sdk-authoring`'s (`createServer`, `createJsonAdapters`, `useChannel`) was answered as the project's own code,
  to `grep` in `src/`. It is read from the published types of every one installed, through their re-exports and entry
  points (`@plitzi/sdk-server/handlers`), and a name two packages export — `createServer` is sdk-server's and sdk-mcp's
  — is answered with both.

- **A space module somebody else wrote, authored where it reaches nothing** (`@plitzi/sdk-authoring`):
  `authorIsolated(file, { timeoutMs })` of `@plitzi/sdk-authoring/node` runs `authorSpace` on it in a process Node's
  permission model holds to reading the module's folder and its packages — no file written, no process started, no
  variable of the caller's environment — kills one that runs too long, and validates what it answers again, so a forged
  answer gains nothing. A refusal comes back as `authorSpace` says it, with the problems as data.
- **Pages an agent writes, served** (`@plitzi/sdk-server`): `createAuthoringHost({ dir, frameAncestors })` serves each
  space it is handed at an address of its own (`put(space, { id }) → /?__pt=<id>`) as a draft of its one space, kept in
  `dir` across restarts; `drop(id)` forgets one, and anything else answers `404` saying where the pages are.
- **A space is chosen by host or credential** (`@plitzi/sdk-server`, docs): `getSpaceDeployment` is asked on every
  request, and what a page fetches after it carries nothing of its address but the host — a space chosen by the page's
  query or path lost everything it asked for, and `/_plitzi/space/<hash>.json` answered a bare `404`. The contract and
  the README say so (the README offered "by path prefix"), and that `404` says why.

- **`plitzi explain on` says how to read what a trigger carries** (`@plitzi/sdk-authoring`): its doc sat above a
  helper, so `explain` printed only the signature. It now leads with `[named('picked', on('onPick')), …('{{ picked.seat
  }}')]`, and the CLI skill's plugin section says the same.
