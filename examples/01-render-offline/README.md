# 01 — Render offline

The smallest thing that renders a Plitzi space: a Vite app, one file of code, no server, no account, no API key.

```bash
yarn start   # http://localhost:4001
```

## What matters

[`src/main.tsx`](./src/main.tsx) is the whole example:

```tsx
render('plitzi-root', { offlineMode: true, offlineData, environment: 'main' });
```

`offlineMode` is the switch. The SDK renders the `{ schema, style }` you hand it instead of fetching a space, so
the page is fully self-contained. Swap `offlineData` for your own export and it renders that.

## Next

Compose it into your own React tree instead of owning the page: [02 — react-component](../02-react-component).
