# RFC 0012 — Server actions

- **Status:** Implemented (2026-08-20)
- **Author:** Carlos Rodriguez
- **Date:** 2026-08-20
- **Scope:** `@plitzi/sdk-shared`, `@plitzi/sdk-server`, `@plitzi/sdk-interactions`, `@plitzi/sdk-elements`, `apps/mcp`, `apps/builder`, `plitzi-sdk-server`

---

## 1. Summary

A **server action** is a named flow that runs on `sdk-server` instead of in the browser: the same node
vocabulary the builder already authors for interactions, executed where credentials, private data and
trust actually live.

The browser — or a webhook, a schedule, or a page render — names an **action id** and hands it **inputs**.
The server resolves the definition from its own store, authorizes the caller, runs the flow, and answers
the declared **output**. No URL, no credential, no backend topology ever crosses to the client.

Three properties define it, and everything in §4 follows from them:

1. **Data, not code.** An action is a declarative document, like a connector manifest (RFC 0008 §4.2).
   No customer JavaScript runs on Plitzi's servers.
2. **One vocabulary.** It reuses `ElementInteraction` nodes, twig params, `when` rule groups and the
   builder's `Workflow` editor. A Plitzi user learns flows once.
3. **Mechanism in `sdk-server`, data in the deployment** (RFC 0011). The runner, the endpoint and the task
   registry are the SDK's; the store, the credentials and the catalog of what a plan may do are the
   deployment's. A self-hoster registers their **own tasks and their own triggers** through the same seams
   Plitzi uses.

## 2. Why now, and why this shape

The hole is already cut. Three pieces of the design exist in `main` today and were built expecting this:

| Existing | Where | What it already gives |
|---|---|---|
| `POST /_action` | `apps/server/src/core/services/action.ts` | An authenticated write endpoint that addresses work **by name**, resolves the target server-side, and refuses anything undeclared. |
| `'server_action'` | `sdk-shared/types/ServerTypes.ts:355` | A reserved `MeteredKind`, documented as *"nothing emits this yet… wiring them later is a call site, not a schema change"*. |
| `SpaceConnector` + `SpaceCredential` | `plitzi-sdk-server/prisma/schema.prisma` | The precedent for per-space declarative documents that are **server-side state**, encrypted where secret, never in the schema. |

And the invariant this must not break is already written down, in RFC 0008 §4.3.2:

> For a page served by Plitzi, the browser issues requests to the Plitzi origin only. It never holds a
> credential, never learns a backend hostname, and never contacts a CMS or customer API directly.

Server actions are how that invariant survives contact with **logic**. Today anything beyond "read a
collection" or "write a record" has exactly one escape hatch: the `webHook` interaction utility, which
`fetch`es from the browser with an `authorizationToken` param that is `canBind: true` — i.e. a literal token
typed in the builder is persisted in the schema and shipped to every visitor. RFC 0008 §4.3.1 closed that for
data reads. This closes it for everything else.

### 2.1 What the market does, and what we take from it

| Platform | The idea worth taking | What we do differently |
|---|---|---|
| Next.js server actions | The client invokes **by name**, never by URL; the server owns the binding. | Ours is authored, not compiled — the name resolves against a stored document, not a bundle. |
| Bubble backend workflows | One flow, callable from the front end **or** exposed as an endpoint with its own permissions. | Permissions come from the RBAC kernel (RFC 0010), not from a per-workflow ACL invented here. |
| Webflow Logic | Visual flow + inbound webhook trigger; declarative blocks only. | Same posture. We already own the editor. |
| Xano / Retool Workflows | A task catalog over connections, plus a run history. | Our "connections" are `ConnectorManifest`s that already exist and already serve reads. |
| n8n | Breadth of the task catalog and the extension model. | We do not take the free-form code node (see §4.4.4), and orchestration stays linear-with-branches, not a general graph. |

The differentiator we actually have: **an action and an interaction are the same document type**. A step
that today calls `setState` in the browser and a step that tomorrow charges a card server-side are authored,
validated, previewed and debugged by the same machinery. No competitor has one flow model spanning both,
because none of them owns the client runtime.

## 3. The line

**A server action is:** a per-space, named, declarative flow, invoked with typed inputs, that reads and
writes systems the browser must not reach, and returns a typed, projected result.

**A server action is not:** a general-purpose proxy, a place to run customer code, a job queue, or a second
way to do what a connector read already does. If the work is "fetch records to bind", it is a
`runtime: 'server'` provider element with a connector — not an action.

## 4. Design

### 4.1 The document

Lives in `sdk-shared/types/ActionTypes.ts`, beside `ConnectorTypes.ts`, for the same reason: **the builder
authors the document the server executes**, so one type or they drift.

```ts
/** Deliberately not `CollectionField['type']`: that vocabulary describes CMS content (`richText`, `multiImage`),
 *  and an action takes arguments, not entries. */
export type ActionFieldType = 'text' | 'number' | 'boolean' | 'date' | 'json' | 'file';

export type ActionField = {
  type: ActionFieldType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  /** Shown in the builder; also what the MCP agent reads to wire a call correctly. */
  label?: string;
};

/** Who may invoke this action. Resolved against the RFC 0010 kernel — never re-implemented here. */
export type ActionAccess =
  /** Anyone, including an anonymous visitor. Required for a webhook; a deliberate choice anywhere else. */
  | { mode: 'public' }
  /** Any request carrying a valid session for this space. The default. */
  | { mode: 'session' }
  /** A session holding every one of these space permissions. */
  | { mode: 'role'; permissions: string[] };

export type ActionTrigger =
  | { type: 'call' }
  | { type: 'webhook'; verify?: ActionWebhookVerification }
  | { type: 'schedule'; cron: string; timezone?: string }
  | { type: 'render' }
  /** Anything a deployment mounts itself. The runner does not care who called it. */
  | { type: 'custom'; name: string };

export type ActionDocument = {
  name: string;
  description?: string;
  enabled: boolean;
  access: ActionAccess;
  triggers: ActionTrigger[];
  input: Record<string, ActionField>;
  /** The only keys the caller gets back. Everything else a node produced stays on the server. */
  output: Record<string, ActionField>;
  /** Credential identifiers this action may resolve. Nothing else is in scope for its templates. */
  credentials?: string[];
  /** Connector identifiers this action may call. */
  connectors?: string[];
  /** The flow itself — the same node map an element's `interactions` holds. */
  nodes: Record<string, ElementInteraction>;
  limits?: { timeoutMs?: number; maxNodes?: number; maxRequests?: number };
};

/** What a server-side reader hands over. `id` is stamped by the store, never carried by the document —
 *  same rule as `ConnectorManifestDraft`. */
export type ActionEntry = { id: string; document: ActionDocument };
```

