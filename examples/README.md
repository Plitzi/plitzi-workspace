# Examples

Runnable Plitzi setups, ordered as a space actually grows: put it on a page, give it people, give it data, let an
agent edit it, have it do work on the server. Each one is a real workspace package you can start and hit — no
pseudo-code, no snippets that assume a step not shown.

## [`01-my-first-space`](./01-my-first-space) — getting it onto a page

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [no-build](./01-my-first-space/01-no-build) | A plain HTML file: no bundler, no build step | 4000 |
| 02 | [render](./01-my-first-space/02-render) | The same `render()` call from a bundled app | 4001 |
| 03 | [react-component](./01-my-first-space/03-react-component) | `<PlitziSdk>` inside your own React tree | 4002 |
| 04 | [server-rendered](./01-my-first-space/04-server-rendered) | The same space, rendered by the server | 4003 |

01–03 need no server at all. 04 is the same space with the render moved to the server, which is what the rest of
these build on.

## [`02-with-users`](./02-with-users) — the space knows who is looking

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [sessions](./02-with-users/01-sessions) | Sign in, renew, sign out — over an account store you provide | 4007 |
| 02 | [mysql](./02-with-users/02-mysql) | The same, over a MySQL of your own — tables and adapters included | 4008 |

## [`03-with-data`](./03-with-data) — elements that resolve data on the server

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [server-components](./03-with-data/01-server-components) | Per-element server data via React Server Components | 4004 |

## [`04-with-an-agent`](./04-with-an-agent) — an agent edits it

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [mcp-server](./04-with-an-agent/01-mcp-server) | A dedicated MCP server an agent edits the space through | 4005 |
| 02 | [ssr-preview](./04-with-an-agent/02-ssr-preview) | MCP and pages on one port, plus draft preview | 4006 |

## [`05-with-server-actions`](./05-with-server-actions) — it does work on the server

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [actions](./05-with-server-actions/01-actions) | A declarative flow the server runs, called from a page | 4009 + 4010 |
| 02 | [render](./05-with-server-actions/02-render) | The server fetches an API while the page renders | 4011 |

Every example renders [`shared-space`](./shared-space), so the difference between any two is the wiring alone — bar
the two that need a page of their own: `02-with-users`, because a space with people in it has somewhere to sign in,
and `05-with-server-actions`, because something has to press the button. Only `02-with-users/02-mysql` needs a
database; everywhere else a real deployment reads rows and these hand the server static data through the same
adapters, which is exactly how your own store plugs in.

## Running one

Examples consume the workspace packages as **built output**, so build once from the repo root:

```bash
yarn install
yarn build:dev
yarn workspace @plitzi/plitzi-sdk build-vendor:prod   # only 01-my-first-space/01-no-build needs this
```

Then start whichever you want:

```bash
yarn workspace @plitzi/example-with-users start
# or
cd examples/02-with-users/01-sessions && yarn start
```

Every example takes `PORT` if the default collides. `yarn start` at the repo root does **not** boot the examples —
it is the package dev loop, and eight extra servers fighting for ports would only get in the way.

## These are checked

Each example has a browser spec asserting what its own README claims — the pages it says it serves, the flows it
says it supports, the response it says it returns. Run them with `yarn e2e` from the repo root; the servers boot
themselves. See [`e2e/README.md`](../e2e/README.md).

An example that stops working is a new user blocked at step one, so the suite treats each of these as a promise
rather than a demo.

## Where to go next

Read them in order: each category is the previous one plus the next thing a real space needs. The packages
themselves are documented in [`@plitzi/sdk-server`](../apps/server/README.md) and
[`@plitzi/sdk-mcp`](../apps/mcp/README.md).
