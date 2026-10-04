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

## `plitzi upgrade`: a project brought up to its CLI

A project written by an older CLI had no way up but `plitzi create` in a scratch folder and a file-by-file comparison:
`skills update` brought the skills and nothing else, so the `check` and `shot` scripts they teach did not exist.
`plitzi upgrade` (also `update`) shows what this CLI writes today for what is the CLI's in the project, and `--write`
makes it. One part or several: `plitzi upgrade skills`, `plitzi upgrade files packages`.

- **`files`:** the CLI's machinery — `author.ts`, `main.ts`, the Playwright, TypeScript and lint configs, AGENTS.md. One
  nobody changed since the CLI wrote it is replaced, a missing one added; one the project made its own is shown as a
  diff and left, until `--take <file>` (or `all`). `plitzi create` now records what it wrote, by digest, in
  `.plitzi/scaffold.json`; a project made before that sees every file that differs as its own.
- **`packages`:** `package.json` merged, never replaced — the scripts and dependencies it lacks added, `@plitzi/*`
  raised to this version, then the install (`--no-install` to leave it). A script of the project's own stays.
- **`skills`:** `.claude/skills/plitzi-*` from the packages installed, each replaced whole, and the ones a newer CLI
  writes added. `plitzi skills update` is `plitzi upgrade skills --write`.
- **`renames`:** a name a version renamed with no alias, at its file and line — `canTemplate` → `canSnippet`,
  `authorTemplate` → `authorSnippet` and its kin (renamed only where imported from `@plitzi/sdk-authoring`) — renamed
  with `--write`.

`npm run author` says when the skills or the CLI's files are older than the SDK installed, and `plitzi --version`
prints the CLI's.

## Page checks that can be the definition of done

`inspectPage`, `plitzi check` and the scaffold's visual test failed pages that were whole, so an agent learnt to ignore
them:

- **A breakpoint hiding an element on purpose** — the desktop navigation on a phone, a bottom bar only a phone shows —
  is no longer "not visible": an element whose `display` or `visibility` a breakpoint rule sets is checked at the width
  it shows at.
- **A lazy image out of sight** waits whichever side it is out of: below the fold, as before, or beside the screen in a
  carousel's track — cut off by any ancestor that clips, as the browser decides when to fetch it.
- **A plugin that draws nothing** says so: `drawsNothing: true` in its declaration (a clock that fires a flow), and its
  handle is `boxless`, so no check waits for it on screen.

`plitzi check --json` and `PageReport` carry `issues` beside `problems`: each with its `code` (`element-hidden`,
`image-not-loaded`, `sideways-scroll`…), the `elementId` it is about and, in `check`, the `width`.

## Authoring

- **A link's `content` names it.** `control-without-name` read only a link's `label`, so applying the
  `content-attribute` suggestion as written turned every link into a warning.
- **`plitzi fix` writes `content-attribute`** where it has one reading: a button's or link's children that are only
  `text(…)` and `fontAwesome({ icon })` become its own `content` and `icon` — the words kept as written, an import left
  unused taken out. A child with an id, options or a class of the space's own stays, and is said. `npm run author`'s
  `[fix]` line counts these too.
- **The recipes, the skill's examples and the catalog template** hold to the suggestions as well as the warnings, and
  their tests say so: six recipes and the template wrote a link's or a button's words as a child.