`nodes` being `Record<string, ElementInteraction>` is the whole bet. The node already carries `action`,
`params`, `when`, `beforeNode`/`afterNode`, `enabled` and `preview`; the traversal already exists; the
builder editor already renders it; the MCP validator already checks it.

### 4.2 Where it lives, and what the browser sees

Server-side state, exactly like a connector manifest. In `plitzi-sdk-server`:

```prisma
model SpaceAction {
  id         Int    @id @default(autoincrement())
  spaceId    Int    @map("space_id")
  identifier String @db.VarChar(255)
  name       String @db.VarChar(255)
  document   Json
  enabled    Boolean @default(true)
  createdAt  Int    @map("created_at")
  updatedAt  Int    @map("updated_at")
  space      Space  @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  @@unique([spaceId, identifier])
  @@map("space_action")
}
```

`sdk-server` never learns Prisma exists. It receives lookups in config, the same shape `connectors` already
takes:

```ts
export type ActionLookups = {
  getAction: (spaceId: number, actionId: string) => Promise<ActionEntry | undefined>;
  /** Only for the builder's catalog endpoint and the MCP: never on the invocation path. */
  listActions?: (spaceId: number) => Promise<ActionEntry[]>;
  getCredential?: (spaceId: number, identifier: string) => Promise<Record<string, string> | undefined>;
};

createServer({ /* … */ connectors: connectorLookups, actions: actionLookups });
```

**What reaches the browser is the projection, and only the projection**: `{ id, name, input, output }`. The
node list, the credentials, the connectors and every URL stay server-side. That is what lets the builder
offer typed bindings on an action's result without the page learning what the action does — the same split
the connector `fields` projection makes.

Consequences worth stating because they are load-bearing:

- The schema stores an **action id** on the calling node, never a copy of the flow. Deleting an action makes
  the call fail closed; it cannot leave a stale executable behind.
- Actions are **not part of the space revision** (connectors are not either). An edit is live immediately.
  §8 records this as the one open asymmetry.

#### 4.2.1 The private half of a space

Worth stating as a concept rather than re-deciding per feature: **a space is two documents, not one.**

| | Public document | Private document |
|---|---|---|
| What | `schema`, `style`, `segments`, `plugins` — what `getOfflineData` returns | connector manifests, credentials, **action documents**, and whatever server-only settings come next |
| Who reads it | the renderer, and every visitor's browser | the server, the builder (authenticated), the MCP |
| Serialized into a page | always | **never** |
| Versioned with the deploy revision | yes | not today (§8.1) |

The boundary is not *who may query it* — the builder is authenticated and legitimately sees everything. It is
**which documents get serialized into a page**. That distinction is what makes the rule testable.

Half of this already exists without a name: `SpaceConnector` and `SpaceCredential` are private rows, and
`ConnectorsContextProvider` loads them into the **builder store**, which its own comment describes as editor
state that "is never serialized into the published schema, so putting endpoints there does not put them on a
visitor's page". Actions join that half. Naming it buys three things:

1. **One enforcement point instead of N.** RFC 0008 §4.3 already pins "credentials must never appear in
   `getOfflineData`, the deploy snapshot, the `Server` payload, or any RSC response" with a test. That test
   should be about the *namespace*, so the next private thing inherits it rather than needing its own.
2. **Projections are derived, never copied.** What the browser does need — a connector's `fields`, an
   action's `{ id, name, input, output }` — is computed server-side from the private document at request
   time. A projection that is *derived* cannot silently start carrying a field someone adds later; a
   projection that is *pasted into the schema at save time* will.
3. **One place to answer the revision question.** §8.1 stops being "should actions be versioned?" and becomes
   "is the private document versioned with the deploy?", answered once for connectors and actions together.

Not a single JSON blob, though. It stays a set of rows in the private namespace: the lookups read one
connector or one action by id on the request path, and a blob would mean loading everything a space owns to
resolve one of them. "Separate schema" here means a separate **namespace with one serialization rule**, not a
second monolith.

The failure mode this does *not* cover, and which no store split can: a secret placed in an **element
attribute**. Element attributes are schema, and schema is public — that is exactly how `ApiContainer` shipped
`accessToken` to every visitor (RFC 0008 §4.3.1). So the companion rule is that an element never holds a
secret or an endpoint, only a **reference** — a connector id, an action id — resolved server-side.

### 4.3 The runner

A React-free port of `flowTrigger` / `processNode` (`sdk-interactions/src/InteractionsHelper.tsx`), living in
`apps/server/src/modules/actions/runtime.ts`:

