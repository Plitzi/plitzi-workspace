# Pizarra — a collaborative whiteboard

An infinite board in a hand-drawn stroke: rectangles, diamonds, ellipses, arrows, lines, a pen, text and sticky notes.
Send the link and everyone on the board sees every shape, cursor, drag and rename the moment it happens — live
cursors with names, avatars of who is here, arrows fixed to what they connect, labels in shapes, a pile of sticky notes
to drag from, a laser pointer, reactions, following a collaborator's view, groups, stacking, undo and redo, a QR code to
join from a phone, export to PNG, light and dark.

```bash
yarn workspace @plitzi/example-whiteboard start
# http://127.0.0.1:4016/ — then open the same board in a second window
```

No account, no database, no Redis. One process keeps the boards in memory: a restart clears them.

---

## What this example is for

The others read data and show it. This one is about **pages that see each other**: realtime channels, the pub/sub
adapter behind them, and the split between what must be validated and kept (a shape) and what only has to be fast
(a cursor). It is the example to read before building anything multiplayer.

| File                                                                    | What it is                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`src/board/model.ts`](./src/board/model.ts)                            | What a board is made of, read by the browser and the server alike: the shapes, their validation, the merge |
| [`src/board/store.ts`](./src/board/store.ts)                            | Boards kept in the action `kv`: one value per board, a preview per board, the list the gallery reads       |
| [`src/tasks.ts`](./src/tasks.ts) · [`src/actions.ts`](./src/actions.ts) | Five tasks, and the actions that run them — `board-apply` ends with `realtime.publish`                     |
| [`src/space/`](./src/space)                                             | The gallery and the board page: toolbar, style panel, people, keyboard, one file each                      |
| [`src/plugins/Board/`](./src/plugins/Board)                             | The canvas: a scene, a camera, pointer gestures, rough.js drawing — and `useChannel` for cursors           |
| [`src/plugins/ShareCard/`](./src/plugins/ShareCard)                     | A QR code of the board's address, the link to copy, the system's share sheet                               |
| [`src/main.ts`](./src/main.ts)                                          | The server: `action` for the boards, `realtime` for the channels                                           |

---

## Two roads

```text
         pointer, drag, selection  ──▶  room:{id}   (publish: 'clients', presence)  ──▶  every other page
 page ──┤
         a commit (onCommit)       ──▶  board-apply ─▶ validate · merge · keep ─▶ realtime.publish ─▶ board:{id}  ──▶  every page
```

- **What must be agreed on goes through the server.** The canvas fires `onCommit` with the changed elements; a flow
  sends them to `board-apply` (queued, so they are kept in order). The action validates them, merges them element by
  element, keeps the board, and announces what each element now IS on `board:{id}` — a channel declared
  `publish: 'server'`, which no page can speak on. The canvas treats that announcement as the confirmation.
- **What only has to be fast goes page to page.** The cursor, what is being dragged and what is selected travel on
  `room:{id}` twenty times a second, straight between pages. Nothing on it is kept.

Both roads run over **one WebSocket per page** (`realtime: { transport: 'websocket' }` in `main.ts`): twenty cursor
updates a second are frames on a connection that is already open, not twenty requests. Where a socket cannot open —
behind HTTP/2, or a proxy that drops upgrades — the page falls back to a Server-Sent Events stream on its own.

**Conflicts** resolve per element, the same way on the server and every screen: a higher `version` wins, a tie goes to
the lower `nonce`. The server announces the winner, not the request, so a screen whose edit lost corrects itself the
moment the answer lands. **A refused commit** (too many changes at once, a full board) fires `onFlowError`: the page
calls the canvas's `rollback`, which drops every edit the server never confirmed. **A dropped connection** fires
`onResync` when it comes back, and the page reads the board again.

---

## What Plitzi does here, and what the components do

The canvas draws and takes the pointer; the share card asks the browser for the clipboard and the share sheet.
Everything else is authored.

