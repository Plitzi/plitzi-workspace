# My space with data

Elements that resolve their own data on the server, per request.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [server-components](./01-server-components) | Per-element server data via React Server Components | 4004 |

An element marked `runtime: 'server'` renders on the server with data the browser never fetched and secrets it never
saw. One marked `client` hydrates as usual, and `shared` does both — so a page mixes them without the host choosing
one model for everything.

## Next

Let an agent edit the space: [`04-with-an-agent`](../04-with-an-agent).
