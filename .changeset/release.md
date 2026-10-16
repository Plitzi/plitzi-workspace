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

- **A library package is imported by its root and its folders, never by a file** (`@plitzi/sdk-shared`,
  `sdk-schema`, `sdk-style`, `sdk-elements`, `sdk-interactions`, `sdk-auth`, `sdk-dev-tools`, `sdk-event-bridge`,
  `sdk-navigation`, `sdk-plugins`, `sdk-variables`): each `exports` is now `"."` and `"./*"`, the latter a folder's
  `index`. `@plitzi/sdk-shared/helpers/isRecord` becomes `import { isRecord } from '@plitzi/sdk-shared/helpers'`, and a
  default export is named by its file (`import usePlitzi from '…/hooks/usePlitzi'` → `import { usePlitzi } from
  '@plitzi/sdk-shared/hooks'`). A file-level specifier now fails with `ERR_MODULE_NOT_FOUND`. New entries where a folder
  barrel would have brought more than was asked for: `@plitzi/sdk-shared/project` and `@plitzi/sdk-shared/plugins/bundle`
  (Node only), `@plitzi/sdk-shared/apollo` (the Apollo links; `@apollo/client` stays an optional peer),
  `@plitzi/sdk-interactions/declarations` (the global callbacks and utility specs, without React), and
  `@plitzi/sdk-elements/elements/declarations`, which now also carries the declarations' attribute types and the
  constants they are checked with. `RuleGroup` is exported by `@plitzi/sdk-shared` with the document types that use it.
