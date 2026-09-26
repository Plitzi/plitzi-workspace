# Realtime channels

A practical guide to **channels**: topics a page subscribes to and publishes on, delivered to every other page on
the same topic within milliseconds — cursors, presence, a game's moves, a board's saved shapes. The server is the only
way in and out: it authorises, stamps and rate-limits every message, and moves it through a **pub/sub adapter** the
deployment chooses.

The reasoning behind each rule lives beside the code that enforces it — the RFC this grew out of (0018) was deleted
when it shipped, and is in the history (`git log -- docs/rfc`). The whole of it in use is
[`examples/06-full-examples/04-whiteboard`](../../examples/06-full-examples/04-whiteboard).

---

## 1. What exists, and when to reach for it

| You need                                                 | Use                                 |
| -------------------------------------------------------- | ----------------------------------- |
| Data that changes every minute or so                     | A provider's `refreshSeconds`       |
| One caller watching one long run                         | A server action in `mode: 'stream'` |
| Every page on something to see what any of them did, now | **A channel**                       |

A channel is two roads, and a space usually needs both:

- **`publish: 'server'`** — only a flow's `realtime.publish` step may speak. What arrives was validated and saved
  first: a board's elements, a game's authoritative state, a score.
- **`publish: 'clients'`** — pages speak directly. What is cheap and ephemeral: a cursor, "typing…", a live drag.

---

## 2. Declaring channels

A topic nothing declares is refused — by the server, and by `authorSpace` before it ever is. The space declares
**patterns**; `{name}` is one segment a page fills in:

```ts
export const space: SpaceSpec = {
  // …
  channels: {
    'board:{id}': { access: { mode: 'public' }, publish: 'server' },
    'room:{id}': {
      access: { mode: 'public' }, // or { mode: 'session' }, or { mode: 'role', permissions: [...] }
      publish: 'clients', // the default
      presence: true, // members, their state, join and leave
      maxMessageBytes: 8192, // 4096 when absent: the JSON of `data`
      messagesPerSecond: 40 // 30 when absent: per connection
    }
  }
};
```

`access` is the vocabulary server actions use, checked when a page subscribes and again when it publishes. A topic is
letters, digits and `:_-.`, at most 128 characters; a `{name}` segment never contains a `:`. It is stored in the
schema as `settings.channels`.

---

## 3. On a page: the `channel` element

A provider, like `apiContainer`: it renders no element of its own unless given a `subType`, and its descendants bind
to its source.

