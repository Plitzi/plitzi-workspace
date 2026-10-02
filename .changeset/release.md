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

## The builder's sidebar, one entry per subject

From 21 entries to 9. **Elements** ends with the space's **Components**, one search for both — each is dragged
onto the canvas the same way. **Server** gathers Actions, Functions, Connectors, Credentials and Runtime behind tabs, with
the warning that a space has no server-rendered deployment said once above them. **Variables** holds Feature Flags,
**Assets** holds files and fonts, **Settings** holds Visitors, the Pages panel opens the **Sitemap** in place of the
canvas, and **History** moved to the header beside undo and redo. Each grouped entry remembers the tab left open.

The builder is drawn with the website's design system: Geist and Geist Mono, the `#5b3df5` violet, cool neutrals and
8 / 10 / 14px radii, from the tokens `@plitzi/plitzi-ui/theme.css` now ships. The published SDK stylesheet does not
take them, so a space's own elements look as they did.

The Sitemap is drawn by `TreeCanvas`, a new `@plitzi/plitzi-ui` component: the site laid out as a tree on its own, panned
and zoomed like a design canvas, a page moved by dropping it onto a folder or onto the top level. `@xyflow/react` — and
zustand and d3 with it — is no longer a dependency of the builder.
From the map a page is found (search lights it and the folders leading to it), opened in the canvas (double click,
Enter or its card), and created inside a folder; folders fold away what they hold, remembered between visits; arrows walk
it. Each card says who may open the page, its layout, the flag it exists under, where it sends somebody it refuses, and
marks its dynamic segments and the page being edited. Fixed on the way: a page with no access level was labelled
"Public", which in Plitzi means guests only — it is open to everyone, and now says so.

## Feature flags

- **What they are:** `schema.flags`, a space's switches by name — a default and rules over the environment, the host,
  the URL and the visitor. Read with the document, stored apart from its snapshots: one set per environment, turned
  without a new revision; a snapshot keeps a copy, read only when the environment's flags (and their Redis copy)
  cannot be. See `docs/en/feature-flags.md`.
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
- **Builder:** Feature Flags beside the variables (declare, rule, force in the canvas, publish), the gate in an element's tools, a
  marker in the tree. Its own flags come from the platform (`PlatformFlags`) instead of a constant.
- **Authoring and MCP:** `SpaceSpec.flags`, `flag: 'name' | '!name'` on elements and pages, linter codes
  `flag-undeclared`, `flag-unknown`, `flag-unused`, `flag-rule-empty`; MCP `upsertFlag`, `deleteFlag`, `flag` on
  element and page ops, `plitzi://flags/{env}`.
- **Global sources** are one list now (`@plitzi/sdk-shared/dataSource/globalSources`), read by the runtime and the
  authoring validator alike.

## Element templates are Snippets

What the builder saves from a subtree and drops into a page was called a template, the word a space's own starting
point already goes by. It is a **snippet** now, everywhere, with no alias for the old names:

- **Builder:** "Save as snippet" on an element, **Snippets** in the resources list.
- **CDN:** a snippet is uploaded to `snippets/` in the space's folder, with the resource type `snippet`. A file already
  in `templates/` is no longer listed as one: upload it again.
- **Authoring:** `authorSnippet`, `validateSnippet`, `SnippetSpec` and `AuthoredSnippet`, which returns `{ snippet,
  warnings }`. The validator codes are `SNIPPET_*`.
- **Shared and schema:** the `Snippet` type (`@plitzi/sdk-shared/types/SnippetTypes`), `SpaceAddSnippet` and
  `SPACE_ADD_SNIPPET`, `SCHEMA_ADD_SNIPPET` and `STYLE_ADD_SNIPPET`, `schemaAddSnippet` / `styleAddSnippet` on the
  event bridge, and `FlatMap.flatAsSnippet`.
- **Plugins:** the builder config key `canTemplate` is `canSnippet`.
- **One document, whoever writes it:** a snippet's `schema` is only what travels — `flat` and `variables` — whether
  `authorSnippet` wrote it or the builder saved it. Until now an authored one carried a whole space (`pages: []`, its
  settings), which the builder's preview laid over the space being edited, and one the builder saved failed
  `validateSnippet` (`INVALID_PAGES`).
- **Saving says how it went:** "Save as snippet" announces the snippet once the upload answered, and says why when it
  did not — it used to report it created before knowing, and from the context menu said nothing at all.

Space templates — what a new space starts as — keep their name.
