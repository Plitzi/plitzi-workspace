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

## Security

- **The `Origin` fallback tells the ports apart over HTTP/2 too** (`@plitzi/sdk-server`): a browser that sends no
  `Sec-Fetch-Site` (Safari before 16.4, older webviews) is judged by its `Origin`, compared with the authority the
  request was addressed to. HTTP/2 carries no `Host` header — the authority is `:authority` — and the comparison then
  fell back to the host's NAME, so every port and scheme of it counted as this server's own: what 0.38.18 closed for
  `same-site` stayed open there, over TLS, where a Plitzi server speaks HTTP/2. The authority is now `:authority`,
  `Host`, or the `X-Forwarded-Host` a proxy in front wrote — whichever names the host the request is answered as — port
  included; when none does, the origin is not taken as its own. The write guard (`crossSiteWrites`), the sign-in's
  login-CSRF check and `createOriginGuardMiddleware` share it.

## Packages

- **The server evaluates rules without the query editor** (`@plitzi/sdk-shared`, `@plitzi/sdk-auth`,
  `@plitzi/sdk-elements`, `@plitzi/sdk-interactions`, `@plitzi/plitzi-builder`): every evaluation of a `when` rule
  group imports `QueryBuilderEvaluator` from `@plitzi/plitzi-ui/QueryBuilder/evaluator` — the evaluator alone — instead
  of the `QueryBuilder` barrel, which brings the editor's React components, or `QueryBuilder/helpers`, which brings the
  SQL and MongoDB formatters. `@plitzi/sdk-shared/helpers` reads `get` and `omit` from `@plitzi/plitzi-ui/helpers/lodash`.
  Importing `@plitzi/sdk-server` loads 19 modules of `@plitzi/plitzi-ui` (26 before) and neither
  `class-variance-authority` nor `clsx`, and starts in ~125 ms (~150 before). Needs `@plitzi/plitzi-ui` 1.6.34.
