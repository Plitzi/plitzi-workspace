# Examples

Runnable Plitzi setups you start and hit — no pseudo-code, no snippets that assume a step not shown. Each one is a
real workspace package.

A space on the platform (`*.plitzi.app`) needs none of these: the server, the accounts, the functions and the CDN are
the platform's, and what runs there is shown as seeded spaces in `plitzi-sdk-server/prisma/seeds/spaces` — Ceniza,
a whole restaurant website (`ceniza`); Tremor, a live WebGL globe of USGS earthquakes whose globe is a plugin on the
space's CDN and whose server code is its functions (`tremor`); Fieldnotes, a blog whose visitors sign in with their
Plitzi account and whose author role the space declares and gives by email (`blog`); a server action and a render
action (`shipping-quote`, `cat-gallery`); and a template, the pricing card on `saas-landing`'s CDN. What is here is
the rest: a space on a page of your own, and a server of your own.

## [`browser`](./browser) — a space on your page, no server

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [no-build](./browser/01-no-build) | A plain HTML file: no bundler, no build step | 4000 |
| 02 | [render](./browser/02-render) | The same `render()` call from a bundled app | 4001 |
| 03 | [react-component](./browser/03-react-component) | `<PlitziSdk>` inside your own React tree | 4002 |
| 04 | [no-server](./browser/04-no-server) | The same page with no server tier: every server-side step inert | 4012 |

## [`self-hosting`](./self-hosting) — a server of your own

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [server-rendered](./self-hosting/01-server-rendered) | The same space, rendered by the server | 4003 |
| 02 | [from-the-cloud](./self-hosting/02-from-the-cloud) | Your server, serving a space that lives in Plitzi | 8080 |
| 03 | [sessions](./self-hosting/03-sessions) | Sign in, renew, sign out — over an account store you provide | 4007 |
| 04 | [mysql](./self-hosting/04-mysql) | The same, over a MySQL of your own — tables and adapters included | 4008 |
| 05 | [server-components](./self-hosting/05-server-components) | Per-element server data via React Server Components | 4004 |
| 06 | [mcp-server](./self-hosting/06-mcp-server) | A dedicated MCP server an agent edits the space through | 4005 |
| 07 | [ssr-preview](./self-hosting/07-ssr-preview) | MCP and pages on one port, plus draft preview | 4006 |
| 08 | [custom-trigger](./self-hosting/08-custom-trigger) | A trigger of your own, over a store you already run | — |
| 09 | [schedules](./self-hosting/09-schedules) | Scheduled and delayed jobs over a durable queue in SQLite, across replicas | 4016 |
| 10 | [runtime](./self-hosting/10-runtime) | A space's runtime — a task, a route and a stream held open, in one module — loaded into a server of your own | 4017 |

Ordered as a space actually grows: render it on the server, give it people, give it data, let an agent edit it,
have it do work on its own — and give it server code of its own, beside it.

Every example renders [`shared-space`](./shared-space), so the difference between any two is the wiring alone — bar
the ones that need pages of their own: `sessions` and `mysql`, because a space with people in it has somewhere to
sign in, and `no-server`, `custom-trigger`, `schedules` and `runtime`, because something has to press the button. Only `mysql` needs a database; everywhere else a real
deployment reads rows and these hand the server static data through the same adapters, which is exactly how your
own store plugs in.

## Running one

Examples consume the workspace packages as **built output**, so build once from the repo root:

```bash
yarn install
yarn build:dev
yarn workspace @plitzi/plitzi-sdk build-vendor:prod   # only browser/01-no-build needs this
```

Then start whichever you want:

```bash
yarn workspace @plitzi/example-with-users start
# or
cd examples/self-hosting/03-sessions && yarn start
```

While you are editing one, `start:dev` is the same thing that reloads itself:

```bash
cd examples/self-hosting/03-sessions && yarn start:dev
```

Every example has it. What it means depends on what the example is: the bundled browser ones (`browser/02`, `03`
and `04`) get Vite's HMR, so a change lands without losing the page's state; the server ones restart on save and the
page picks it up on the next request; and `browser/01-no-build` uses Node's own watcher, because an example whose
whole point is that nothing is compiled should not need a bundler to develop.

Every example takes `PORT` if the default collides. `yarn start` at the repo root does **not** boot the examples —
it is the package dev loop, and eight extra servers fighting for ports would only get in the way.

## Checking them

Each example has a browser spec asserting what its own README claims — the pages it says it serves, the flows it
says it supports, the response it says it returns. Run them with `yarn e2e --project=examples` from the repo root;
the servers boot themselves. See [`e2e/README.md`](../e2e/README.md).

They are not part of the workspace's own checks: the root `yarn test`, `yarn lint`, `yarn typecheck` and `yarn e2e`
leave them out, and so does CI. An example you change is one you check, with its own scripts or the command above.

## Where to go next

Read them in order: `browser` first, then `self-hosting`, each one the previous plus the next thing a real space
needs. The packages themselves are documented in [`@plitzi/sdk-server`](../apps/server/README.md) and
[`@plitzi/sdk-mcp`](../apps/mcp/README.md).
