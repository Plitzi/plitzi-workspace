# My space does work on the server

Not reading data — *doing* something: pricing an order, calling a system only the server can reach, answering a
webhook from a provider.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [actions](./01-actions) | A declarative flow the server runs, called from a page | 4009 + 4010 |
| 02 | [render](./02-render) | The server fetches an API while the page renders, and the HTML arrives finished | 4011 |

The page names an action and hands it inputs. It never learns what happened in between — not the URL, not the
credential, not the systems involved — because the flow is a **document the server holds**, not code the browser
carries. That is also why no customer JavaScript runs on the server: there is none to run.

The first takes two ports because it shows the versioning rule as well as the mechanism: the same space
published, and the same space as its author is editing it now.

The second one turns it around: nobody clicks. A `render` trigger runs the action while the page is being built,
so the fetch happens on the server and the browser is handed a finished page — the same mechanism, reached from
the other end.

## Next

Nothing — this is the end of the tour. Read [`server-actions.md`](../../docs/en/server-actions.md) for the whole
feature, including the parts a builder authors rather than a deployment configures. The packages themselves are
documented in [`@plitzi/sdk-server`](../../apps/server/README.md) and [`@plitzi/sdk-mcp`](../../apps/mcp/README.md).
