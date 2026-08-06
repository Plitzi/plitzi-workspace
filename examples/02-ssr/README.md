# Server rendering

The same space rendered on the server by `@plitzi/sdk-server` and delivered as HTML.

| | Example | Difference | Port |
|---|---|---|---|
| 01 | [pages](./01-pages) | Server-render a space over HTTP | 4003 |
| 02 | [rsc](./02-rsc) | Per-element server data via React Server Components | 4004 |

**Adapters are the whole integration surface.** Both examples read the space from a JSON file through
`createJsonAdapters`; a real deployment swaps in functions that hit its own database and nothing else changes —
the server never learns where a space came from.

These pages are rendered by the SDK's own template, so unlike the [client examples](../01-client) the host page
is not yours to style.

## Next

The AI surface: [`03-ai`](../03-ai).
