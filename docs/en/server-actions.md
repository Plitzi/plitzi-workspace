# Server actions

A practical guide to **server actions**: work a page cannot do in the browser, authored as a flow and run by
`sdk-server`. Charging a card, sending mail, reading a system only the server can reach, joining two APIs before
anyone sees the result.

The reasoning behind each rule lives beside the code that enforces it — the RFC this grew out of was deleted when
it shipped, and is in the history (`git log -- docs/rfc`). This is how to use
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

Add a **Run Server Action** step to any element's flow. It takes the action, its input, and a mode. The action is
**picked from the ones this space has** — the editor knows them, so there is no identifier to go and look up — and
the input control names the fields that action's `call` trigger declares. Typing an identifier still works: a page
authored before the action it names is a legitimate order to work in.

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

A **Cancel Server Action** step stops a run by its id. Every mode gives you one to bind: `await` and `stream`
return it from the step (a streaming run reports it as soon as the stream opens, which is what makes it
cancellable at all), and a `detached` run carries it on the trigger that fires when it ends. The cancel reaches
the run **whichever replica is holding it** — it is left in the shared store and read at the next step boundary —
so a run started in one tab can be stopped from another. Without a shared `kv`, cancellation only works within one
process, like everything else that has to be agreed across replicas.

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

How it is checked lives on the trigger step, one field per thing a sender does differently:

| Field | What it is |
|---|---|
| **Signing secret** | Picked from the space's credentials. **Choosing one is what turns verification on** — everything below has a working default, so a webhook is either signed or it is not, and nothing else appears until you have chosen |
| Header the signature arrives in | `x-signature` by default, with GitHub's and Shopify's in the list and anything else typeable |
| Algorithm | `sha256` or `sha1` |
| Which key of that credential | Defaults to `secret` |
| Timestamp header | Only if the sender puts the signing time in a header of its own |
| Reject deliveries older than | Seconds. Only appears once there is a timestamp header to measure against |

The digest itself is read in whatever dressing the sender uses — bare hex, base64, `sha256=<hex>`, or a
comma-separated list of `k=v` pairs — so these fields cover a real webhook and not only a tidy one.

> **A sender that packs the timestamp INSIDE the signature header is not covered.** Stripe's `t=…,v1=…` and
> Slack's `v0:…` sign `<timestamp>.<body>` with the timestamp in the same header, and the check reads a timestamp
> from a header of its own. Those two verify only if the sender is configured to sign the body alone.

**A refused delivery is not silent any more.** A signature that does not verify, a caller over the rate limit, a
body that is not JSON — each leaves an entry in the space's activity feed, with the reason and at most one a
minute so a provider retrying for two days cannot bury everything else in it. The SENDER still learns nothing but
"invalid signature": telling a caller which half of the check failed helps only the caller who should not be
there. This is what "the webhook does nothing and I cannot tell why" was, and it is the first place to look.

The credential is **named, not templated**. This check runs before the body is parsed and before a run exists, so
there is no flow scope for a token to resolve against — and one that rendered to nothing would leave the endpoint
verifying every request against an empty secret.

- The signature is checked against the **raw body**, before parsing. (This is why you cannot re-serialize a webhook
  body and verify it afterwards — the digest is over bytes.)
- Without the timestamp header, a tolerance has nothing to compare against and a captured request stays valid
  until the secret rotates — the validator says so rather than letting the field imply otherwise.
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

Set it in the element's settings: **Data Source → Server action**, then pick the action. An element names ONE
producer — choosing an action clears the connector and the other way round — because the server resolves a
connector whenever one is named and would never look at the action. The action needs a **While a page renders**
trigger; that is the way in this element uses.

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
| Bytes per outbound response | 5 MB | a backend answering a gigabyte, which no timeout catches |
| Concurrency | 10 per space | one space starving the rest |
| Single-flight | per caller + input | a double click, a retry, a reconnect becoming several runs |
| Lineage | — | an action whose HTTP step reaches its own webhook (answered **508 Loop Detected**) |

A run is billed once, as a `server_action`. A run that was refused is not billed — billing a 409 only teaches
callers to retry harder — and neither is one answered from an earlier run's result. A **test run from the builder
is billed like any other**: it does the same work.

### Retries, and the answer that is remembered

Two different repeats, handled in two different places. A call that arrives **while** the first one is still
running is refused as a `duplicate`. One that arrives **after** it finished is answered with what the first run
returned, for as long as the deployment's replay window says (ten minutes on Plitzi) — which is how every webhook
provider retries.

Only ever for a key the CALLER named: an `idempotencyKey` on the step, or the delivery id a sender stamps on its
webhook. A key derived from the input is not replayed, because two identical calls a minute apart are usually two
things somebody meant to happen twice.

---

## 10. When something does not work

