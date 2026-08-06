# 02 — Plitzi as a React component

Plitzi mounted **inside your own React tree**, next to your own components — not owning the page.

```bash
yarn start   # http://localhost:4002
```

## What matters

[`src/App.tsx`](./src/App.tsx) is your app. Plitzi is one element of it:

```tsx
<section style={styles.canvas}>
  {visible && <PlitziSdk offlineMode offlineData={offlineData} environment={environment} />}
</section>
```

That is the whole difference from [01](../01-render-offline). `render()` takes a container id and owns the React
root — right when Plitzi *is* the page. As a component it lives in your tree instead, so it:

- re-renders when your state changes (the header's `environment` select drives it directly),
- sits inside your layout rather than replacing it,
- mounts and unmounts like anything else (the button proves it).

The props are the same either way — `render()` just forwards them to this component.

## When to use which

| | Use |
|---|---|
| The page *is* the space | [`render()`](../01-render-offline) — or [no build at all](../00-render-no-build) |
| The space is a region of your app | `<PlitziSdk>`, this example |

## Next

Move the render to the server: [03 — ssr-pages](../03-ssr-pages).
