# Client rendering

The space rendered **in the browser**, using `@plitzi/plitzi-sdk` on its own. No server, no account, no API key —
the SDK is handed a `{ schema, style }` and renders it.

| | Example | Difference | Port |
|---|---|---|---|
| 01 | [no-build](./01-no-build) | A plain HTML file. No bundler, no build step | 4000 |
| 02 | [render](./02-render) | The same `render()` call from a bundled app | 4001 |
| 03 | [react-component](./03-react-component) | `<PlitziSdk>` inside your own React tree | 4002 |

## Two things every host page must do

Both are the same decision: the SDK assumes nothing about the page it lands on, so the page states what it wants.

**`renderMode: 'raw'`** — without it the SDK renders inside an **iframe**, which is its default and the safe
choice when a space is dropped into a page it knows nothing about. When the page is yours, `raw` renders into
your document: one stylesheet, no frame, no scroll trap.

**A page reset** — the SDK ships no global CSS on purpose, so dropping a space into an existing site cannot
restyle that site. The browser's default margins survive unless the host clears them. Each example imports
Tailwind's preflight, in a cascade layer so the SDK's own styling still wins.

## Next

Move the render to the server: [`02-ssr`](../02-ssr).
