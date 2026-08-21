# No server tier, and nothing pretends otherwise

The same page as [02-render](../02-render), rendered by the browser alone. The elements are identical — a
`runtime: 'server'` provider naming an action, and a step that runs another — because a schema does not change
when the deployment does.

What changes is that there is nothing to ask. And the point of the example is what the SDK does about it: **it
does not try.**

```bash
yarn start
```

Open <http://127.0.0.1:4012/> with the network tab recording, and press **Fetch new cats**:

| | What happens |
|---|---|
| The gallery | renders two mock cats. No request for `/_rsc` |
| The button | puts `The step reported: skipped` on the page. No request for `/_action` |
| The dev-tools panel | *Server action **cat-gallery** was skipped: this page is served without a Plitzi server* |

No 404s, no failed fetches, no console errors — no requests at all.

## Why it can know

A server that runs actions publishes where: `server.ssr.actionPath`, alongside `rscPath`. **Absence is the
signal.** A client-only render — this example, an embed, a static export, the builder canvas — is handed no such
block, so the SDK seeds no endpoint and `runServerAction` returns before it builds a request:

```ts
if (!endpoint) {
  // Said once, plainly: the step is not broken, this render simply has no server tier to run it on.
  return { status: 'skipped', runId: '', output: {} };
}
```

The alternative is what makes this worth an example: with no such signal, every click would discover the same
fact by POSTing to `/_action` against whatever origin the page happens to sit on, and reading a 404 — or worse,
somebody else's 200.

## A skipped run is a result, not an exception

The flow carries on. The step after the call reads `{{refresh-run.status}}` and writes it to state, which is why
the page can say `skipped` out loud without a line of code:

```
onClick → runServerAction (cat-gallery) → setState runStatus = {{refresh-run.status}}
```

That is the whole reason it returns a status instead of throwing: an author can bind it, branch on it with a
`when` rule, or ignore it — the same as any other step's result.

## Mock data is for exactly this

A `runtime: 'server'` element resolves from an RSC payload, which only a server produces. With none, the SDK
renders the `mockData` the author left on it — so the section keeps its shape here, in a static export and in the
builder canvas, instead of collapsing to nothing while somebody edits around it.

The other case is kept apart on purpose: a payload that **arrived** and did not contain this element's key means
its provider failed, and the element reports that rather than quietly showing mock data on a production page.

## What this is not

It is not a way to run server actions without a server. Everything the action would have done — the fetch, the
credential, the decision — still needs one. This example is about the *page* being honest when it is missing, so
the failure mode is a section with mock cats and a status line, not a browser console full of 404s.

## Next

Nothing — this is the end of the tour. The mechanism is documented in
[`server-actions.md`](../../../docs/en/server-actions.md), and the reasoning behind each rule in
[RFC 0012](../../../docs/rfc/0012-server-actions.md).
