# Pages, MCP and draft preview on one port

The full loop: an agent proposes edits, they render **without being saved**, and a normal page request serves
that draft once.

```bash
yarn start
yarn start:dev   # the same, reloading on save, while you edit it
```

```bash
# 1. Mint a preview of an unsaved edit
curl -s -X POST http://127.0.0.1:4006/__preview \
  -H 'Content-Type: application/json' -H 'x-preview-secret: example-secret' \
  -d '{"spaceId":1,"operations":[{"type":"patchSettings","settings":{"title":"Draft title"}}]}'

# 2. Render it with the token it returned — the space on disk is untouched
curl -s 'http://127.0.0.1:4006/?__pt=<token>' | grep 'Draft title'

# 3. The same token again returns the saved state: it is one-shot
```

## What matters

One argument, in [`src/main.ts`](./src/main.ts):

```ts
createServer({ …, preview: { enabled: true, secret } }, mcpExtensions());
```

`mcpExtensions()` hands the page server three stages — the MCP endpoint under `/mcp`, the widget proxy and
draft preview. Each gates itself, so page routes are untouched and anything they do not claim falls through to
the renderer. **Passing them is what mounts them**: a page server that never calls this loads none of it.

Take only what you want:

```ts
createServer(config, { preAuth: [previewStage] });   // preview, but no MCP endpoint
```

The two halves of preview live in different packages — `@plitzi/sdk-mcp` applies the operations and renders,
`@plitzi/sdk-server` serves the draft back — joined by the one-shot token.

Preview is off unless `preview.enabled`, and rejects any request without the secret.
