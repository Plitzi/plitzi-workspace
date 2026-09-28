# Self-hosting

A space served by a server of your own, with `@plitzi/sdk-server` and `@plitzi/sdk-mcp`. On the platform
(`*.plitzi.app`) all of this is already running; these are for when the server has to be yours — your domain, your
accounts, your database, your queue — and they show exactly what that server has to be handed.

Ordered as a space actually grows: render it on the server, give it people, give it data, let an agent edit it, have
it do work on its own. Each one is the previous one plus the next thing a real deployment needs.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [server-rendered](./01-server-rendered) | The space of [`browser`](../browser), rendered by the server | 4003 |
| 02 | [from-the-cloud](./02-from-the-cloud) | Your server, serving a space that lives in Plitzi | 8080 |
| 03 | [sessions](./03-sessions) | Sign in, renew, sign out — over an account store you provide | 4007 |
| 04 | [mysql](./04-mysql) | The same, over a MySQL of your own — tables and adapters included | 4008 |
| 05 | [server-components](./05-server-components) | Per-element server data via React Server Components | 4004 |
| 06 | [mcp-server](./06-mcp-server) | A dedicated MCP server an agent edits the space through | 4005 |
| 07 | [ssr-preview](./07-ssr-preview) | MCP and pages on one port, plus draft preview | 4006 |
| 08 | [custom-trigger](./08-custom-trigger) | A way in this deployment mounts itself — a queue consumer — over a store it already runs | — |
| 09 | [schedules](./09-schedules) | Scheduled and delayed jobs over a durable queue in SQLite, across replicas | 4016 |
| 10 | [whiteboard](./10-whiteboard) | Pizarra: a collaborative whiteboard — every stroke through a server action, every cursor and saved shape through realtime channels | 4016 |

## Rendered on the server

**01–02** — the HTML arrives already rendered: the page is meaningful before any JavaScript executes, which is what
search engines and slow connections see. It is also the only version that can do anything *per request* — know who
the visitor is, resolve data server-side, keep a secret. Where the space comes from is a separate decision: 01 reads
a file, 02 reads the live document out of the builder. Neither changes anything else about the server.

## With people

**03–04** are the same pages and differ only in where the people come from, which is the choice actually in front of
you. **Already have a user table?** Implement the adapters against it — that is 03, and the store there is two rows
in an array on purpose, because the shape is the same whether your accounts live in Postgres, MySQL, Mongo or an
identity service. **Standing one up?** 04 hands you the schema and every adapter already written, so it is a
connection string rather than sixteen functions and a migration.

Everything else is already decided: how a session travels, when it renews, what a `401` means, and how signing out
in one place ends it everywhere. That is the part nobody should be reimplementing.

## With data

**05** — an element marked `runtime: 'server'` renders on the server with data the browser never fetched and secrets
it never saw. One marked `client` hydrates as usual, and `shared` does both — so a page mixes them without the host
choosing one model for everything.

## With an agent

**06–07** — an [MCP](https://modelcontextprotocol.io) server an agent reads and edits the space through. Both write
to a **temp copy** of the sample space, so a session never dirties the fixture. 06 is the shape a real MCP
deployment has. 07 is the integration worth reading last: an agent proposes edits, they render without being saved,
and a normal page request serves that draft once.

## Doing work on its own

**08–09** — the seams of server actions a platform space cannot show. The page names an action and hands it inputs;
it never learns what happened in between, because the flow is a **document the server holds**, not code the browser
carries. A page calling an action, and an action feeding a page while it renders, need no server of your own — they
are seeded spaces on the platform (`shipping-quote` and `cat-gallery`, in
`plitzi-sdk-server/prisma/seeds/spaces/examples`).

08 is the extension point the built-in triggers leave: a way in nobody built, mounted by calling the runner, with
every check the built-in ones get. It runs, prints and exits. 09 is the work nobody starts at all — a cron, or a job
due in five seconds — and the durable queue that makes it survive a restart, a second replica and a replica killed
half-way through. It is also the self-hosted shape of the whole thing: every store the server needs is one the
deployment brings.

## A whole product

**10** — Pizarra, everything above assembled. The others each show a single decision and stop; this is the one to
read when the question is not "how does X work" but "what does it take to build something". It is allowed to be
opinionated where the others are not — it picks a route shape, a permission name, a place to keep its data —
because a product has to. What it may not do is hide a step: everything it configures is configured the way the
single-decision examples show it.

## Next

The mechanisms are documented in [`@plitzi/sdk-server`](../../apps/server/README.md),
[`@plitzi/sdk-mcp`](../../apps/mcp/README.md) and [`docs/en/`](../../docs/en/README.md) —
[`server-actions.md`](../../docs/en/server-actions.md) for the whole of server actions, including the parts a
builder authors rather than a deployment configures.
