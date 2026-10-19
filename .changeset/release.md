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

- **`ctx.oauth.callbackUrl()`** (`@plitzi/sdk-server`) — PZ-161. The address providers send a visitor back to, as this
  run's `connect` hands it to them: for a page that shows whoever sets up the app what to register, instead of
  rebuilding the platform's rule. Refused in a run no visitor's request started when the deployment fixed no
  `functions.oauth.callbackOrigin`.
- **In production the project's server fixes no OAuth callback** (`@plitzi/sdk-server`). 0.38.23's loopback default
  applied wherever `PUBLIC_URL` was not HTTPS — a container behind a proxy sent providers to its own
  `http://127.0.0.1:8080`. Now loopback is the default while developing only; in production the callback is on the
  address each visitor's request came on (the site's domain, from `Host` and `X-Forwarded-Proto`), and the server says
  to register that domain's `/fn/oauth/callback`.