```ts
export const runAction = async (ctx: ActionRunContext): Promise<ActionRunResult>;

export type ActionRunContext = {
  entry: ActionEntry;
  input: Record<string, unknown>;
  spaceId: number;
  environment: Environment;
  user?: SSRUser;
  trigger: ActionTrigger['type'];
  /** Present when the caller negotiated SSE; see §4.6. */
  stream?: ActionStream;
  signal: AbortSignal;
};

export type ActionRunResult = {
  status: InteractionStatus;
  output: Record<string, unknown>;
  /** The same InteractionNode[] the dev-tools panel already renders. Redacted; see §4.8. */
  trace: InteractionNode[];
};
```

What it reuses verbatim, and why that matters more than the port itself:

- **`processTwig`** from `sdk-shared/helpers/twigWrapper` — already the server's interpolation engine in
  `modules/connectors/engine.ts`. Same tokens, same escaping, same multi-pass ceiling.
- **The rule evaluator** for `when`, through `@plitzi/sdk-shared/helpers/ruleEvaluator` — a wrapper over
  `@plitzi/plitzi-ui/QueryBuilder/helpers`, which is verified React-free (that subpath builds to the evaluator,
  the formatters and the constants, nothing that renders). The wrapper rather than a direct import for two
  reasons: the `@plitzi/plitzi-ui/QueryBuilder` BARREL drags the components — the boot weight the MCP already
  paid for once — and `plitzi-ui` stays out of `sdk-server`'s dependency list, declared once in the shared
  layer that already depends on it.
- **`getByPath`** from `modules/connectors/getByPath.ts` — the existing server-safe path reader.

What differs from the client engine, deliberately:

| Client flow | Server action |
|---|---|
| A failed node is logged and the flow continues | A failed node **ends the run**. There is no per-node opt-out in v1: `ElementInteraction` has no such field, and adding one to the shared node type to soften a server-only rule is the wrong trade |
| No timeout | Hard wall clock (`limits.timeoutMs`, default 10 000) enforced by `AbortSignal`, propagated into every outbound fetch |
| Unbounded steps | `maxNodes` (default 50) and `maxRequests` (default 20) |
| Returns whatever the last node produced | Returns **only** `output`, projected from the flow scope |

Two conventions the implementation settled, worth stating because a reader of the document cannot infer them:

- **The entry point is the flow's single `trigger` node**, exactly what the builder's Workflow editor already
  draws a flow from. The runner walks `afterNode` from there.
- **`flow.output` decides what leaves the server, and IS the contract.** The flow scope holds every node's raw
  result; this step names the subset, and what it names is exactly what the caller receives. A run with no output
  step answers `{}` rather than leaking its last step's result.

  The original design declared an `output` map on the document beside the flow, and that was wrong: it asks an
  author to know what a flow returns before the steps that produce it exist, and leaves two places to keep in
  step. The document's `output` is now **derived** from that step for typed bindings, and the runner ignores it.
  The step must be LAST — only the last one that runs is answered — which the validator says out loud.

  A consequence worth knowing: the step's JSON is the shape, so `{"total": {{ input.amount }}}` answers a number
  and `{"total": "{{ input.amount }}"}` answers text. There is no contract left to coerce one into the other.
- **The cheap checks are one function, called twice.** `precheckRun` — enabled, declared trigger, lineage,
  access, input contract — is called by the ENDPOINT before it takes a concurrency slot or emits a metering
  event, and by the RUNNER because a custom trigger goes straight there. One implementation, so the two paths
  cannot drift into different rules, and a refusal costs the caller nothing.
- **Task param defaults are applied by the runner**, from the task's own catalog entry, before the task is
  called. Without it a document written before a param existed hands the task `undefined` for something its
  signature calls a string — and tasks fill up with defensive conversions that hide the gap.

**What a flow can see is what its tasks hand back.** The run itself carries only the basics — `{{input.*}}`,
`{{user.*}}`, `{{spaceId}}`, `{{environment}}`, `{{trigger}}`, `{{runId}}` — plus every previous step's result
under its own node id. Everything else a flow can reach is something a task chose to return into that scope.

Credentials are deliberately **not** in it. An ambient `{{credential.*}}` is interpolable by every node,
`flow.return` included — which is a secret handed to the browser through a step nobody would think to audit.
Instead a task that needs one **names it** (`http.request` takes a `credential` parameter) and resolves it
inside its own execution, with the secret in scope only while that step's own parameters render. The
document's `credentials` list still gates which identifiers a task may ask for at all, so the two checks
compose: the document says which secrets exist for this action, and the step says which one it is using.

This is the rule to hold as the catalog grows — `apiCall` and everything after it takes the same shape, and
`renderTaskParams` exists so each of them does not answer the question differently.

And if a case ever genuinely needs credential material *in* a flow, the answer is **a task built for that**,
carrying whatever guarantees that exposure requires, rather than relaxing the scope for every step at once. A
capability that one task grants deliberately is reviewable; an ambient one is not.

In the builder, credentials and connectors are **picked, never typed** — the same
`SpaceCredentialSelectorModal` the connector panel uses. An identifier written by hand is a run that fails at
request time with "credential not available", and nothing distinguishes a typo from a credential that was never
created.

### 4.4 Tasks

#### 4.4.1 A fourth node type

`InteractionCallbackType` gains `'task'`. Not a `utility` (those are resolved by action alone and are
offered in **client** flows, where a task can never run) and not a `globalCallback` (those name a client
source module). The type is what lets the builder show a server task only where it can execute, and lets the
MCP validator refuse `email.send` inside a button's click flow.

A task is registered, never imported ad hoc:

```ts
export type ActionTask<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** Addressed as `<namespace>.<action>` in the node's `action` field. */
  namespace: string;
  action: string;
  title: string;
  /** The same InteractionCallbackParam map the builder already renders in WorkflowNode. */
  params: Record<keyof T, InteractionCallbackParam<T>>;
  preview?: InteractionCallbackPreviews;
  run: (params: T, ctx: ActionTaskContext) => Promise<unknown>;
};
```

