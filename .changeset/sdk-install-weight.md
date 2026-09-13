---
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-variables': patch
---

Build tools no longer install with the SDK.

`@plitzi/plitzi-sdk` listed `vite`, `vite-plugin-dts` and `vite-plugin-react` as runtime dependencies, and
`@plitzi/sdk-variables` listed `eslint` — so every project depending on the SDK installed a bundler, a type bundler,
a Babel 7 toolchain and a deprecated `eslint@9` it never runs. They are build-time only: `vite` and `vite-plugin-dts`
move to `devDependencies`, the unused `vite-plugin-react` is removed, `@vitejs/plugin-react` (which the build
config does import) is now declared, and `eslint` is dropped from `sdk-variables`' runtime list.
