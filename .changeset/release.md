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

## Declared motion — in code, in the builder and over MCP

An element says how it arrives and whether it keeps moving with `motion`, and the SDK's stylesheet plays it — no
keyframes to write: `{ enter: 'fade-up', on: 'view' }` arrives as it scrolls into view, `{ enter: 'scale', stagger:
60 }` brings its children one by one (a grid, a list's rows), `{ loop: 'float' }` keeps it moving. Enters: `fade`,
`fade-up`, `fade-down`, `slide-left`, `slide-right`, `scale`; loops: `float`, `pulse`, `spin`, `sway`; `duration`,
`delay`, `stagger` in ms. Opacity and the transforms only — an arrival on `translate`/`scale`, so it composes with an
element's own `transform` — a loop held until the page is live (`data-hydrated`), and none of it for a visitor who asked
for less motion. `view` follows the scroll where the browser has scroll timelines and plays on load where not.

- **Authoring:** `motion` on any factory; refused where it cannot play (`motion-invalid`, `motion-no-tag`), and carried
  by `specFromSpace` and `compareSpaces`.
- **Builder:** a **Motion** tab in an element's tools: the presets as chips, a stage that plays the one pointed at (a
  loop shown stronger than the page plays it, and saying so), when and how long, children one by one, and the choices
  read back as a sentence — laid out side by side once the sidebar is wide enough. The canvas holds motion still while
  editing; **▶** in the header (or **Play on the canvas** in the tab) plays it from the start, restarting what already
  played, and an arrival tied to the scroll plays by the clock there, where it is usually in view already.
- **MCP:** `motion` on `upsertElement` and `patchElement`, checked the same way; the guide names the presets.
- **Schema:** `definition.motion` (`ElementMotion`, `@plitzi/sdk-shared/schema/motion` — the presets, `motionProblems`,
  `motionAttributes`, `isMotionAnimation`, and each preset's frames, which the stylesheet is tested against), in both
  init queries. **The platform's GraphQL schema has to declare `SpaceElementMotion`
  before this version's builder or SDK queries it.**

## Plugins that draw

`useCanvas2d`, `useWebGL`, `useWebGL2` and `useAnimationFrame` (`@plitzi/plitzi-sdk`): a canvas sized to the device (at
most 2×), followed as it resizes, animating only while somebody can see it move — a live page, no reduced motion, the
tab in front, the canvas on screen — and one still frame otherwise (the builder included). `createShaderProgram`
compiles and links, and a shader that fails throws a `ShaderError` with the driver's log, printed as
`[plugin <type> "<id>"] fragment shader failed: …` instead of an empty canvas; `error` and `ready` say where it is.
`useReducedMotion` for the rest.

## A space re-authored without a restart

A project's `npm run start:dev` restarts for its server code and its plugins only: a save to the space is re-authored
in a process of its own and every open page loads again (`server.reloadPages()`, an SSE endpoint in `devMode`); an
edit authoring refuses is printed and the page keeps the last space that authored. A shutdown also ends WebSockets at
once (`1001`, going away) rather than waiting out the grace — the ten seconds a restart used to wait on an open page.

## Checks and authoring, from the stripe.com experiment

- **A component's instance** is found by its own name: its root carries `data-plitzi-instance`, and the instance's
  handle selects it — `inspectPage` no longer reports every named instance as missing.
- **Hidden at this width on purpose** — the burger on a desktop, the desktop menu on a phone — is listed apart
  (`hiddenAtWidth`, and a dim line under `plitzi check`'s ✓) rather than as a problem.
- **An element whose every child is conditional** — four flyouts in one list, each opening on the state that names
  it — is conditional too: at rest it shows nothing, and that is it working.
- **A carousel that scrolls by itself** (`overflow-x: auto`) is not the page scrolling sideways; the page's own pane
  still is.
- **Templates:** `{{ state.faq ?? -1 }}` — a sign on the right of `??` — reads.
- **A plugin attribute named as an element field** (`variant`, `class`, `id`…) is warned about
  (`plugin-attribute-reserved`): a factory never hands it to the plugin. A `variant` no class or type style declares is
  `unknown-variant`.
- **Lists:** a list with `items` renders as the `<ul>` (or `<ol>`) its `subType` says — it was a `<div>` — with no
  markers and the same spacing, so a page looks as it did; the builder offers the list type for it too. Its rows are
  `<li>`s: `list-row-not-li` warns of one that is not — a plain container is made one by `fixSpace`, a link or a button
  is wrapped — and the recipes, the catalog template and the docs write rows as `listItem`.
- **CSS:** `mask-size`, `mask-position`, `mask-repeat`, `mask-composite`, `-webkit-mask-image`,
  `-webkit-background-clip`, `box-decoration-break` and `-webkit-box-decoration-break`.
- **`plitzi shot`:** `--clip <element>`, `--scroll-to <element>` and `--viewport`; `--frames` takes the same framing.
- **SVG from files:** `svgFile` and `svgFiles` (`@plitzi/sdk-authoring/node`) read a logo or a folder of them,
  compacted (`compactSvg`, also on the main entry), instead of strings in the space's source.
- The plugin scaffolds say that an inline `style` on `RootElement` outranks the element's classes.
