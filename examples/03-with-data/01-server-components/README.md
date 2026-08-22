# SSR + React Server Components

Elements that get their data from the server, both on the initial render and on later partial refreshes.

```bash
yarn start
curl -s 'http://127.0.0.1:4004/_rsc?location=%2F'                     # every slice
curl -s 'http://127.0.0.1:4004/_rsc?location=%2F&ids=<id>'            # just one (the server prints the id)
```

## What matters

One adapter, in [`src/main.ts`](./src/main.ts):

```ts
adapters: { ...createJsonAdapters({ offlineData: offlineDataPath }), getRscData }
```

`getRscData` returns `serverData` keyed by schema element ID — the opaque one, not the name. The sample space
names its three RSC elements `rsc-server`, `rsc-client` and `rsc-shared`, and this example turns those names into
ids once with `elementIdOf(schema, 'rsc-server')`: a space authored in code derives its ids, and the name is the
part a person wrote down. Each element then reads its own slice. **RSC turns itself on because the adapter
exists**; there is no separate flag.

**An RSC element has two halves.** `getRscData` is the data; a component still has to render it. `serverInfo`,
`clientInfo` and `sharedInfo` are element types this space uses and the SDK does not ship, so this deployment
supplies them itself — [`src/plugins/`](./src/plugins), registered under `plugins` and named in the deployment's
`pluginNames`. Provide one half and not the other and the elements resolve to nothing: the page renders, their
section is empty, and nothing anywhere reports an error.

Two more details worth copying:

- **Honour `ids`.** It is set on partial refreshes. Ignoring it means rebuilding every slice to answer a request
  for one.
- **`?location=` is the visitor's page**, not `/_rsc`. The refresh is issued against the endpoint, so without it
  nothing would match a page in the schema.

This code runs on the server only, so credentials and query cost never reach the browser.

## Next

Let an agent edit it: [04-with-an-agent](../../04-with-an-agent).
