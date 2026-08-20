# Server actions

A practical guide to **server actions**: work a page cannot do in the browser, authored as a flow and run by
`sdk-server`. Charging a card, sending mail, reading a system only the server can reach, joining two APIs before
anyone sees the result.

The design and the reasoning behind each rule are in [RFC 0012](../rfc/0012-server-actions.md); this is how to use
it.

---

## 1. What an action is

A named, declarative flow, stored per space, executed on the server. The browser hands it an **id** and **inputs**
and gets back the values the flow chose to answer. It never learns what happened in between — not the URL, not the
credential, not the systems involved.

Three properties everything else follows from:

1. **Data, not code.** An action is a document, like a connector manifest. No customer JavaScript runs on Plitzi's
   servers.
2. **One vocabulary.** It is the same flow editor you already use for interactions, with a different set of steps
   in it: a step here is a **task** rather than a browser callback.
3. **A server runs it or nothing does.** A page served without a Plitzi server tier leaves the step inert and says
   so once, instead of quietly doing the work in the browser — which is how a credential ends up there.

---

## 2. Authoring one

**Server Actions** in the builder's left panel. An action is a **name and a flow**, and nothing else — the same
node map an element's interactions are, with tasks where a page has callbacks.

Everything about how a run begins lives on the step that begins it:

| On the trigger step | What it decides |
|---|---|
| Its kind | `call` from a page, `webhook`, `schedule`, `render` |
| Who may | Anyone / signed-in visitors / visitors holding named permissions. No default — an unstated rule is either a lock-out or a hole. A `schedule` has no caller, so it has no rule |
| Input it accepts | What a caller may send **through that way in**, as a JSON field map. Anything undeclared is dropped before a single step runs |

Which means authoring one is: **open the flow, pick a trigger, fill in its two fields, chain the tasks.** There is
no form above the editor repeating any of it — the trigger step is the only place a way in is configured.

**One action can have several ways in**, exactly as one element has an `onClick` and an `onSubmit`: add a second
trigger step and it heads its own chain. That is also what lets a signed webhook and a session-only page call live
in the same action without either loosening the other — the thing a single rule beside the flow could not express.

There is no list of credentials or connectors to declare. A step **names** the one it needs and resolves it inside
its own execution, which is the only boundary that ever mattered: a secret reaches the params of the step that
asked for it and nothing else. A list the author could edit was never a boundary against the author.

### The output step

End the flow with an **Output** step naming what the caller gets back. That step is the contract:

```json
{ "total": {{ quote.value }}, "reference": "{{ input.orderId }}" }
```

Two things worth knowing:

- **It must be last.** Only the last output step that runs is answered, so a step after it is work whose result
  nobody can read. The editor warns.
- **Its JSON is the shape.** An unquoted token keeps its type (`{{ quote.value }}` → a number); a quoted one is
  text. There is no separate declaration to coerce one into the other.

Everything the flow produced and did not name stays on the server. That is the mechanism that keeps an API's
internal fields, draft rows and tokens out of the page.

### Testing it

The form has a **Test run** panel: fill the declared inputs, run, and read the trace step by step. It runs the
**saved** action through the same runner a visitor's call goes through — same access rule, same limits, same
single-flight — because a test path that skipped them would be rehearsing something other than what ships.

---

## 3. Calling one from a page

Add a **Run Server Action** step to any element's flow. It takes the action, its input, and a mode:

| Mode | The flow | Use it for |
|---|---|---|
| `await` | waits for the result and binds it | a quote, a validation, anything the next step reads |
| `detached` | carries on immediately | email, notifications, logging |
| `stream` | carries on, and progress arrives as events | long AI work, imports with a progress bar |

`detached` means **the page does not wait** — not that the run outlives its request. The request is still made and
the connection is still the run's lifetime; the step just does not await it. It is sent with `keepalive`, so a
navigation right after "Send" does not kill it.

Work that must survive the visitor closing the tab is not this: that is a schedule, or a webhook from the system
that owns the work.

### Reacting when it finishes

Three triggers fire on the element that launched the run:

- **On Server Action End** — `actionId`, `runId`, `status`, `output`
- **On Server Action Error** — plus `reason`: `duplicate`, `over_capacity`, `recursion`, `forbidden`, `timeout`…
- **On Server Action Progress** — one per chunk a streaming run emitted

`actionId` is a parameter, so one element can launch several actions and each trigger filters with its own `when`.
A **Cancel Server Action** step stops a run by its id.

---

## 4. The steps available

Read the catalog in the editor — it is served by *your* server, so it lists what that deployment can actually run.
The ones `sdk-server` ships:

