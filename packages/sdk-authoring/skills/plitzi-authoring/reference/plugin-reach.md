# What a plugin says, and to whom

A plugin reaches the person, the space's other elements, the server and the other screens each one way. All of it is
imported from `@plitzi/plitzi-sdk` — the page's copy, which every plugin shares — never from `window` events or a
module of the project's (each plugin is a bundle of its own: a module two of them import is two).

## To the person: `useNotify`

```tsx
import { useNotify } from '@plitzi/plitzi-sdk';

const notify = useNotify();
notify('Deleted 79 recordings');                                  // what an `addNotification` step shows
notify('Training failed', { appearance: 'danger', autoDismiss: false });
```

The page's own toasts, in the space's theme and with the look its `notifications` give them. For what only the plugin
knows; what the PAGE decides to say stays a flow (`on(…)` → `addNotification`).

## To another element: an event, and the space's flow

A plugin never calls another one. It fires what happened, and the space's flow decides who acts — visible in the
space, and the same flow a button can start:

```ts
// the assistant's declaration: triggers: { onOpenResult: { action: 'onOpenResult', preview: { index: 0 } } }
assistant({ id: 'jarvis', flows: [[
  named('asked', declaredTrigger(assistantDeclaration, 'onOpenResult')),
  declaredCallback(browserDeclaration, 'openResult', { on: 'browser', params: { index: '{{ asked.index }}' } })
]] })
```

The receiver declares the action (`callbacks`) and registers it from its declaration; a name either side does not
declare is refused when the space is authored.

## To the server: `useServerAction`

One operation is one server action — `taskAction(tasks.done, …)` or `defineAction(…)` — whose input the server checks
before any code runs, never a `case` in one route. A plugin runs it awaited, typed by the action:

```tsx
import { useServerAction } from '@plitzi/plitzi-sdk';
import type { habitDone } from '../../space/actions';

const done = useServerAction<typeof habitDone>('habits-done');
const result = await done({ id });          // the input its `call` way in declares
if (result.ok) { show(result.output.streak); } else { say(result.error ?? result.reason); }
```

The same run a flow's `runServerAction` makes: its `access`, its refusals, its entry in the dev tools; a completed run
refreshes the page's cached requests (`{ invalidateQueries: 'none' }` for one that only reads).

## State every screen shares: a channel that retains

What the server keeps and every page shows — a dashboard's lists, a board's settings — is a channel declared
`retain: true` (with `publish: 'server'`): the server keeps the latest message of each type and hands them to every
page that joins.

```ts
channels: { desk: { access: { mode: 'session' }, publish: 'server', retain: true } }

// the server, in a task, a route or a flow's `realtime.publish`: kept, and said to every page on it
await ctx.publish('desk', 'lists', lists);
await ctx.publish('desk', 'lists', null);   // forgotten

channel({ id: 'desk', topic: 'desk', children: [lists({ id: 'lists', bind: { lists: 'desk.retained.lists' } })] })
```

`useChannel('desk').retained.lists` is the same value in a plugin, re-rendering when it changes; what the page is
handed on joining reaches `onMessage` too, as if just said. A page changes it by
asking the server (an action), which keeps it and says it. A topic keeps at most 64 types and 512 KB.

## To other pages, at the speed of a cursor: `useChannel`

```tsx
const room = useChannel(roomTopic, { onMessage: message => move(message.from, message.data) });
room.publish('pointer', { x, y });   // throttle it: ~20 a second, the latest position each time
room.publish('react', { emoji }, { echo: true }); // and heard here too
room.members;                        // who is here, with the state each announced
```

Messages arrive through the callback and re-render nothing. Take the topic as a prop
(`bindTemplate('roomTopic', 'board.id', 'room:{{ source }}')`) so the space names its channels, and trust a message
you act on only when `message.from === 'server'`. The page has one connection and is one member per topic, however
many elements and plugins listen.

## Its own server code

`plitzi plugin add board --server` writes `functions/index.ts` in its folder. Its routes answer under
`/fn/plugins/board/`, named with `usePluginRoute('board')('/layout')` (`undefined` where no server runs code, as on the
canvas). Its `ctx.kv` is the plugin's own; the space's credentials, channels and data are not.
