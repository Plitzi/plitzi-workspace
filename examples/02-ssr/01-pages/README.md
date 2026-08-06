# SSR pages

The same space as [01-client](../../01-client), rendered on the server and delivered as HTML.

```bash
yarn start                       # http://127.0.0.1:4003
curl -s http://127.0.0.1:4003/ | head -c 400
```

## What matters

Two calls, in [`src/main.ts`](./src/main.ts):

```ts
const adapters = createJsonAdapters({ offlineData: offlineDataPath });
const server = createServer({ port, httpVersion: 1, adapters });
```

**Adapters are the whole integration surface.** `createJsonAdapters` is the file-backed shortcut for getting
started; a real deployment replaces it with functions that read its own database, and nothing else changes —
the server never learns where a space came from.

`httpVersion: 1` keeps the example certificate-free. The default is HTTP/2, which needs `tls`.

## Next

Give individual elements server-resolved data: [rsc](../02-rsc).