| What you see | What it usually is |
|---|---|
| The step reports itself inert | The page has no server tier — a static export or an embed. Deploy the space with an SSR credential |
| `duplicate` | The same call is already running. Give the step an idempotency key if the repeat is legitimate. A `render` never reports this: two visitors of one page are not one caller submitting twice |
| `forbidden` | The action has no trigger step of that kind, or the caller does not meet that trigger's access rule |
| `over_capacity` | Too many runs at once. Calls are capped per space (`concurrency.perSpace`) and renders per process (`concurrency.renderPerProcess`) — a busy page is never counted against the space's call budget |
| `recursion` | The flow reached its own webhook |
| A `{{ credential.… }}` that renders empty | The step did not name a credential — set its `credential` field |
| `Request host is not allowed` | The URL points inside the network the server runs in — a private address, `localhost`, or a public name whose DNS answers one. An authored request may only reach the public internet |
| A section showing data from before | The last refresh could not reach the server. The provider publishes `isStale` alongside its records — bind it and the page can say so instead of looking current |
| A section that is always missing on a slow provider | The page's own ceiling for one section — `rsc.elementTimeoutMs`, 5 s by default — is tighter than what the action is allowed. Whichever is tighter wins, and being cut there now ends the run rather than leaving it to finish for nobody |
| A section reporting it could not be reached | A `render` action did not complete; the reason is in the server log, and one slice failing never takes the page down. The element publishes `hasError` and `errorMessage` — bind them and the page says what a visitor can act on |
| A webhook that appears to do nothing at all | Open the action and read **Recent activity**. A delivery refused for a signature that does not match is recorded there with the reason — it is the most common cause, and it never reaches a run |
| A step that reports `failed` with no server answer behind it | The server was unreachable — down, restarting, or the connection dropped. A run that never left the browser is reported like a refusal, so the flow still gets a status to bind |

The **Test run** panel shows the trace step by step, with credential values redacted and the message of whatever
step stopped the run. Below it, **Recent activity** shows what happened when nobody was watching: the runs a
webhook, a schedule or a page started, and the deliveries that were refused before anything ran.

---

## 11. What is deliberately not here

Four decisions that are open rather than forgotten, so nobody re-derives them from scratch:

- **Actions are per SPACE, not per environment.** The live document is what the builder edits and what a webhook
  or a schedule runs; publishing copies it into the revision a page ships with. There is no separate staging
  action, so an action that points at a production database points at it from the draft too. Naming the
  environment on the row is the change if that becomes a problem.
- **A run costs a flat `server_action`.** A flow making twenty outbound calls is billed as one doing arithmetic.
  Metering per outbound request or per second of wall clock is the refinement, and it would change what the
  default limits should be.
- **`email.send` and `storage.put` are not in the catalog.** A step whose only possible outcome is failure is
  worse than no step: mail needs a transport, a sending domain and a bounce policy, and which bucket a flow may
  write into is a product decision. A self-hosted deployment registers either of them today as its own task.
- **One live stream has one consumer.** A second caller attaching to a run already in flight is the nicer
  behaviour and a second lifecycle to get wrong; refusing the duplicate is honest and reversible.

---

## 12. For a self-hosted deployment

Everything above is configuration; the two extension points are code you own:

- **Your own tasks** — `createServer({ action: { tasks: [...] } })`. They appear in your builder's catalog with no
  fork, because the catalog is served rather than hardcoded. A task declares its parameters the same way an
  interaction callback does.
- **Your own triggers** — mount a stage (or a queue consumer, or a CLI) and call the runner. Every check lives in
  the runner, so a trigger you add cannot end up with a weaker set of rules than the built-in ones.

Both are wired end to end and runnable: **your own tasks**, the lookups and the versioning rule in
[`01-actions`](../../examples/05-with-server-actions/01-actions); the render trigger — an action feeding a
`runtime: 'server'` element while the page is built — in
[`02-render`](../../examples/05-with-server-actions/02-render); and **your own trigger**, over a shared `kv`
adapter written out in full, in
[`04-custom-trigger`](../../examples/05-with-server-actions/04-custom-trigger).

Also yours: the key/value store behind `kv` (in-process by default, which counts only its own replica — a cluster
supplies a shared one), the database drivers `db.query` may use, the per-run limits, and what a run costs.

**Every store here is yours.** `sdk-server` opens a connection to nothing at all: it reads a space through an
adapter, keeps runs wherever you tell it to, and reaches a database through a driver you register. What it ships
is the mechanism around those seams and one thing that needs no store:

| | What it is |
|---|---|
| `createRunLogger(logger)` | An `onRun` reporting each run on the log stream the server already uses. Without an `onRun` a deployment sees nothing: the request log says a call was answered, and a run started by a webhook or a schedule has no request to say anything about |
| `createRejectLogger(logger)` | An `onReject` doing the same for the requests that never became runs. Its own hook because it answers a different question: runs are history, refusals are a fault report, and the one that matters most — a signature that does not verify — is otherwise indistinguishable from the sender never firing |

`onReject` receives **every** refusal, including the polite ones (a provider retrying while the first delivery is
still running). Which of them are worth keeping is yours to decide — Plitzi's own deployment writes the
misconfigurations into the space's activity feed and throttles them to one a minute, and sends all of them to the
log stream.

### The `kv` store

`kv` falls back to an in-process Map, which is honest for one replica and a rate limit that multiplies by however
many you run. **Four things need it to be shared**, and each of them degrades silently without it: single-flight
(the same double click on two replicas runs twice), cancellation (a `DELETE` never reaches the replica holding the
run), replay (a redelivery runs the work again), and the webhook rate limit. A cluster passes an **adapter** over
whatever it already runs — Redis, Memcached, a table:

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

`increment` must be **atomic** — it is the test-and-set the single-flight key is taken with, and a get-then-set
version of it hands the same key to two replicas.

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
