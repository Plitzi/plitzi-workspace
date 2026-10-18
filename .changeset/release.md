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

- **The `Origin` fallback reads the request's own authority before a forwarded one** (`@plitzi/sdk-server`): 0.38.19
  took `X-Forwarded-Host` first, and with no proxy in front a client could send one naming this host on another port,
  making that port's `Origin` this server's own. Now `:authority` or `Host` decide whenever they name the host the
  request is answered as; `X-Forwarded-Host` only when they do not — a host that took its hostname from the header
  (Express's `trust proxy`) trusts the proxy that wrote it. No option to set: what the host resolved says which one it
  believes. The write guard (`crossSiteWrites`), the sign-in's login-CSRF check and `createOriginGuardMiddleware`
  share it.

## Server

- **`ctx.oauth`: OAuth 2.0 for a space's code, any provider** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`): a
  connection is data in `defineFunctions({ oauth: { calendar: { issuer | authorizeUrl + tokenUrl, credential, scopes,
  authorizeParams, clientAuth } } })` — an OpenID provider by its `issuer` (endpoints discovered), any other by its
  endpoints; none is known to the platform by name. `ctx.oauth.connect(name, { returnTo, owner? })` answers the
  consent URL (authorization code with PKCE); the platform answers `/fn/oauth/callback` — the one address to register
  with every provider — exchanges the code with the app's id and secret from the named credential, and sends the
  visitor back to `returnTo` with `?oauth=<name>&oauth_result=connected` (or `&oauth_error=`). `ctx.oauth.fetch(name,
  url)` writes the token in, renewed before it lapses and once more on a 401, only to `allow.hosts`; `status` and
  `disconnect` (revoked where the provider says). A token is a signed-in visitor's own by default, `{ owner: 'space' }`
  the space's, or a key of the code's own; it is kept in the space's `kv` sealed with a key of the space's that no
  `ctx.sign` reaches, so the code never holds one. In the sandbox, natively and in a space's runtime alike; a plugin's
  functions declare and reach none. Needs `signingSecret`. Runs also carry the `origin` of the request that started
  them (`ctx.origin` of a task context), what the callback address is made of.

## Packages

- **No path a package does not export is written anywhere in the packages** (`@plitzi/plitzi-sdk`,
  `@plitzi/sdk-shared`): two JSDoc comments sent readers to `@plitzi/sdk-authoring/testing`, which is not an entry —
  `inspectRenders` is exported by `@plitzi/sdk-authoring`. `yarn check:specifiers` (in CI after the build) reads every
  `@plitzi/<package>/<path>` the workspace writes — the code, its built declarations, JSDoc, skills and docs — against
  what that package exports, so an import somebody would copy into a project and get `ERR_MODULE_NOT_FOUND` from cannot
  be published again.

- **The packages that run in Node say which Node** (`@plitzi/sdk-server`, `@plitzi/cli`, `@plitzi/sdk-mcp`,
  `@plitzi/sdk-authoring`): `"engines": { "node": ">=22.18" }`, the floor every project the CLI makes already declares —
  installed on an older Node they now say so, instead of failing on the first API it lacks (`--env-file-if-exists`,
  `--permission`, `Set#union`). The browser's packages declare none: a bundler reads them.

- **A short render guide, and each part of it alone** (`@plitzi/sdk-mcp`): `renderGuideText` stays the whole guide
  (~30k characters); `renderGuideCore` is a third of it for an agent that counts its tokens — a voice assistant, a small
  model — with the model of a render, the element types, the host's theme and what to do on a refusal, and the address
  of every other section; `renderGuideTopics[topic]` and `renderGuideTopicUri(topic)` (`plitzi://render/guide/repeat`,
  `…/data`…) serve each one, cut from the one text. The MCP server answers them as resources and through `plitzi_read`.

## CLI

- **What Plitzi decided reaches the agent writing a report** (`@plitzi/cli`): `plitzi feedback`'s brief lists what was
  reported and kept as it is — with why, and what to do instead — so a report files it under `changed` as `decided`
  rather than carrying it as open, and the page has that status.

- **The CLI skill says what `ERR_MODULE_NOT_FOUND` into a `@plitzi` package's `dist` is** (`@plitzi/cli`): an import of
  a path the package does not export — a file rather than its folder — with `plitzi doctor` to name each one and
  `plitzi upgrade migrations --write` to rewrite it.