| Namespace | What it does |
|---|---|
| `flow` | `delay`, `fail`, and the `output` step above |
| `transform` | `template` (twig), `json` |
| `http` | `request` — an outbound call with a credential resolved server-side |
| `connector` | `read`, `write` — the connectors this space already has |
| `auth` | `currentUser`, `requireRole` |
| `kv` | `get`, `set`, `increment`, `delete` — namespaced per space |
| `stream` | `emit` — progress for a streaming caller |

Plus whatever the deployment registered. On Plitzi's own: `ai.complete`, and `db.query` when a database driver is
available.

### What a step can see

The run carries only the basics — `input`, `user`, `spaceId`, `environment`, `trigger`, `runId` — plus each
previous step's result under its own id. **Everything else a flow can reach is something a task chose to hand
back.**

Credentials are deliberately not in there. A step that needs one **names it** (`http.request` has a `credential`
field) and its values are in scope only while that step's own parameters render:

```
Credential: stripe
Headers:    { "Authorization": "Bearer {{ credential.secretKey }}" }
```

Written anywhere else, `{{ credential.… }}` resolves to nothing — the editor warns — because an ambient secret is
interpolable by every step, including the one that answers the browser.

---

## 5. Webhooks

Add a **webhook** trigger step and the action answers at `POST /_action/hook/<actionId>` on the space's own
origin. It is public by construction, so the signature is the security boundary:

Its **Signature check** field, on the trigger step:

```json
{
  "type": "hmac",
  "header": "stripe-signature",
  "algorithm": "sha256",
  "credential": "stripe",
  "secretField": "webhookSecret",
  "timestampHeader": "stripe-timestamp",
  "toleranceSeconds": 300
}
```

The credential is **named, not templated**. This check runs before the body is parsed and before a run exists, so
there is no flow scope for a token to resolve against — and one that rendered to nothing would leave the endpoint
verifying every request against an empty secret.

- The signature is checked against the **raw body**, before parsing. (This is why you cannot re-serialize a webhook
  body and verify it afterwards — the digest is over bytes.)
- Without `timestampHeader`, `toleranceSeconds` has nothing to compare against and a captured request stays valid
  until the secret rotates.
- The body arrives as input: a document naming the two fields it cares about gets those, and one declaring
  `payload: json` gets the whole envelope.
- Retries are handled: a redelivery carrying the same delivery id is answered **202** rather than run twice.
- Requests are rate limited per caller per minute, counted **before** the signature is checked.

---

## 6. Schedules

Add a **schedule** trigger step with a five-field cron — `minute hour day-of-month month day-of-week`, with `*`,
lists, ranges and steps. An expression the server cannot read is refused at save time, because one that merely
never matches would sit silent until somebody noticed the digest missing.

Times are **UTC**. Missed ticks are **not** replayed: a scheduler that catches up fires an hour of digests at once
after an outage, which is worse than the one nobody got.

---

## 7. Feeding a page render

An element with `runtime: 'server'` can name an action instead of a connector. It is fed the page's route and query
params and its output lands in the server payload, so the page ships with the data already in it.

This is for the read a connector manifest cannot express: two calls that must be joined, a computed field, a shape
that depends on who is looking. If the work is "fetch records to bind", a connector is still the right tool.

---

## 8. Versions

Actions are versioned with the space. **Publishing copies every action** into the revision it published, the same
way the schema and styles are snapshotted, and what you keep editing afterwards is the draft.

So a page published on Monday calls the flow as it read on Monday, however many times the action is edited since.
Ship the change by publishing again.

Which version a run reads depends on what started it:

| Started by | Reads |
|---|---|
| A page (a step, or a `render` element) | the version that page was published with |
| A webhook, a schedule, a deployment's own trigger | the draft — nothing about a sender or a clock names a revision, and a webhook pinned to an old revision would keep answering with a flow you already fixed |

The **Test run** panel runs the draft, which is what you are editing.

**Connector manifests are versioned in the same publish**, so a page reads through the manifest it shipped with
too — and one run keeps one version end to end: the action a page called and the manifests its steps read through
all come from that page's revision.

A space published before this existed has no copies; those pages fall back to the draft, which is what they did
before. Publishing once puts them on their own version.

## 9. Limits, and what stops a runaway flow

| Guard | Default | What it prevents |
|---|---|---|
| Wall clock | 10 s (120 s streaming) | a step that never answers holding a connection |
| Steps per run | 50 | an authored loop |
| Outbound requests per run | 20 | one run turning into a hundred calls |
| Concurrency | 10 per space | one space starving the rest |
| Single-flight | per caller + input | a double click, a retry, a reconnect becoming several runs |
| Lineage | — | an action whose HTTP step reaches its own webhook (answered **508 Loop Detected**) |

