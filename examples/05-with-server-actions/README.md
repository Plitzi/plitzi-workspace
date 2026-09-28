# My space does work on the server

Not reading data — *doing* something: pricing an order, calling a system only the server can reach, answering a
webhook from a provider.

| | Example | What it is | Port |
|---|---|---|---|
| 03 | [no-server](./03-no-server) | The same page in the browser alone: every server-side step declares itself inert | 4012 |
| 04 | [custom-trigger](./04-custom-trigger) | A way in this deployment mounts itself — a queue consumer — over a store it already runs | — |
| 05 | [schedules](./05-schedules) | Jobs on a clock and jobs on a delay, over a durable queue the server keeps in SQLite — and how the same runs on Mongo or MySQL | 4016 |

The page names an action and hands it inputs. It never learns what happened in between — not the URL, not the
credential, not the systems involved — because the flow is a **document the server holds**, not code the browser
carries.

A page calling an action, and an action feeding a page while it renders, need no server of your own: they are
seeded spaces on the platform — `shipping-quote` and `cat-gallery`, in
`plitzi-sdk-server/prisma/mongo/seeds/spaces/examples`. What is left here is what a platform space cannot show.

The first takes the server away. The same page, rendered in the browser, where the step that would call an action
and the element that would be fed by one both report themselves inert — without issuing a request. A page that
learns this per click, from a 404, is the failure mode being avoided.

The second is the extension point the built-in triggers leave: a way in nobody built, mounted by calling the
runner, with every check the built-in ones get. It runs, prints and exits.

The third is the work nobody starts at all — a cron, or a job due in five seconds — and the durable queue that makes
it survive a restart, a second replica and a replica killed half-way through. It is also the self-hosted shape of
the whole thing: every store the server needs is one the deployment brings.

## Next

Nothing — this is the end of the tour. Read [`server-actions.md`](../../docs/en/server-actions.md) for the whole
feature, including the parts a builder authors rather than a deployment configures. The packages themselves are
documented in [`@plitzi/sdk-server`](../../apps/server/README.md) and [`@plitzi/sdk-mcp`](../../apps/mcp/README.md).
