# Realtime channels

Pages that see each other — cursors, presence, a shared board — need a channel. Declare its topic pattern on the space,
then subscribe with a `channel` element; a topic no pattern matches is refused, naming the patterns:

```ts
channels: {
  'board:{id}': { access: { mode: 'public' }, publish: 'server' },           // only `realtime.publish` speaks
  'room:{id}': { access: { mode: 'public' }, presence: true }                // pages speak directly
}

channel({ id: 'room', topic: 'room:{{ id }}', keep: 0, bind: { presence: 'computed.me' }, children: [...] })
```

Its descendants bind `room.members`, `room.connected`, `room.last`; flows use `on('onMessage')` (`type`, `data`,
`from`), `onJoin`/`onLeave` (`from`, `user` and the `state` the member announced — `onJoin` only for who came after
this page), `publishOn('room', 'reaction', data)` and `announceOn('room', state)`. What a page publishes reaches
every OTHER page on the topic: one that shows it the moment it sends — a reaction, a chat line — says
`publishOn('room', 'reaction', data, { echo: true })` and hears it back once the server took it (its `from` is
`room.me`). What a server action publishes reaches every page, the one that ran it included. State everyone must
agree on goes through a server action whose last step is `realtime.publish` — validated and saved first, announced
after.

A topic only some visitors may hear — a room behind a password, a customer's order — goes on a channel declared
`grant: true`. The action that decides they may be there ends with `realtime.grant` and answers the grant; the
element binds it, or the server refuses the topic every time (`channel-grant`). `realtime.revoke { topic, grant }`
takes one back — or every grant for the topic, naming none — and lets go whoever is on it with it:

```ts
channels: { 'order:{id}': { access: { mode: 'session' }, grant: true } }

// steps: [ …decide…, { id: 'let', task: 'realtime.grant', params: { topic: 'order:{{ input.order }}' } } ]
channel({ id: 'order', topic: 'order:{{ id }}', bind: { grant: 'state.follow.grant' }, children: [...] })
```

State every screen shows and the server keeps — a dashboard's lists, a board's settings — goes on a channel declared
`retain: true` (and `publish: 'server'`): the server keeps the latest message of each type, sends it as it is said and
again to every page that joins — and to its `onMessage` flows, as if just said — which reads it as
`desk.retained.lists` (a plugin, `useChannel('desk').retained`).
Publishing `null` forgets the type; a topic keeps at most 64 types and 512 KB. No read of its own, no copy in `state`:

```ts
channels: { desk: { access: { mode: 'session' }, publish: 'server', retain: true } }
// a flow: { task: 'realtime.publish', params: { topic: 'desk', type: 'lists', data: '{{ saved.lists }}' } }
```

A job of the space's functions (`ctx.jobs.start`) says how it goes on `$job:<id>`, a topic no space declares — opened
for whoever started it and whoever the job's `watch` lets in: `channel({ id: 'training', topic: '$job:{{ state.job }}' })`
binds `training.retained.job` (`{ status, progress, step, result, error }`).

Two people writing the same thing at once: `kv.setIf` writes only if the value is still the one the flow read (empty
`expected` = only if nothing is there yet — claim a seat, a username), `list.put`/`list.range` keep an ordered list
(latest first, a leaderboard), and `flow.rateLimit` first in a public action that writes — each step's params:
`npx @plitzi/cli explain flow.rateLimit`, every one `explain --list tasks`.