`ActionTaskContext` is the only door to the outside: `{ spaceId, environment, user, credential(id), connector(id), fetch, signal, emit }`. A task that
wants a secret asks for it by identifier and gets it only if the document declared it. A task cannot open a
socket the runner did not hand it, because `fetch` is the abort-wired, request-counted one.

#### 4.4.2 The v1 catalog

Shipped by `sdk-server`, because these are mechanism:

| Namespace | Tasks | Notes |
|---|---|---|
| `flow` | `branch`, `forEach`, `delay`, `fail`, `return` | `when` already covers the simple conditional; `branch` is for named outcomes |
| `transform` | `twig`, `json`, `map`, `pick` | Pure, no I/O |
| `http` | `request` | Templated URL/headers/body, `{{credential.*}}` resolved server-side. The successor to the `webHook` utility |
| `connector` | `read`, `write` | Executes a declared endpoint of a manifest the action lists. Reuses `fetchConnectorRecords` / `writeConnectorRecord` unchanged |
| `auth` | `currentUser`, `requireRole` | Reads the kernel's resolved identity; `requireRole` fails the run closed |
| `kv` | `get`, `set`, `increment`, `delete` | Namespaced per space. Rate limiting and idempotency keys are built on this |
| `stream` | `emit` | §4.6 |

Shipped by the **deployment**, because they are data and policy — in `plitzi-sdk-server` these wrap services
that already exist:

| Namespace | Tasks | Backed by |
|---|---|---|
| `email` | `send` | The deployment's transport, its templates, its sending domain |
| `ai` | `complete`, `stream` | `services/ai` (Anthropic / OpenAI), billed against the space's plan |
| `storage` | `put`, `signUrl`, `delete` | `services/deployment` S3/CloudFront credentials |
| `db` | `query` | §4.4.3 |

The split is not cosmetic. A self-hoster with no SES account has no `email.send`, and the builder must show
that rather than offer a step that fails at runtime — hence the catalog endpoint in §5.

#### 4.4.3 `db.query`, and the one rule it must obey

The database a `db.query` reaches is **the customer's, declared as a credential** — a `custom`
`SpaceCredential` carrying a DSN. It is never the deployment's own Prisma connection. On Plitzi's cloud that
means a customer database; on a self-host it means whatever that operator wired. There is no configuration
in which an action can address the table holding other tenants' spaces.

The second rule: **parameters are bound, never interpolated**. The node holds `sql` (a literal, no twig) and
`params` (an array whose entries may be twig). A `sql` field containing `{{` is refused at save time by the
validator and at run time by the task. Anything else re-invents SQL injection with a visual editor on top.

Drivers are registered by the deployment, so a self-host adds Postgres without a release from us.

#### 4.4.4 No code node

Confirmed for v1: no JavaScript step, sandboxed or otherwise. The reasons compound rather than merely add —
multi-tenant escape surface, CPU accounting, an opaque unit the MCP validator and the builder preview cannot
reason about, and a support burden shaped like "my code doesn't work". Every escape hatch we have needed so
far has been a *task*, and a task is reviewable. If a customer case genuinely does not fit, the answer is a
task they contribute or a self-hosted deployment registering their own — both of which are code we or they
own, running where someone is accountable for it.

#### 4.4.5 Custom tasks (self-host)

The registry **is** the extension point:

```ts
createServer({
  actions: {
    lookups: actionLookups,
    tasks: [pdfRender, sapOrderLookup],
    limits: { timeoutMs: 30_000 }
  }
});
```

Boot validates namespaces (no shadowing a built-in), param schemas and duplicate ids, and fails loudly.
A custom task appears in that deployment's catalog endpoint, so its builder offers it and its MCP agent can
author against it — no fork, no rebuild of the editor.

### 4.5 Triggers

A trigger is nothing but a caller of `runAction`. That is why "self-hosters add their own" costs nothing: the
seam already exists as `PipelineExtensions` (`core/http/types.ts`), which `@plitzi/sdk-mcp` already uses.

**`call`** — the browser. A new `serverAction` step in the client flow catalog: pick an action, map inputs
from the flow scope, bind the result. Transport is `POST /_action`, which gains a second addressing mode
alongside today's element-addressed connector write:

```jsonc
// existing — element-addressed connector write, unchanged
{ "elementId": "abc", "action": "create", "values": { … } }
// new — action-addressed
{ "actionId": "checkout-quote", "input": { … } }
```

One endpoint, because both are "the browser asks the server to change something, naming it rather than
addressing it". `actionStage` branches on which key is present; the element-addressed path stays exactly as
written — it is the degenerate one-node action and rewriting it would be churn, not progress.

Refusals answer a status the client can act on without reading prose: 403 forbidden, 404 unknown action, 409
disabled or already running, 422 bad input, 429 over capacity, 504 timeout — and **508 Loop Detected** for a
lineage hit, which is the one case where an unusual code says exactly what happened instead of reading as a
server fault. Cancellation is `DELETE /_action/run/:runId`, authorized as the run's own caller, because a run id
travels to the browser and holding one must not let anybody stop somebody else's run.

**`webhook`** — `POST /_action/hook/:actionId`, mounted only for actions declaring the trigger. Public by
construction, so the verification is the security boundary:

```ts
export type ActionWebhookVerification = {
  type: 'hmac';
  header: string;              // e.g. 'stripe-signature'
  algorithm: 'sha256' | 'sha1';
  secret: string;              // '{{credential.stripe.webhookSecret}}'
  /** Rejects a replayed body older than this. */
  toleranceSeconds?: number;
};
```

