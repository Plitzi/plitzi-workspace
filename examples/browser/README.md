# In the browser

A space on a page with `@plitzi/plitzi-sdk` alone — no server, no account, no API key. The browser is handed a
`{ schema, style }` and renders it: nothing to deploy, nothing to keep running, and no request before the first paint.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [no-build](./01-no-build) | A plain HTML file. No bundler, no build step | 4000 |
| 02 | [render](./02-render) | The same `render()` call from a bundled app | 4001 |
| 03 | [react-component](./03-react-component) | `<PlitziSdk>` inside your own React tree | 4002 |
| 04 | [no-server](./04-no-server) | A page that names server actions, with no server: every server-side step declares itself inert | 4012 |

They render the same space, so the difference between 01–03 is the wiring and nothing else. 04 is what a page that
was built for a server does without one: the step that would call an action and the element that would be fed by one
both report themselves inert, without issuing a request. A page that learns this per click, from a 404, is the
failure mode being avoided.

## Two things every browser-rendered host page must do

Both are the same decision: the SDK assumes nothing about the page it lands on, so the page states what it wants.

**`renderMode: 'raw'`** — without it the SDK renders inside an **iframe**, which is its default and the safe choice
when a space is dropped into a page it knows nothing about. When the page is yours, `raw` renders into your document:
one stylesheet, no frame, no scroll trap.

**A page reset** — the SDK ships no global CSS on purpose, so dropping a space into an existing site cannot restyle
that site. The browser's default margins survive unless the host clears them. Each example imports Tailwind's
preflight, in a cascade layer so the SDK's own styling still wins.

## Next

Move the render to a server of your own: [`self-hosting`](../self-hosting).
