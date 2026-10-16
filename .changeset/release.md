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

## Packages

- **A library package is imported by its root and its folders, never by a file** (`@plitzi/sdk-shared`, `sdk-schema`,
  `sdk-style`, `sdk-elements`, `sdk-interactions`, `sdk-auth`, `sdk-dev-tools`, `sdk-event-bridge`, `sdk-navigation`,
  `sdk-plugins`, `sdk-variables`): each `exports` is now `"."` and `"./*"`, the latter a folder's `index`.
  `@plitzi/sdk-shared/helpers/isRecord` becomes `import { isRecord } from '@plitzi/sdk-shared/helpers'`, and a default
  export by the name its folder gives it — almost always its file's (`import usePlitzi from '…/hooks/usePlitzi'` →
  `import { usePlitzi } from '@plitzi/sdk-shared/hooks'`). A file-level specifier now fails with `ERR_MODULE_NOT_FOUND`.
  New entries where a folder barrel would have brought more than was asked for: `@plitzi/sdk-shared/project` and
  `@plitzi/sdk-shared/plugins/bundle` (Node only), `@plitzi/sdk-interactions/declarations` (the global callbacks and
  utility specs, without React), and `@plitzi/sdk-elements/elements/declarations`, which now also carries the
  declarations' attribute types and the constants they are checked with. `RuleGroup` is exported by `@plitzi/sdk-shared`
  with the document types that use it. `plitzi upgrade migrations` names every such import in a project, with the folder to
  import it from instead.
- **`@plitzi/sdk-shared`'s root exports the document types, and only them** (`@plitzi/sdk-shared`): what the package
  does is imported from its folder — `formatDate` from `@plitzi/sdk-shared/helpers`, `ThemeProvider` from
  `@plitzi/sdk-shared/theme`, a GraphQL operation's types from `@plitzi/sdk-shared/network/graphql` — so a module that
  imports a type from the root no longer loads every area of the package.
- **What one package alone used lives in that package** (`@plitzi/sdk-shared`, `@plitzi/sdk-elements`): the data
  source hooks moved from `@plitzi/sdk-shared/dataSource/hooks` to `@plitzi/sdk-elements/dataSource`
  (`useRegisterSource`, `useResolvedVariables`), and the Apollo links the builder's client is built with into the
  builder.
- **The builder's panels are an entry of their own** (`@plitzi/sdk-style`, `@plitzi/sdk-variables`,
  `@plitzi/sdk-elements`): the style inspector, the advanced style editor and `BuilderStyleContextProvider` are imported
  from `@plitzi/sdk-style/builder`; the variables' lists and forms from `@plitzi/sdk-variables/builder`; the elements'
  settings panels (`defaultElementsSettings`) from `@plitzi/sdk-elements/builder`. Each package's root keeps what a page
  and a server use — `generateCache` no longer loads the inspector, on a server 227 modules down to 21.

## CLI

- **`plitzi upgrade`'s `renames` part is now `migrations`** (`@plitzi/cli`): what a version changed that a project's
  own source must follow, one file per change in the CLI's `src/migrations/changes/` with the version it shipped in —
  rewritten with `--write` when it has one right answer, said otherwise. The `--json` report carries `migrations` (each
  with its `migration`, `since`, `file`, `line`, `what` and whether it was `written`) in place of `renames` and
  `changes`. The changes of 0.38.0 (`canTemplate` → `canSnippet`, the `*Template` authoring names), 0.38.9 (a
  `formControl` without `required` is optional) and 0.38.12 (`usePlitziServiceContext` → `usePlitzi`) are no longer
  looked for: a project still on one of those versions makes them by hand.