| On screen                  | How                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A board in the first paint | `apiContainer` with `runtime: 'server'` naming `board-load`, a `render` action reading the route's `{{id}}`                                                                                                                                                                                                                                                                                                                     |
| The gallery                | `board-list`, rendered on the server; each card's thumbnail is the same canvas in `mode: 'view'`                                                                                                                                                                                                                                                                                                                                |
| …kept current              | A `channel` on `boards` whose `onMessage` flow waits 1.5 s (`whileRunning('skip')`) and reloads the list                                                                                                                                                                                                                                                                                                                        |
| New board                  | `board-create` answers an id; the flow navigates to `/b/{{ created.output.id }}`                                                                                                                                                                                                                                                                                                                                                |
| Tools                      | `state.tool`, set by the toolbar, the keys and the canvas's own `onToolChange` (back to select after a shape)                                                                                                                                                                                                                                                                                                                   |
| Style panel                | Stroke, fill, width: each click writes the state AND calls the canvas's `applyStyle` for the selection; `onSelectionChange` writes the selection's style back                                                                                                                                                                                                                                                                   |
| Selection tools            | Authored in the space as the canvas's CHILDREN; the canvas lays them beside whatever is selected and hides them while it is dragged: front, back, group, ungroup, duplicate, delete                                                                                                                                                                                                                                             |
| Groups                     | `group` on each element: a click picks up the whole group, a double-click goes into it; ⌘G / ⌘⇧G                                                                                                                                                                                                                                                                                                                                |
| Connectors                 | An arrow or a line drawn from or to a shape fixes to one of its four anchors (`start`/`end` on the element) and bends into a curve out of each side; drawn from INSIDE a shape, the sides that face each other are chosen. Resolved every time it is drawn, so it follows a shape however it moves, on every screen. Hover a shape for its connection points and drag from one; drag a selected connector's end to re-anchor it |
| Labels                     | Double-click inside a rectangle, ellipse or diamond: its text sits in the middle, wrapped to it                                                                                                                                                                                                                                                                                                                                 |
| Sticky pads                | The `stickyStack` element hands a note over on the pointer going down (`onPick`); the flow gives it to the canvas (`carry`). Dragged, it lands where it is let go; clicked, it follows the pointer until a click on the board — then it is open for typing                                                                                                                                                                      |
| Laser (K)                  | A trail that fades in a second, on every screen in the person's colour — the pointer messages say `laser: true` while it is held                                                                                                                                                                                                                                                                                                |
| Reactions                  | The tray's emoji call the canvas's `react`: it floats up where the person points and is sent on the room (`reaction`)                                                                                                                                                                                                                                                                                                           |
| Follow                     | Click an avatar: every pointer message carries its page's view, and this page shows the followed one's until the person here touches the board (`onFollowChange` → the banner)                                                                                                                                                                                                                                                  |
| Who is here                | A `channel` element on `room:{{ id }}` announcing `computed.me` (a name and colour picked at random, kept); the avatars are a list over `room.members`                                                                                                                                                                                                                                                                          |
| Cursors                    | The canvas reads the same room through `useChannel` — the page's one connection, and one member                                                                                                                                                                                                                                                                                                                                 |
| Rename                     | The title field saves on blur; `board-rename` announces `title` on the board's channel; a `channel` element there reloads the board                                                                                                                                                                                                                                                                                             |
| Keyboard                   | `onKey` flows on the board: a key per tool, ⌘Z/⌘⇧Z, ⌘D, ⌘A, ⌘G/⌘⇧G, `[`/`]`, `+`/`−`, `F`, ⌘0, Delete, `?`, Escape                                                                                                                                                                                                                                                                                                              |
| Theme                      | `themeToggle`; the canvas's colours are `--board-*` properties pointed at the space's tokens, read again on `theme.resolved`                                                                                                                                                                                                                                                                                                    |

---

## Taking it further

- **More than one process.** The pub/sub is in memory — right for one process and its workers. A second replica needs
  a shared one: `realtime: { pubsub: createRedisPubSub({ publisher, subscriber }) }` in `main.ts`, or any object with
  `publish` and `subscribe`.
- **Boards that survive a restart.** Hand `action.kv` an adapter that persists. `board.apply` reads, merges and writes
  under a queue that is this process's; several processes writing one board need a store that can compare-and-set.
- **Who may draw.** Every channel and action here is `public`. `access: { mode: 'session' }` on both is the whole
  change for a signed-in board.

See [`docs/en/realtime.md`](../../../docs/en/realtime.md) for channels in general.
