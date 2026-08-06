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

## The page reset

`@plitzi/plitzi-sdk` ships **no global CSS on purpose**: dropping a space into an existing site must not restyle
that site. So the browser's default margins are still there unless the host page clears them — and in this
example the host page is yours.

[`src/preflight.css`](./src/preflight.css) is one line:

```css
@import 'tailwindcss/preflight.css' layer(base);
```

Only the preflight — the utility generator would need a build step, and this example uses no utilities. The
`layer(base)` is required: the file ships unlayered, and unlayered rules beat every layered one.

It loads **before** the SDK stylesheet, and lands in Tailwind's `base` layer while the SDK's rules live in
`plitzi-sdk-base`. Later-declared layers win, so on anything the two both touch, the SDK's own styling does.

Without it you get a white gutter around the render — the `body` margin every browser applies by default.

## Next

Compose it into your own React tree instead of owning the page: [02 — react-component](../02-react-component).
