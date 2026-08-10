# My first space

Getting a space onto a page, four ways. The first three render **in the browser** with `@plitzi/plitzi-sdk` alone —
no server, no account, no API key. The fourth moves the render to the server.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [no-build](./01-no-build) | A plain HTML file. No bundler, no build step | 4000 |
| 02 | [render](./02-render) | The same `render()` call from a bundled app | 4001 |
| 03 | [react-component](./03-react-component) | `<PlitziSdk>` inside your own React tree | 4002 |
| 04 | [server-rendered](./04-server-rendered) | The same space, rendered by the server | 4003 |

## With or without a server

They render the same space, so the difference is the wiring and nothing else.

**Without** (01–03) the browser is handed a `{ schema, style }` and renders it. There is nothing to deploy, nothing
to keep running, and no request before the first paint.

**With** (04) the HTML arrives already rendered: the page is meaningful before any JavaScript executes, which is what
search engines and slow connections see. It is also the only version that can do anything *per request* — know who
the visitor is, resolve data server-side, keep a secret. The next three categories all build on that.

## Two things every browser-rendered host page must do

Both are the same decision: the SDK assumes nothing about the page it lands on, so the page states what it wants.

**`renderMode: 'raw'`** — without it the SDK renders inside an **iframe**, which is its default and the safe choice
when a space is dropped into a page it knows nothing about. When the page is yours, `raw` renders into your document:
one stylesheet, no frame, no scroll trap.

**A page reset** — the SDK ships no global CSS on purpose, so dropping a space into an existing site cannot restyle
that site. The browser's default margins survive unless the host clears them. Each example imports Tailwind's
preflight, in a cascade layer so the SDK's own styling still wins.

## Next

Give the space people: [`02-with-users`](../02-with-users).
