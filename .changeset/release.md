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

## `plitzi push`: a self-hosted project back on its space

`plitzi create --from` and `plitzi pull` took a space out as a project and kept it in step; nothing put the project's
own changes back but a command per part, and no command at all for its pages. `plitzi push` is the way back
(`docs/en/projects-from-spaces.md`):

- **What changed, or what is named.** `plitzi push` sends what changed since the project last had the space — at a
  terminal, offered as a ticked list to choose from (`↑/↓`, space, Enter); `plitzi push space functions` sends only
  those parts: `space`, `functions`, `runtime`, `plugins`.
- **In order:** each changed plugin packed and uploaded (`pack plugin` + `upload plugin`, `--cdn`/`--bucket`), the
  functions, the runtime, then the space — `src/space.ts` authored, the actions `src/actions.ts` serves and the manifests
  in `src/connectors/` — as the space's draft. Never a published environment.
- **Never over the builder's work unseen.** The export now carries which state the draft is in (`SpaceExport.draft`),
  recorded in `.plitzi/space.json` by `create --from` and `pull`; a push names it, and a draft edited since is refused
  until `--force`. A project that never had the space may take one nobody has worked on; one holding work takes
  `--force`.
- **Then `pull` follows it.** `.plitzi/space.json` records what was sent — only that, so a builder's change to a part
  not pushed is still the next pull's — and a project that started on its own works with `pull` from then on.
- `@plitzi/sdk-shared/source`: `SpaceImport` / `SpaceImportResult` (`SPACE_IMPORT_FORMAT`), the push's one shape for
  both ends, beside `SpaceExport`, which gains `draft`.
- `functions push`, `runtime push` and `upload plugin` keep their behaviour; their cores are what `push` runs.
