# Plitzi as a React component

Plitzi mounted **inside your own React tree**, next to your own components — not owning the page.

```bash
yarn start   # http://localhost:4002
yarn start:dev   # the same, with Vite's HMR, while you edit it
```

## What matters

[`src/App.tsx`](./src/App.tsx) is your app. Plitzi is one element of it:

```tsx
<section style={styles.canvas}>
  {visible && <PlitziSdk offlineMode offlineData={offlineData} environment={environment} />}
</section>
```

That is the whole difference from [render](../02-render). `render()` takes a container id and owns the React
root — right when Plitzi *is* the page. As a component it lives in your tree instead, so it:

- re-renders when your state changes (the header's `environment` select drives it directly),
- sits inside your layout rather than replacing it,
- mounts and unmounts like anything else (the button proves it).

The props are the same either way — `render()` just forwards them to this component.

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

## When to use which

| | Use |
|---|---|
| The page *is* the space | [`render()`](../02-render) — or [no build at all](../01-no-build) |
| The space is a region of your app | `<PlitziSdk>`, this example |

## Next

Move the render to the server: [server-rendered](../04-server-rendered).