Verification runs against the **raw body**, before parsing, before the runner starts. An action with
`{ mode: 'public' }` and no `verify` is a save-time warning in the builder and a boot-time one in the logs.
Rate limited per space and per action off `kv`.

**`schedule`** — the one trigger needing infrastructure that does not exist: there is no queue and no
scheduler in `plitzi-sdk-server` today. Design that avoids inventing one:

- `sdk-server` exposes `createScheduleRunner(lookups)` — given a space, it reports the actions declaring a
  cron and runs one on demand. It owns no timer.
- `plitzi-sdk-server` drives it from the **api role**, holding a Redis leader lock so one replica ticks, and
  invoking the runner in-process. Minute resolution, missed ticks are skipped rather than queued.
- A self-host with different needs (a k8s `CronJob` hitting an internal endpoint) drives the same runner.

This is deliberately not a job system: still synchronous, still bounded, still metered. Retries, backoff and
run history beyond a log line are out of scope until something demands them.

**`render`** — an action as an RSC producer. A `runtime: 'server'` element names an action instead of a
connector; `getRscData` runs it with `{ routeParams, queryParams, user }` as input and puts the projected
output in `serverData`. It goes through the same path projection as a connector slice (RFC 0008 §4.4.1) and
the same RSC cache key. This is for the read a manifest cannot express — two calls that must be joined, a
computed field, a permission-dependent shape.

**`custom`** — a deployment mounts a stage in `PipelineExtensions.data` (or any other listener: a queue
consumer, a Redis subscriber on `SpaceEvent`, a CLI) and calls `runAction` with `trigger: 'custom'`. The
runner authorizes on the document's `access` exactly as for any other caller; a custom trigger cannot grant
itself more than a webhook has.

#### 4.5.1 Call modes: what the client flow waits for

A client flow does not always want the answer. Sending an email, warming a cache, notifying Slack — the
visitor should see the confirmation immediately and the flow should carry on. So the `serverAction` step
declares a **mode**:

| Mode | The step resolves with | The flow | For |
|---|---|---|---|
| `await` (default) | the projected `output` | blocks until the run ends | a quote, a validation, anything the next node binds |
| `detached` | `{ runId, accepted: true }` — as soon as the server accepts the run | continues immediately | email, notifications, logging |
| `stream` | `{ runId, accepted: true }`, then frames arrive as events | continues immediately | long AI work with visible progress |

**`detached` means the client flow does not await it — not that the run outlives its request.** The request is
still made and the connection is still the run's lifetime; the step simply does not `await` the promise. That
is the whole difference, and it is what keeps "no queue" true. Two consequences to design for rather than
discover:

- The fetch is issued with **`keepalive: true`**, so a navigation immediately after "Send" does not kill the
  email. That caps the body size (~64 KB by browser rule), which is fine for inputs and is a validator rule,
  not a surprise at runtime.
- A run that must survive the visitor closing the tab — a long import, a nightly-sized job — is **not** this.
  That is background execution, it needs the infrastructure §4.5 declined to build, and the honest answer for
  now is a `schedule` trigger or a webhook from the system that owns the work.

#### 4.5.2 Flow events as client triggers

A detached run still finishes, and the page usually wants to know. The interactions vocabulary already has
the mechanism: `InteractionsManager.subscribe` takes `triggers` as well as callbacks, and
`interactionTrigger(subscriptorId, eventName, params)` fires them through the event bridge. So the client
half of an action registers triggers on **the element whose flow launched the run** — which the runner
already knows, because `flowTrigger` carries `subscriptorId`:

| Trigger | Fires when | Params |
|---|---|---|
| `onFlowEnd` | the run completed | `actionId`, `runId`, `status`, `output` |
| `onFlowError` | the run failed, was refused (409 single-flight, 429 cap) or aborted | `actionId`, `runId`, `error`, `reason` |
| `onFlowProgress` | a `data` frame arrived on a `stream` run | `actionId`, `runId`, `chunk` |

Authoring reads exactly like the rest of the builder: *when this button's flow ends → set state, show a
toast, refresh a provider*. `actionId` is a param, so one element can launch several actions and each
`onFlowEnd` filters with the `when` rule group that already exists on every node.

Deliberate limits:

- These fire **only for runs this page started**. A run started by a webhook or a schedule reaches nobody's
  browser — that would need a server→client push, and the space already has the channel for it
  (`SpaceEvent`, one Redis channel per space). Wiring flow completion into it is a real follow-up, not part
  of this RFC.
- A refused run fires `onFlowError` with `reason: 'duplicate'` rather than nothing. A guard the author cannot
  observe is a guard they will work around.
- The detached run appears in dev-tools while in flight, alongside client flows, so "it did nothing" is
  answerable without a network tab.

And the symmetry with §4.6.3: because a client flow holds the `runId`, a `cancelFlow` step can call
`DELETE /_action/run/:runId`. Cancelling from the UI is then an authored flow, not a feature we have to build
into every button.

### 4.6 Streaming (SSE), and how it is stopped

Synchronous does not have to mean silent. When the caller sends `Accept: text/event-stream`, the endpoint
answers a stream instead of a JSON body:

```
event: node   data: { "id": "n2", "status": "success" }
event: data   data: { "chunk": "…partial output…" }
event: done   data: { "runId": "…", "status": "completed", "output": { … } }
event: error  data: { "runId": "…", "error": "Action failed" }
```

`stream.emit` lets a flow push a `data` frame; `ai.stream` emits token deltas through the same channel; the
`node` frames are the trace arriving live. Without SSE negotiation the emits are dropped and the caller gets
the same final JSON — a flow authored once works either way.

This is what keeps "no queue" honest: a 30-second AI action shows progress instead of looking hung. It does
not make the action asynchronous — the connection is the run's lifetime.

