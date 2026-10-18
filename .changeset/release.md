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

- **A page of the same site on another origin is no longer this server's own** (`@plitzi/sdk-server`): the guard
  against writes another page caused (`crossSiteWrites`, the sign-in's login-CSRF check and `createOriginGuardMiddleware`)
  trusted `Sec-Fetch-Site: same-site` — and a site has no port and spans every sub-domain, so another port of the host
  (where `createAuthoringHost` serves pages an agent wrote) or a sibling sub-domain (every space of a platform on one
  domain) could write as if it were the server's own page. Now only `same-origin` (and `none`, a typed URL) is; `same-site`
  is refused 403 `reason: 'foreign'` unless its origin is named (`crossSiteWrites.origins`, `identity.platformOrigins`),
  and the `Origin` fallback compares host and port. In production an app and its spaces are already on different sites,
  so a deployment that works there needs nothing; one that relied on a sibling sub-domain locally names it.
  `createAuthoringHost`'s docs now say to serve on a host of its own — a cookie belongs to a host whatever its port.

## Server

- **An open page takes a new version of its space where it stands** (`@plitzi/sdk-server`, `@plitzi/plitzi-sdk`):
  `server.updatePages(documents, { draft? })` hands the pages showing that space — or that draft — its new documents,
  and each swaps them in place, its state, scroll and focus kept (`replaceSpace` on what the SDK's `render` returns;
  `false`, and the page loads again, for a page with elements the server draws). The development loop of a project uses
  it: a save to the space no longer reloads the open page. `createAuthoringHost`'s `put` over an id that pages show
  hands them the new version and answers how many took it (`updated`), so a page an agent keeps improving is seen to
  grow instead of reloading — no second iframe needed.
- **`devReload` is `livePages`** (`@plitzi/sdk-server`): the channel the open pages listen on now carries the space,
  not only "load again", and a host that is not developing uses it too. Its address is `/__plitzi/live`; a draft's page
  listens for its own changes alone (`?__pt=`). A plugin swapped where it is drawn stays a development server's
  (`devMode`). `plitzi upgrade migrations --write` renames the option in a project's code (`livePagesOption`).

## Packages

- **Two server reads no longer bring the browser's hooks along** (`@plitzi/sdk-shared`, `@plitzi/sdk-server`): importing
  `@plitzi/sdk-server` loaded 139 modules of `@plitzi/sdk-shared`, 15 of them only because two constants sat in folders
  of client hooks. `PROJECT_DATA_PREFIX` moved from `@plitzi/sdk-shared/server` to `@plitzi/sdk-shared/project/paths` —
  the project's layout names, now an entry of their own a browser imports too (`@plitzi/sdk-shared/project` stays Node
  only and re-exports them); `plitzi upgrade migrations --write` rewrites the import (`movedExports`). The theme cookie's
  helpers (`themeFromCookies`, `THEME_COOKIE_NAME`…) are also `@plitzi/sdk-shared/theme/cookie`, still exported by
  `@plitzi/sdk-shared/theme`. `yarn check:server-footprint` (in CI after the build) holds what the server's root loads
  of each `@plitzi` package to an exact budget.

## CLI

- **`plitzi upgrade migrations --write` writes a file import's new home when it has one** (`@plitzi/cli`): the
  `folderImports` migration of 0.38.17 named every import of a package's FILE and wrote none. It now reads the installed
  declarations with the project's own TypeScript and rewrites each `import` / `export … from` whose every name the folder
  exports under one name — `import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi'` →
  `import { usePlitzi } from '@plitzi/sdk-shared/hooks'`, `type` modifiers and aliases kept. What has no one answer is
  said with why (a namespace import, an `import()` or mock, a name the folder does not export, a project with no
  TypeScript). The report says which places `--write` writes (`writable` in `--json`) instead of calling every one
  "yours to change"; a migration now gives each place its own `edit` in place of a whole-file `rewrite`
  (`docs/en/releases.md`).
- **`plitzi doctor` says an import of a path the installed package does not export** (`@plitzi/cli`):
  `import-not-exported`, an error, at the importing file — what Node otherwise reports at start as an
  `ERR_MODULE_NOT_FOUND` into the package's `dist`, which reads as a broken install rather than a changed API. For a
  `@plitzi` package the fix names `plitzi upgrade migrations --write`; for any other, its `exports`. Asked only of a
  package that is installed.
