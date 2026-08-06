# 04 — SSR + React Server Components

Elements that get their data from the server, both on the initial render and on later partial refreshes.

```bash
yarn start
curl -s 'http://127.0.0.1:4004/_rsc?location=%2F'                     # every slice
curl -s 'http://127.0.0.1:4004/_rsc?location=%2F&ids=rsc-server'      # just one
```

## What matters

One adapter, in [`src/main.ts`](./src/main.ts):

```ts
adapters: { ...createJsonAdapters({ offlineData: offlineDataPath }), getRscData }
```

`getRscData` returns `serverData` keyed by schema element id — the sample space carries `rsc-server`,
`rsc-client` and `rsc-shared`, and each element reads its own slice. **RSC turns itself on because the adapter
exists**; there is no separate flag.

Two details worth copying:

- **Honour `ids`.** It is set on partial refreshes. Ignoring it means rebuilding every slice to answer a request
  for one.
- **`?location=` is the visitor's page**, not `/_rsc`. The refresh is issued against the endpoint, so without it
  nothing would match a page in the schema.

This code runs on the server only, so credentials and query cost never reach the browser.

## Next

The AI surface: [05 — mcp-server](../05-mcp-server).
