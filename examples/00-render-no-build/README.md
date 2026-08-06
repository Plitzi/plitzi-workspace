# 00 — Render with no build

A Plitzi space rendered from a plain HTML file. **No bundler, no build step, no npm install** — the same shape
the SDK's own `index.html` uses.

```bash
yarn start   # http://127.0.0.1:4000
```

The server is [`serve.mjs`](./serve.mjs): thirty lines of `node:http` with no dependencies, because pulling in a
bundler to serve a no-build example would defeat it. Any static host does the same job.

## What matters

An **import map**, in [`public/index.html`](./public/index.html). It tells the browser where bare specifiers
resolve, so `import { render } from '@plitzi/plitzi-sdk'` works with nothing compiling it:

```html
<script type="importmap">
  {
    "imports": {
      "react": "/sdk-assets/plitzi-sdk-vendor.js",
      "react-dom/client": "/sdk-assets/plitzi-sdk-vendor.js",
      "react/jsx-runtime": "/sdk-assets/plitzi-sdk-vendor.js",
      "@plitzi/plitzi-sdk": "/sdk-assets/plitzi-sdk.js"
    }
  }
</script>
```

Every react specifier points at **one** vendor file on purpose: the SDK and the elements it renders must share a
single React instance, and separate copies would break hooks.

The space itself is fetched at runtime, so nothing about it is compiled in either:

```js
const offlineData = await fetch('/offline-data.json').then(res => res.json());
render('plitzi', { offlineMode: true, offlineData, environment: 'main' });
```

## Requirements

The SDK's built assets, which this serves under `/sdk-assets`:

```bash
yarn build:dev            # from the repo root
yarn workspace @plitzi/plitzi-sdk build-vendor:prod
```

`PORT=4010 yarn start` moves it if 4000 is taken.

## Next

The same call from a bundled app: [01 — render-offline](../01-render-offline).