A run is billed once, as a `server_action`. A run that was refused is not billed — billing a 409 only teaches
callers to retry harder.

---

## 10. When something does not work

| What you see | What it usually is |
|---|---|
| The step reports itself inert | The page has no server tier — a static export or an embed. Deploy the space with an SSR credential |
| `duplicate` | The same call is already running. Give the step an idempotency key if the repeat is legitimate |
| `forbidden` | The action has no trigger step of that kind, or the caller does not meet that trigger's access rule |
| `recursion` | The flow reached its own webhook |
| A `{{ credential.… }}` that renders empty | The step did not name a credential — set its `credential` field |
| An empty section on a rendered page | A `render` action failed; the reason is in the server log, and one slice failing never takes the page down |

For anything else, the **Test run** panel shows the trace step by step, with credential values redacted.

---

## 11. For a self-hosted deployment

Everything above is configuration; the two extension points are code you own:

- **Your own tasks** — `createServer({ action: { tasks: [...] } })`. They appear in your builder's catalog with no
  fork, because the catalog is served rather than hardcoded. A task declares its parameters the same way an
  interaction callback does.
- **Your own triggers** — mount a stage (or a queue consumer, or a CLI) and call the runner. Every check lives in
  the runner, so a trigger you add cannot end up with a weaker set of rules than the built-in ones.

Both, plus the lookups and the versioning rule above, are wired end to end and runnable in
[`examples/05-with-server-actions/01-actions`](../../examples/05-with-server-actions/01-actions).

Also yours: the key/value store behind `kv` (in-process by default, which counts only its own replica — a cluster
supplies a shared one), the database drivers `db.query` may use, the per-run limits, and what a run costs.

**Every store here is yours.** `sdk-server` opens a connection to nothing at all: it reads a space through an
adapter, keeps runs wherever you tell it to, and reaches a database through a driver you register. What it ships
is the mechanism around those seams and one thing that needs no store:

| | What it is |
|---|---|
| `createRunLogger(logger)` | An `onRun` reporting each run on the log stream the server already uses. Without an `onRun` a deployment sees nothing: the request log says a call was answered, and a run started by a webhook or a schedule has no request to say anything about |

### The `kv` store

`kv` falls back to an in-process Map, which is honest for one replica and a rate limit that multiplies by however
many you run. A cluster passes an **adapter** over whatever it already runs — Redis, Memcached, a table:

```ts
const kv: ActionKvAdapter = {
  get: async key => (await redis.get(key)) ?? undefined,
  set: async (key, value, ttl) => { ttl ? await redis.set(key, value, 'EX', ttl) : await redis.set(key, value); },
  delete: async key => { await redis.del(key); },
  increment: (key, amount) => redis.incrby(key, amount),
  expire: async (key, ttl) => { await redis.expire(key, ttl); }
};

createServer({ action: { lookups, kv } });
```

Five operations over strings, and **no rule to remember**. How a counter behaves is the server's, the same for
every deployment — the key prefixing, the JSON round trip, and the one that a rate limit lives or dies by: a
window's lifetime is set once, by whoever created the counter, and never extended. Refreshed on every hit, a
one-minute window never closes while traffic keeps arriving.

Two things your adapter does owe:

- **`increment` must be atomic.** It is the one thing get-then-set cannot be, and the reason it is an operation
  rather than something the server composes.
- **Throw when the store is unreachable.** Nothing above catches, deliberately: this is not a cache, and a miss
  here means the rate limit did not count and the idempotency key was not seen.

### The database driver

A `db.query` step runs through a driver you register, which is three fields:

```ts
const mysql: ActionDbDriver = {
  engine: 'mysql',
  query: async (dsn, sql, params, signal) => { /* your client, your pool */ }
};

createServer({ action: { lookups, dbDrivers: [mysql] } });
```

Four things are worth copying from a working one, because each fails in a way that does not point at itself:

- **Parse the DSN.** Both `mysql2` and `mariadb` take *either* a URI string *or* an options object — passing a
  `uri` field alongside options is silently ignored, and the pool then connects to the driver's own defaults.
- **Refuse stacked statements** (`multipleStatements: false`). One `;` inside a bound value and the second
  statement runs.
- **Dates, decimals and BIGINT in shapes JSON can carry.** A flow serializes what it gets, and JSON has no BigInt:
  the first `SELECT COUNT(*)` otherwise dies far from the step that ran it.
- **Let the abort destroy the connection**, not merely stop waiting on it. A query left running on the far side
  keeps its locks after the run is gone. (A per-query `timeout` is not the answer: `mariadb`'s works only against
  a MariaDB server and refuses every statement against MySQL.)