**But a long-lived response is a new kind of object for this server, and it has to be designed as one.**
Everything below is part of shipping SSE, not a hardening pass afterwards.

#### 4.6.1 What the server does not do today

`sdk-server` has no request lifecycle beyond "handle, answer, done". There is no `'close'` listener, no
`AbortController` and no `AbortSignal` anywhere in `core/`, `helpers/` or `modules/`, and
`buildResponseHelpers` is one-shot by construction: it compresses the body, sets `Content-Length` and calls
`end`. The MCP endpoint sidesteps all of it with `enableJsonResponse: true` and writes to the raw response.

So SSE brings three mechanical requirements before any safeguard:

- the stream writes to `ctx.raw`/`rawRes` directly, never through `res.send`;
- it sets `Cache-Control: no-cache, no-transform` — `no-transform` is already the helpers' signal to leave a
  body uncompressed, so the existing rule does the right thing here;
- the dispatcher gains a per-request `AbortController`, aborted on the socket's `close`, exposed on the
  context. That is useful well beyond actions (an abandoned page render is wasted origin work today), and it
  is the single prerequisite for everything in §4.6.3.

#### 4.6.2 Single-flight: one live run per key

The client engine already refuses re-entry: `InteractionsManager.eventBridgeCallback` keys
`interactionsRunning` by `subscriptorId.eventName` and drops a trigger that fires while its own flow is
still running. The server needs the same idea, keyed by what identifies a *run* rather than a DOM event:

```
runKey = idempotencyKey ?? sha256(spaceId, actionId, callerId, canonical(input))
```

`callerId` is the session subject, or the client IP for a `public` action. The key is taken as a `kv` lock
with TTL equal to the run's timeout, released on completion.

- A second **streaming** run for a live key is **refused with 409** and a `Retry-After`, carrying the live
  `runId` so the caller can report it. It is not queued and it is not started.
- A second **non-streaming** run for a live key is refused the same way. There is no reason for the rule to
  differ: two identical writes racing is the bug in both shapes.
- Attaching a second consumer to one live run (fan-out) is deliberately **not** in v1. It is the nicer UX and
  it is a second lifecycle to get wrong; a refusal is honest and reversible later.

Caps sit above the key: max concurrent runs per space, and max live streams per process. Over either, the
answer is 429 — degrading everyone's stream to keep one alive is the wrong trade.

#### 4.6.3 Cancellation, from all four directions

| Cause | Mechanism | Result |
|---|---|---|
| Client closes the socket | dispatcher `'close'` → `AbortController.abort()` | run aborts at the next node boundary; the in-flight node's own fetch is aborted through the same signal |
| Client cancels explicitly | `DELETE /_action/run/:runId`, authorized as the run's caller | cancel flag in `kv`; the runner checks it at every node boundary |
| The run outlives its budget | `limits.streamTimeoutMs` (default 120 000, absolute ceiling in deployment config) | terminal `error` frame, then close |
| The peer is gone but the socket is not | `: ping` comment frame every 15 s; abort when a write fails or buffered backpressure passes a cap | stops a stream writing into a dead connection forever |

`DELETE /_action/run/:runId` exists because the other three are not enough: a mobile client can lose its peer
without the server seeing a `close` for minutes, and a run started in one tab must be killable from another.

Two properties of abort that must be written down rather than discovered:

- **Abort is at node boundaries.** A node already in flight is signalled and awaited; the runner does not
  abandon it mid-write. What it will not do is start the next one.
- **There is no rollback.** Tasks are not transactional across a flow — an aborted run may have already sent
  the email and not yet written the record. This is inherent to orchestrating third-party systems, and the
  answer is idempotent tasks and a truthful trace (`status: 'aborted'`, with the node statuses), not a
  pretence of atomicity.

#### 4.6.4 The reconnect trap

**The client must not use `EventSource`.** `EventSource` reconnects automatically whenever the stream ends —
*including on normal completion*. Each reconnect would arrive as a fresh POST-less request and start another
run of the same flow, which completes, which reconnects: precisely the infinite loop of streaming runs of the
same action that this section exists to prevent. It also cannot send a body, so inputs would have to travel
in the URL.

So: the `serverAction` step streams over `fetch` + `ReadableStream` with the run's `AbortSignal` wired to the
step's own lifetime. The server still sends `retry: 86400000` and always terminates with a `done` or `error`
frame, so a hand-rolled `EventSource` by a third party degrades to one retry a day instead of a hot loop.
Single-flight (§4.6.2) is the backstop: even a client that ignores all of this cannot get a second run of the
same key started while the first lives.

#### 4.6.5 Loop through the outside world

The dangerous cycle is not an action calling itself — no `action.call` task exists in the catalog, by
omission that is now on purpose. It is the indirect one: an action does an `http.request` that hits its own
space's webhook URL, which starts the action again.

Every run carries a **lineage**: the chain of run ids that caused it, propagated as
`X-Plitzi-Action-Lineage` on outbound requests made by `http.request` and `connector.*`. A run whose lineage
already names this action id is refused before its first node. Depth is capped at 1 in v1 — an action may not
cause another action at all — and the cap is a deployment setting rather than a constant, because a
self-hoster composing their own tasks has a legitimate reason to raise it.

A stripped header is not a hole: the lineage is a cheap catch for the accidental loop, and the single-flight
key plus the per-space concurrency cap are what bound the malicious one.

### 4.7 Authorization, inputs, outputs

Three gates, in this order, before a single node runs:

1. **Access.** `session` (default) resolves the kernel's identity from the request; `role` intersects global
   and space permissions exactly as RFC 0010 defines; `public` skips it and is only reachable for an action
   that declared it. No action is invocable by default.
2. **Inputs.** Coerced and validated against `document.input`: unknown keys dropped, missing required keys
   refused, types enforced. Templates therefore interpolate only values that survived a declared contract —
   this is the property that makes twig-in-params safe.
