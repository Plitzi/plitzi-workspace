---
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
---

## Server

- **`ctx.oauth`, after a project moved onto it** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`) — PZ-155..158.
  `functions.oauth.callbackOrigin` fixes the one address providers send a visitor back to, on a server of one space
  reached on several: `serveProject` sets it to the address people reach it on, or its loopback `127.0.0.1` when that is
  plain HTTP (providers refuse `http` past loopback, and `localhost`), and prints it as it starts; the callback then sends
  the visitor on to `returnTo` on the address they started from — its `location` is absolute now. `connect(name,
  { returnTo, authorizeParams })` adds to the connection's parameters for one consent (`prompt: 'select_account'`), and
  refuses one the platform writes. `ctx.fetch` and `ctx.oauth.fetch` take `init.signal`: in the sandbox and a runtime the
  request is numbered and the code's `abort` cuts it on the platform. `ActionRefusal` takes `{ code }`; `ctx.oauth`
  refuses with `oauth-not-connected` and `oauth-no-owner`.
- **A refusal of the platform's stays one across the sandbox** (`@plitzi/sdk-server`). A call answered with an
  `ActionRefusal` crossed the isolate, the runner service and a runtime as a plain error: caught, the code could not tell
  it apart; uncaught, a route answered 500 `This route failed` instead of 400 and the reason. The answer carries
  `refused` and `code` now, and the code catches the refusal it was thrown.
