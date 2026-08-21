# Server actions

Work a page cannot do in the browser — priced, decided or charged on the server — authored as a **document** the
server runs. The page hands over an action's **name** and its inputs, and gets back what the flow chose to answer.

```bash
yarn start

# the published site: a page calling the action
curl -s http://127.0.0.1:4009/_action \
  -H 'content-type: application/json' \
  -d '{"actionId":"shipping-quote","input":{"city":"Berlin","weightKg":2}}'

# the same action on the draft — one edit later
curl -s http://127.0.0.1:4010/_action \
  -H 'content-type: application/json' \
  -d '{"actionId":"shipping-quote","input":{"city":"Berlin","weightKg":2}}'
```

```jsonc
// 4009 — the copy publishing left at revision 2
{ "total": 8,  "summary": "Berlin: 8 EUR — quoted by the copy published at revision 2" }
// 4010 — the live document, which somebody has since repriced
{ "total": 11, "summary": "Berlin: 11 EUR — quoted by the draft" }
```

Open <http://127.0.0.1:4009/> for the same thing through a page: fill in the form, press **Get a quote**, and the
answer appears. The browser sent a name and two values.

## What matters

**One config key turns it on**, in [`src/main.ts`](./src/main.ts):

```ts
action: { lookups, tasks: [shippingRate] }
```

`lookups` is how this server reaches the space's actions — [`src/actions.ts`](./src/actions.ts), where a real
deployment reads rows and this one reads an array. Without it there is no endpoint at all, rather than one whose
behaviour somebody has to guess at.

**An action is a name and a flow.** [`src/actions.ts`](./src/actions.ts) holds two documents — the same node map
an element's interactions are, with tasks where a page has callbacks. What starts a run, who may start it and what
they may send all live on the **trigger step**, exactly as an element's `onClick` carries its own: a second way in
is a second trigger step, not another field. In the builder that means one editor and no form around it — pick a
trigger, say who may use it, chain the tasks. There is no default access rule, because an unstated one is either a
lock-out or a hole.

**The output step is the contract.** The task returns `{ city, band, total, currency }`; the flow's last step names
three of them, and `band` never leaves the server. Nothing else declares the shape, so nothing else can disagree
with it — and everything the flow produced and did not name stays where it was computed.

**Undeclared input is dropped** before a single step runs. Send `"discount":"free"` and it is gone by the time any
`{{ input.* }}` is interpolated, which is what makes interpolation into a step's params safe at all.

**The `kv` steps count in this process only**, which is honest for one replica and a rate limit that multiplies by
however many you run. A cluster passes its own store — `action.kv`, four methods over whatever it already has
open. The SDK connects to nothing itself.

**Your own tasks are the extension point.** [`src/tasks.ts`](./src/tasks.ts) registers `example.shippingRate`, and
it appears in the builder's step catalog with no fork of anything — that catalog is served by *this* server, so
what a space can do server-side is decided by the process running it.

## Two ports, one rule

The example starts the same space twice: **4009 is published** (`production`, revision 2) and **4010 is the draft**
(`main`, revision 0). Everything else about them is identical — one process, one schema, one action store.

Publishing **copies** every action into the revision it published. So which version a run reads is decided by what
started it:

| Started by | Reads |
|---|---|
| A page — a step in its flow, or a `render` element | the version that page was published with |
| A webhook, a schedule, a trigger the deployment mounted | the draft |

The second row is deliberate: nothing about a sender or a clock names a revision, and an integration pinned to an
old one would keep answering with a flow its author already fixed. A revision with no copy falls back to the draft,
so a space published before any of this existed keeps working.

**Connector manifests are versioned by the same publish**, and their lookup takes the same argument — so a run
keeps one version end to end: the action a page called, and the manifests its steps read through.

## The webhook

The other way in, and the one an attacker can reach without a session. It is public by construction, so the
signature is the boundary — checked against the **raw bytes**, before the body is parsed and before any work starts:

```bash
BODY='{"event":"page_view"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac 'example-webhook-secret' -r | cut -d' ' -f1)

curl -s -X POST http://127.0.0.1:4009/_action/hook/visit-digest \
  -H 'content-type: application/json' -H "x-example-signature: $SIG" -d "$BODY"
# → {"accepted":true,"runId":"…","status":"completed"}
```

Without the header it is **401**, and the log says which half failed while the response does not — a 404 that told
a caller "the action exists, your signature is wrong" is an oracle for both.

The secret is a template resolved against the credentials the **document declared**, and reaches nothing else. It
is never in the flow scope: an ambient `{{ credential.… }}` would be interpolable by every step, including the one
that answers the browser.

The sender gets `accepted`, a run id and a status — never the output. A digest is work the space asked for, not an
answer the sender is owed.

## Reading the trace

`devMode: true` sends each step's result back with the answer, which is what the builder's **Test run** panel
shows. A deployment with it off answers the output alone.

## Next

The same mechanism from the other end: [02-render](../02-render), where nobody clicks — the action runs while the
page is being rendered and the browser is handed a finished page.

The mechanism is documented in [`server-actions.md`](../../../docs/en/server-actions.md), and the reasoning
behind each rule sits beside the code that enforces it.