3. **Resources.** `credentials` and `connectors` are resolved once, up front, and the run fails closed if a
   declared one is missing. A node cannot name a connector the document did not list.

On the way out, **only `document.output` is serialized**. A node that fetched a record carrying an API key,
an internal id or another customer's email returns none of it unless someone declared that key as output.
Credentials enter the request and never appear in a response, a trace or a log — enforced by a redaction
pass keyed on the resolved credential values, not on field names.

### 4.8 Limits, metering, observability

- **Metering:** one `meter({ kind: 'server_action', cached: false })` per run, before execution, so a
  refused-over-quota action costs nothing to run. The weight already exists in
  `plitzi-sdk-server/src/services/api/analytics/meter.ts` (`server_action: { weight: 0.25 }`); nothing about
  the schema changes, which is what that field was reserved for.
- **Limits:** wall clock, node count, outbound request count, response size, per-space concurrency, and —
  for streaming runs — live streams per space and per process. Every one has a deployment default and a
  per-action override that can only tighten it on the cloud.
- **Run lifecycle:** every run has a `runId`, a `runKey` holding its single-flight lock (§4.6.2), a lineage
  chain (§4.6.5) and an `AbortSignal`. A run refused by the lock, by a cap or by the lineage check is **not
  metered** — it never executed, and billing a 409 teaches customers to retry harder.
- **Trace:** the run returns `InteractionNode[]` — the shape the dev-tools Interactions panel already
  renders. Returned in full only to a caller holding builder permissions on the space (or to a draft
  preview); a visitor gets `{ status, output }`. This gives the Workflow debugger a **server** run in the
  same UI as a client one, which is the single biggest usability win available here and costs almost nothing.
- **Log:** one `SpaceLog` row per run at `category: 'action'` with the id, trigger, status, duration and node
  statuses. Bodies are not logged.

### 4.9 One module, one entry

All of it is **one encapsulated module** in `sdk-server` — `src/modules/actions/` — with a single public
surface and its own package entry, following `modules/mysql` (`@plitzi/sdk-server/mysql`) and the MCP split:

```
src/modules/actions/
  index.ts             # the only thing outside the module imports
  types.ts             # server-side types: task, registry, run context (documents come from sdk-shared)
  runtime/
    runAction.ts       # flow traversal
    scope.ts           # template scope + credential resolution
    guards.ts          # runKey single-flight, lineage, caps
    limits.ts          # timeouts and counters
  tasks/
    registry.ts        # built-ins + deployment-registered, validated at boot
    flow.ts transform.ts http.ts connector.ts auth.ts kv.ts
  transport/
    callHandler.ts     # action-addressed POST /_action
    webhookHandler.ts  # POST /_action/hook/:actionId
    cancelHandler.ts   # DELETE /_action/run/:runId
    stream.ts          # the SSE writer, and the only thing that touches the raw response
  connectorWrite.ts    # today's element-addressed handler, moved in unchanged
```

Three rules that keep it a module rather than a spill:

1. **One import surface.** `core/services/action.ts` (the stage) imports `modules/actions` and nothing
   deeper. The stage stays what it is today: a few lines that gate on config and delegate.
2. **Its own entry, `@plitzi/sdk-server/actions`,** so a server that mounts no actions does not pay the
   import chain — the same reasoning that took the MCP from 2755 modules to 666. The runner reaches Redis,
   drivers and the task set; none of that belongs in the boot path of a page-only server.
3. **Inert unless configured.** Exactly like `actionStage` gates on `config.connectors` today: no
   `config.actions`, no endpoint, no registry, no lock.

The module depends on `modules/connectors` (for `connector.*` tasks) and on `sdk-shared` types. Nothing
depends on it in the other direction.

### 4.10 When there is no server

The client learns whether actions exist the same way it learns about `/_rsc`: from `server.actionPath` in the
bootstrap payload. Absent — a static export, an SDK embedded with no `sdk-server` — and:

- the `serverAction` step is inert and reports it once through `pConsole`, rather than failing silently;
- the builder marks the step and any binding to its result as unavailable in that publish target, at author
  time, not at runtime;
- an element bound to a `render` action falls back to its `mockData`, exactly as `ApiContainer` already does
  when no `/_rsc` exists for the space.

The rule: an action never degrades into a client-side approximation of itself. It runs on a server or it does
not run. Silently re-executing a flow in the browser is how a credential ends up there.

## 5. Authoring: builder and MCP

**Builder** — a new `modules/Actions`, mirroring `modules/Connectors` almost file for file (it is the
closest existing sibling: a per-space server-side document with a list, a form and a validator):

- list + form (name, access, triggers, input/output fields, declared credentials and connectors);
- the **existing** `Workflow` editor for `nodes`, fed a server task catalog instead of the client one;
- a **Test run** panel: fill the declared inputs, run against the draft, see the returned trace in the same
  node UI. This is what makes the feature learnable.

The task catalog comes from the server (`GET /_action/catalog`, session-gated), never from a hardcoded list —
that is what makes a self-hoster's custom task appear in their builder with no fork.

**Docs** — [`docs/en/server-actions.md`](../en/server-actions.md) is the using-it guide: authoring, the three
call modes, the flow triggers, webhooks, schedules, the limits table, and a symptom→cause list for when a flow
does not do what its author expected.