|                       |                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attributes            | `topic` — usually a template: `room:{{ id }}` (a route param) · `presence` — the state this page announces (an object from a binding, or JSON) · `keep` — how many messages its source holds (20) |
| Source `channel_<id>` | `connected`, `me` (this page's name on the channel), `members` (`from`, `user`, `state`, `me`), `messages` (the last `keep`), `last`                                                              |
| Triggers              | `onMessage` (`type`, `data`, `from`, `user`, `at`), `onJoin`, `onLeave` (`from`)                                                                                                                  |
| Callbacks             | `publish({ type, data })`, `setPresence({ data })`                                                                                                                                                |

```ts
channel({
  id: 'room',
  topic: 'room:{{ id }}',
  keep: 0,
  bind: { presence: 'computed.me' }, // { name, color }, announced again whenever it changes
  children: [
    list({ id: 'people', source: 'controlled', bind: { items: 'room.members' }, children: [avatar()] })
    // …
  ]
});

// A flow elsewhere, speaking on it:
[onClick(), publishOn('room', 'reaction', { emoji: '🎉' })][
  // Changing what this page announces:
  (onClick(), announceOn('room', { name: '{{ state.name }}', away: true }))
];
```

`onMessage` fires for the channel's own vocabulary only; `$presence`, `$join` and `$leave` are the element's to keep
(`members`) and arrive as `onJoin`/`onLeave`. Nothing connects in the builder, or anywhere the page has no server.

### Server announcements, read by a flow

A `publish: 'server'` channel is read the same way — the page just cannot send on it:

```ts
channel({
  id: 'feed',
  topic: 'board:{{ id }}',
  keep: 0,
  flows: [
    [named('heard', on('onMessage')), when({ field: 'heard.type', operator: '=', value: 'title' }, reloadApi('board'))]
  ]
});
```

---

## 4. In a plugin: `useChannel`

A component moving sixty cursors a second reads the channel through the hook, not through flows — messages arrive
through a callback, so they re-render nothing:

```tsx
import { useChannel } from '@plitzi/plitzi-sdk';

const room = useChannel(roomTopic, { onMessage: message => drawCursor(message.from, message.data) });
room.publish('pointer', { x, y }); // Promise<boolean>: false when refused or offline
room.members; // who is here, with what they announced
room.connected; // for a "reconnecting…" state, or to re-read after a drop
```

A page has **one connection**, whatever listens: every element and plugin share it, and topics mounted together open
it once. A page is also **one member** of a topic — a plugin and a `channel` element on the same topic share its
presence, and a listener that starts late begins with everyone already known.

A plugin should check `message.from === 'server'` before trusting a message it acts on. On a channel declared
`publish: 'server'` no page can send, but the component cannot see the declaration — the check costs nothing.

---

## 5. From the server: `realtime.publish`

A task, so any action can say what it did:

```ts
defineAction({
  id: 'board-apply',
  trigger: { type: 'call', access: 'public', input: { board: { type: 'text' }, ops: { type: 'json' } } },
  steps: [
    { id: 'apply', task: 'board.apply' },
    {
      id: 'announce',
      task: 'realtime.publish',
      params: { topic: 'board:{{ input.board }}', type: 'elements', data: '{{ apply.settled }}' }
    }
  ]
});
```

On a `publish: 'server'` channel it is the only way in. Its messages carry `from: 'server'`. A deployment's own
task publishes through `ctx.publish(topic, type, data)` — scoped to the space and environment of the run, and
refused for a topic the space does not declare.

---

## 6. The wire

- `GET /_realtime?topics=board:7f3a,room:7f3a` — Server-Sent Events, 1 to 8 topics. Each topic is authorised on its
  own: the first event, `ready`, names the connection, gives it a secret for publishing, and lists what was `refused`
  and why (`undeclared`, `unauthenticated`, `forbidden`). All refused is a `403`.
- `POST /_realtime` `{ token, topic, type, data }` — a publish. `204`, or `401` (not this server's connection — it
  restarted), `403` (`not_subscribed`, `server_only`), `422` (a `$` type, a bad topic), `413` (too big), `429` (too
  fast).

What every subscriber receives is stamped by the server, never taken from the sender:

```ts
type RealtimeMessage = {
  topic: string;
  type: string; // the sender's vocabulary
  data: unknown;
  from: string; // the connection, as the server named it — or 'server'
  user?: { id: number; name: string }; // when the connection carries a session
  at: number; // server time, ms
};
```

**Presence** is kept by the connections, not stored: a member announces its state (`$presence`) when it sets it, when
somebody new arrives (`$join`) and every 20 seconds; the server says `$leave` when a connection closes; a member heard
from in none of those ways for 65 seconds is gone.

**Delivery is at most once**, and nothing is replayed. A page that was disconnected re-reads what it shows — the
whiteboard's canvas fires `onResync` when its channel comes back, and the page reloads the board.

---

## 7. The adapter

Transport only — strings in, strings out. Everything above (who may, how big, how often, who sent it) is decided once,
for every deployment:

```ts
type PubSubAdapter = {
  publish: (topic: string, message: string) => Promise<void>;
  subscribe: (topic: string, listener: (message: string) => void) => Promise<() => Promise<void>>;
};
```

```ts
import { createMemoryPubSub, createRedisPubSub, createServer } from '@plitzi/sdk-server';

createServer({ /* … */, realtime: { pubsub: createMemoryPubSub() } });   // the default, when `realtime` is absent
createServer({ /* … */, realtime: { pubsub: createRedisPubSub({ publisher: redis, subscriber: redis.duplicate() }) } });
createServer({ /* … */, realtime: false });                             // no `/_realtime` at all
```

- **`createMemoryPubSub()`** — one process, and its workers: a publish is also a fleet broadcast, delivered by every
  worker to its own pages. A second **replica** shares nothing with it.
- **`createRedisPubSub({ publisher, subscriber, prefix? })`** — over clients the deployment hands it; a subscribing
  Redis connection can do nothing else, hence two. The client types are structural (what `ioredis` already is), so
  `@plitzi/sdk-server` carries no Redis dependency.
- **Anything else** — NATS, Postgres `LISTEN/NOTIFY`, a cloud service — is one object of those two methods.

Each process holds one adapter subscription per topic, however many pages share it; topics are namespaced by space and
environment before they reach the adapter.

---

## 8. Patterns

- **Validate, keep, then announce.** State everyone must agree on goes through an action whose last step is
  `realtime.publish`, on a `publish: 'server'` channel. The page draws its own change at once and treats the
  announcement as the confirmation.
- **Converge on conflict.** Announce what the store now holds for everything a change touched — the winner, not the
  request — and a page whose edit lost corrects itself when the answer lands. The whiteboard resolves per element:
  higher `version` wins, a tie goes to the lower `nonce`, the same rule on the server and every screen.
- **Roll back on refusal.** When the action fails, drop the edits it never confirmed (`onFlowError` → the canvas's
  `rollback`): what it refused never reached anybody else.
- **Throttle at the source.** A pointer sends at most every 50 ms and always its latest position; declare
  `messagesPerSecond` with room above what the page sends, not equal to it.
