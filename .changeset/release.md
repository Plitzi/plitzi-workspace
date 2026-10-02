---
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
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

## Feature flags

- **What they are:** `schema.flags`, a space's switches by name — a default and rules over the environment, the host,
  the URL and the visitor. Read with the document, stored apart from its snapshots: one set per environment, turned
  without a new revision. See `docs/en/feature-flags.md`.
- **Caches follow them:** `SSRSpaceDeployment.flagsVersion` (the flags' hash) keys the HTML, RSC and `offlineData`
  caches of `@plitzi/sdk-server`; `createCloudAdapters` probes `flagsHash` and fetches `SpaceFlags` only when it moved
  — a pinned revision included — and keeps the last flags in its shared cache for a cold start with Plitzi down.
- **Who decides:** the space, then the server rendering it (`createServer({ flags })`), then the SDK embedding it (the
  `flags` prop), then a tester (the dev tools' Flags tab, only where debugging is authorized) — each only for flags the
  space declares.
- **Gating:** `definition.flag: { name, is }` renders an element only while the flag agrees — not a visibility: gated
  off, none of it is rendered, on the server or in the browser, and RSC resolves no data for it. A gated page is not
  found. Its declaration still ships with the space's document: a flag switches a feature off, it does not hide it.
- **Reading:** the `flags` global source (`{{ flags.x }}`), `useFlag(name)` for plugins, and `flags` in a server
  action's scope (the `getFlags` action lookup).
- **Builder:** a Feature Flags panel (declare, rule, force in the canvas, publish), the gate in an element's tools, a
  marker in the tree. Its own flags come from the platform (`PlatformFlags`) instead of a constant.
- **Authoring and MCP:** `SpaceSpec.flags`, `flag: 'name' | '!name'` on elements and pages, linter codes
  `flag-undeclared`, `flag-unknown`, `flag-unused`, `flag-rule-empty`; MCP `upsertFlag`, `deleteFlag`, `flag` on
  element and page ops, `plitzi://flags/{env}`.
- **Global sources** are one list now (`@plitzi/sdk-shared/dataSource/globalSources`), read by the runtime and the
  authoring validator alike.
