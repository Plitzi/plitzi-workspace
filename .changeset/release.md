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

## Testing

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
- **`useServerAction`** (`@plitzi/plitzi-sdk`, `@plitzi/sdk-authoring`, `@plitzi/sdk-interactions`,
  `@plitzi/sdk-server`): a plugin runs one of the space's server actions, awaited —
  `useServerAction<typeof habitDone>('habits-done')({ id })` answers `{ ok, output }` or `{ ok: false, reason, error }`
  — through the `runServerAction` step itself: the same access, refusals, session handling and dev-tools entry.
  `defineAction` keeps the literal types of its `call` way in, so the input is typed by the fields it declares (the
  required ones required); `taskAction` types both ends from the task's `run`, and `FunctionTask<T, R>` takes what
  `run` answers. `CallInputOf` / `CallOutputOf` read them. One operation is one action, never a `case` in one route.
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

## Authoring

- **`plitzi explain on` says how to read what a trigger carries** (`@plitzi/sdk-authoring`): its doc sat above a
  helper, so `explain` printed only the signature. It now leads with `[named('picked', on('onPick')), …('{{ picked.seat
  }}')]`, and the CLI skill's plugin section says the same.
