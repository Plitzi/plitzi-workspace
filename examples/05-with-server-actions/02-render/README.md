# The server fetches, the page arrives finished

The other way an action runs: not because somebody clicked, but because a page is being rendered. The HTML that
leaves this server already has the pictures in it — no browser request, no loading state, and no sign anywhere in
the page of where they came from.

```bash
yarn start
```

Open <http://127.0.0.1:4011/>, then <http://127.0.0.1:4011/?limit=3>. The terminal prints a run per page load:

```
[example] run cat-gallery via render — completed in 459ms
```

```bash
# what the page was built from, on its own
curl -s 'http://127.0.0.1:4011/_rsc?location=%2F&ids=cats-provider'
# → {"serverData":{"cats-provider":{"records":[{"id":"b8d","url":"https://…/b8d.jpg",…}],"count":8}}}

# and it really is in the HTML, not fetched afterwards
curl -s http://127.0.0.1:4011/ | grep -c '<img'
# → 8
```

## What matters

**The trigger is the page.** [`src/actions.ts`](./src/actions.ts) declares one way in — a `render` step — and that
is what makes this action reachable while a page is built and not from a browser call. The same document could
carry a `call` step too; each way in states its own access rule and its own input, so opening one does not open
the others.

**Its input is the page's own context.** Route params first, then query params, then anything the element
declares. `?limit=3` arrives as `input.limit`, coerced to a number by the trigger's contract before a step runs —
which is what makes interpolating it into a URL safe. Send `?limit=nonsense` and the run is refused as invalid
input rather than passing it on.

**No task was written for this.** The flow is `http.request` and `flow.output`, both shipped by `sdk-server`. An
action that reads an HTTP API is authored, not coded — and the URL it reads never reaches the browser.

**The output step is the element's contract too.** A provider element reads `records`, so that is what the last
step names:

```ts
params: { values: '{"records": {{ fetch.data }}, "count": {{ fetch.data|length }}}' }
```

An unquoted token keeps its own type and an array serializes as JSON, so `records` is the list itself rather than
its text. `status` and `ok` came back from the fetch and stay on the server, because no step named them — and this
one matters more here than on a call: a render slice is serialized **into the page**, so anything the output step
names is published to every visitor of that URL.

## Three elements, no code

[`src/space.ts`](./src/space.ts) is the whole front end:

| Element | What it does |
|---|---|
| `apiContainer`, `runtime: 'server'`, `action: 'cat-gallery'` | names the producer; the action's output becomes its data |
| `list`, `source: 'controlled'`, `items` ← `apiContainer_cats.records` | renders its children once per record |
| `image`, `src` ← `list_catList.item.url` | one row's template, bound to one field |

A source is named after the element's `idRef` — `apiContainer_cats`, `list_catList` — which is why a binding
survives an element being renamed or moved.

It is the same `apiContainer` a connector-backed section uses: the attribute decides which producer resolves it,
so a section fed by a CMS today and by an action tomorrow is one attribute apart. Notice also that the count and
the error line are **bindings**, not code: the provider publishes `count`, `isEmpty`, `hasError` and
`errorMessage` alongside the records, so "how many" and "it didn't work" are authored like anything else.

## The caches are off, on purpose

```ts
cacheTtlMs: 0,
rsc: { cacheTtlMs: 0 }
```

HTML is cached for five minutes by default and the RSC payload for thirty seconds — sane for a page that is the
same for everyone, and exactly wrong for one whose point is a different answer every time. When work you can see
the server doing stops showing up in the page, this is the first thing to look at.

## When the fetch fails

Pull the network and reload. The page still renders: each server element resolves on its own, so a slice that
failed costs its own section and nothing else. The reason is in the server log, and the page says what a visitor
can act on through the `errorMessage` binding — never the URL, the status or the host.

## Next

Nothing — this is the end of the tour. The mechanism is documented in
[`server-actions.md`](../../../docs/en/server-actions.md), and the reasoning behind each rule in
[RFC 0012](../../../docs/rfc/0012-server-actions.md).
