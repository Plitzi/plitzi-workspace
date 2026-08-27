# SSR pages

The same space as the three browser examples beside it, rendered on the server and delivered as HTML.

```bash
yarn start                       # http://127.0.0.1:4003
yarn start:dev                   # the same, reloading on save, while you edit it
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

Give the space people: [02-with-users](../../02-with-users) — or give elements server-resolved data:
[03-with-data](../../03-with-data).
