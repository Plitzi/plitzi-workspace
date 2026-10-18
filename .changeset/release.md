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

- **`ctx.oauth.token` for an SDK in the page** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`): Spotify's Web Playback,
  Google's Picker and their kind ask the page for the access token themselves, and `ctx.oauth` kept every token on the
  server. A connection that declares `exposeToken: true` now answers `ctx.oauth.token(name, { owner })` —
  `{ token, type, expiresAt, scopes }`, renewed first when about to lapse — for a route of the code to hand to the
  connection's owner. The refresh token never leaves; a connection without `exposeToken` refuses `token`, naming the
  field. Through the sandbox's protocol and natively alike.

## Packaging

- **No package ships the declarations of its tests** (`@plitzi/sdk-server`, `@plitzi/sdk-mcp`, `@plitzi/plitzi-sdk`,
  `@plitzi/plitzi-builder`, `@plitzi/sdk-elements`, `@plitzi/sdk-shared`): each app wrote its declarations with its own
  `dts({ exclude })`, and the ones that left the tests out of it shipped a `.test.d.ts` beside their modules — 148 in
  sdk-server alone — and the base config let a `.bench.d.ts` through. Every `dts()` now excludes
  `'**/*.(test|bench).(ts|tsx)'`, and `yarn check:dist-exports` (CI, after `build:prod`) fails a build of any published
  package that holds one.
- **`@plitzi/plitzi-builder` depends on `graphql` ^16** (was ^17): Apollo Server — the builder's API — supports only
  16, so a host installing the builder beside it got two copies. The builder uses nothing of 17's.