**MCP** — mirrors the connector operations in `apps/mcp/src/modules/mcp/tools/operations/connectors/`:
`upsertAction`, `patchAction`, `deleteAction`, reading `plitzi://actions/{env}` for what exists and
`plitzi://actions/{env}/tasks` for the steps THIS deployment can run. Two properties the implementation pinned:
the ops validate through the same `validateActionDocument` the panel and the mutation use (and `patchAction`
validates the MERGED document, since removing the step that returned the output is how a flow breaks one field
at a time), and every subschema they share is registered in `schemaIds.ts` — unregistered they cost 13k of tool
listing instead of 5k, which the listing budget test caught. The agent that already authors a whole CMS integration
(`project_mcp_connectors_authoring`) should be able to author the checkout flow that uses it. The validator
gains the rules stated above: no server task in a client flow, no twig in `sql`, no undeclared credential, no
public webhook without verification.

**GraphQL** — CRUD in `plitzi-sdk-server/src/services/graphql`, same shape and same RBAC as the connector
resolvers.

## 6. What a self-hoster gets

Stated explicitly because it is the RFC 0011 test — *anything Plitzi can do that a customer cannot is a
mistake in the split*:

| Extension | Seam | Plitzi uses it for |
|---|---|---|
| Custom tasks | `createServer({ actions: { tasks } })` | `email`, `ai`, `storage`, `db` |
| Custom triggers | `PipelineExtensions` + `runAction` | Nothing yet — the four built-ins cover Plitzi |
| Custom store | `ActionLookups` | Prisma `SpaceAction` |
| Custom limits | `actions.limits` | Per-plan ceilings |
| Custom scheduler | `createScheduleRunner` | Redis leader lock in the api role |

Plitzi's own deployment is a consumer of every one of these. No private path.

## 7. Phases

| # | Delivers | Unblocks |
|---|---|---|
| **0** ✅ | Types; runner + task registry; `call` trigger on `/_action`; `runServerAction` step with `await`/`detached`; `SpaceAction` + lookups; metering; per-request `AbortController`; single-flight, lineage and cancellation | An action authored by hand and called from a button |
| **1** ✅ | Builder module reusing the Workflow editor, catalog over GraphQL, `validateActionDocument`, GraphQL CRUD, `connector.*`/`kv.*` tasks, test-run panel, MCP ops + `plitzi://actions/{env}` resources, `onFlowEnd`/`onFlowError` triggers | Anyone can author one |
| **2** ✅ | `webhook` trigger with HMAC verification over the raw body, per-caller rate limiting, delivery-id idempotency; `ai.complete` on the deployment | Stripe/CMS inbound |
| **3** ✅ | SSE negotiation, `stream.emit`, heartbeat, `DELETE /_action/run/:runId`, `stream` mode + `onFlowProgress` | Long work that shows progress |
| **4** ✅ | `render` trigger: a `runtime: 'server'` element names an action, fed the page's route and query params | Reads a manifest cannot express |
| **5** ✅ | `schedule` trigger + cron matcher (shared, so the validator refuses an expression that would never fire) + Redis leader lock in the api role; `db.query` with bound parameters, and the MySQL/MariaDB driver the deployment registers | Digests, syncs, customer databases |

Phase 0 was the whole architectural risk; everything after it was surface. Two things the phases did NOT
deliver, and why:

- **`email.send` and `storage.put`.** The deployment has no mail transport at all, and which bucket a flow may
  write into is a product decision — the space's deploy bucket holds published assets. A step whose only outcome
  is failure is worse than no step: the catalog is a promise about what a server can do.
- **Attaching a second viewer to one live stream.** Refusing a duplicate is honest and reversible; fan-out is a
  second lifecycle to get wrong.

## 8. Open questions

1. **Revision coupling.** Actions are live documents; the schema is versioned. Publishing a page whose flow
   depends on an action edited since is a real footgun. Framed as §4.2.1 puts it: **is the private document
   versioned with the deploy?** Options: leave as-is (matches connectors), snapshot the private namespace
   into the deployment revision, or version each document with a `publishedAt`. Whatever we choose applies to
   connectors and actions together, or the asymmetry is worse than either.
2. **Idempotency.** Answered for the live case and still open for the completed one. The webhook path keys
   single-flight on the sender's own delivery id (`x-github-delivery`, `idempotency-key`, …), so a retry arriving
   while the first run is going is refused — and answered **202**, because from the sender's side the work is
   happening and an error would only make a well-behaved provider retry harder. What is still open is replaying a
   COMPLETED run's result for a TTL, which is what protects against a retry that arrives a minute later.
3. **Environment scoping.** Does an action belong to a space, or to a space **and environment**? Connectors
   are per-space today. A staging action pointing at a production database is the failure mode to avoid.
4. **Quota shape.** `server_action` weight is flat at 0.25. An action making twenty outbound requests costs
   more than one doing arithmetic. Metering per outbound request, or per second of wall clock, is a later
   refinement — but the decision affects what `limits` defaults should be.

## 9. Risks

- **Scope creep into a workflow product.** The catalog is where this dies. Every task must answer "what page
  cannot be built without it". Orchestration features (parallel joins, sub-flows, human approval) are not on
  this roadmap.
- **The endpoint becomes a proxy.** Mitigated by construction: an action names only declared connectors and
  credentials, `http.request` resolves secrets server-side, and an action with a fully templated URL from
  input is a validator error, not a feature.
- **Server flows are harder to debug than client ones.** Mitigated by the trace being the same
  `InteractionNode[]` the dev-tools already render, and by the test-run panel landing in Phase 1 rather than
  "later".
- **SSE is the first long-lived response this server has ever produced.** The dispatcher has no request
  lifecycle today, the response helpers are one-shot, and HTTP/2 is in play. The mitigation is that the
  streaming path writes to the raw response like the MCP stage already does, and that the abort plumbing
  lands in Phase 0 — with the runner using it for timeouts — rather than arriving with the stream itself.
- **`db.query` is the sharpest edge in this document.** Bound parameters only, customer-owned connections
  only, and it lands last (Phase 5) on purpose.
