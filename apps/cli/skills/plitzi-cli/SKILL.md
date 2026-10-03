---
name: plitzi-cli
description: >-
  Use the Plitzi command line (@plitzi/cli, `plitzi …` or `npx @plitzi/cli …`) instead of hand-writing what it
  generates: scaffold a project that renders a space, add elements of your own (plugins) to it, create a plugin package,
  build a plugin into the module + manifest + zip the platform takes, sign in to upload and install it on a space, and
  edit a space's own server code (its functions) in the project, and take a space on Plitzi out as a self-hosted project
  of its own (`create --from`, kept in step with `pull`). Use whenever the task is to start a Plitzi project, create or
  change a plugin/custom element, pack, upload or install one, pull/push/try a space's functions, move a space to a
  server of its own, or work out which space the CLI is connected to.
---

# The Plitzi CLI

The CLI writes what an agent would otherwise get subtly wrong by hand: a project's server, bundler, lint and visual
test wired together; a plugin's four files in the shape Plitzi's own elements use; a manifest with integrity hashes;
a signed-in upload. **Reach for it before writing any of those yourself.**

```bash
npx @plitzi/cli create my-site                 # a project that renders a space (--template blank | catalog)
npx @plitzi/cli create my-board --from pizarra # a space on Plitzi, as a project that serves it alone
npx @plitzi/cli pull                           # that project brought up to date with its space
npx @plitzi/cli add plugin seat-picker legend  # elements of your own, in the project you are in
npx @plitzi/cli create seat-picker --plugin    # a plugin package any space can load
npx @plitzi/cli pack plugin                    # a plugin built, and zipped the way the builder takes it
npx @plitzi/cli upload plugin                  # that zip, on the space you work in, and installed there
npx @plitzi/cli whoami                         # who the CLI is signed in as, and the space it works in
npx @plitzi/cli data describe public/data/products.json   # a JSON file's fields, types and one row — not read whole
npx @plitzi/cli skills update                  # the skills in .claude/skills, up to the SDK installed
npx @plitzi/cli explain navigate               # what a name means: element, step, trigger, problem code (--list steps)
npx @plitzi/cli functions pull                 # the space's functions (its own server code) into functions/
npx @plitzi/cli functions push                 # functions/ back as the space's draft, built and checked
npx @plitzi/cli functions try feed.read --params '{"limit":3}'   # one task of the saved draft, in the sandbox
npx @plitzi/cli functions dev feed.read --watch                   # the same, from functions/, on this machine
```

`plitzi --help` and `plitzi <command> --help` list every flag; what follows is what the help does not say.

## Running it as an agent

- **`create` never decides for the person.** Three choices shape a project — package manager, `--mode`
  (`server`: SSR + RSC on a Node tier, `client`: browser only) and `--source` (`local`: the space lives in the project,
  `cloud`: it lives in Plitzi). With nobody at the terminal it writes NOTHING and prints each missing choice as a
  question: ask the user, then run again with their answers as flags. `--yes` does not get around it — it only takes
  the defaults for a person at a terminal. Do not guess the answers.
- **Signing in happens in the browser.** `login`, `space` and a first `upload` open one; the person completes it (MFA
  and social sign-in included — the CLI never sees a password). Tell them a browser tab is waiting, and wait.
- **One space at a time.** Everything goes to the space `whoami` names; `plitzi space` switches it. No command takes a
  space as a flag, so check `whoami` before an upload.
- **`--no-install`** writes the files without installing, **`--force`** writes into a directory that has work in it.

## The Plitzi MCP or this CLI

Where the space lives decides which one an agent uses — the two never take turns on one space.

| The space | Use |
| --- | --- |
| In a project, written in code (`src/space.ts`, `--source local`) | this CLI and `@plitzi/sdk-authoring`. No account and no MCP |
| On Plitzi — edited in the builder, with collaborators, published from there | the Plitzi MCP server: it reads and edits the live space, previews a page and checks every edit with the same linter |
| On Plitzi, and wanted in code from now on | `create --from <space>`, then `pull` to keep the project in step |

The MCP needs a signed-in account. If it asks for authentication and nobody can give it, do not wait on it: a project
with `--source local` needs neither.

## Projects (`create`)

| | `--source local` | `--source cloud` |
| --- | --- | --- |
| `--mode server` | A page server of your own, rendering the space in `src/space.ts`. No account | Your page server, rendering the live space from Plitzi (secret self-hosting key in `.env`) |
| `--mode client` | Vite + the SDK in the browser, no server, no account | The SDK fetches the space with the public render key |

What a project gives you, so you use it rather than rebuild it:

| Script | What it is for |
| --- | --- |
| `start` | serve it — in client mode Vite, which hot-replaces on save. The server prints only what goes wrong; `-- --verbose` adds every request |
| `start:dev` | server mode: the server, restarted on save |
| `author` | author `src/space.ts`: one line when it is fine, every problem at once (file:line, what to change) when not; `-- --json` for a tool |
| `check -- /path --width 1440,390` | whether a page is whole, in text: elements on screen, overflow, console, refused requests; `--json` |
| `shot -- /path --width 390 --scheme dark` | a picture of one page — `--frames 4` says what moves, `--compare <url>` how much differs from another site by section, `--wait-for <element>`; refused when the port answers as another project |
| `visual` | a browser asserts every element the space names is visible |
| `typecheck`, `lint`, `format` | before calling a change done |

**Which port.** `start` takes 8080, or the next free one when something else holds it — printed, and written to
`.plitzi/dev-server.json`, where `shot` and `visual` look for it. Set `PORT` to choose one (then a taken port is an
error). `/health` answers with the space's name: a server that answers as something else is not this project.

The data a page reads with no backend goes in `public/data/*.json`, served by the project as it is; in server mode a
provider with `runtime: 'server'` reads it on the server, so the page arrives with it. To bind to a file, learn its fields
with `data describe` rather than reading it: a catalogue is half a megabyte, its shape twenty lines.

A local space starts as a tour of the platform with a plugin of the project's own; **`--template blank`** starts it as
tokens, a layout and one empty page instead — the one to pick when the project is about to be a specific site; and
**`--template catalog`** as a complete small shop (layout, card component, data in `public/data`, a filtered list, a
page per product), a file per part — the one to read when unsure how a whole site is put together.

The space itself is written with `@plitzi/sdk-authoring` — see the `plitzi-authoring` skill, which `create` copies into
`.claude/skills/` beside this one.

## A space on Plitzi, as a project (`create --from`, `pull`)

Taking a space out of Plitzi as a server project of its own, and keeping it in step: read
[reference/from-space.md](reference/from-space.md) when the task names `--from` or `pull`.


## Elements of your own (`add plugin`)

A plugin is a React component the space renders — a map, a chart, a seat picker: whatever is not text in a box. **Never
start one from a blank file**: `add plugin <name>` writes it in the shape the platform, the builder and the linter all
read.

```bash
plitzi add plugin seat-picker                                  # one; asks what the builder calls it and what it is for
plitzi add plugin seat-picker legend                           # several at once
plitzi add plugin seat-picker --title "Seat Picker" --description "Pick a seat from a venue map"
plitzi add plugin ticker --prop interval:number=5000 --prop paused:boolean --trigger onTick:count --callback reset --headless
```

**Say its shape and it is written in it**, with nothing to delete: `--prop name:type=default` (string, number,
boolean) for each attribute — typed, defaulted, bindable, with a control in its panel; `--trigger onTick:count` for
each event and what a flow reads from it, fired with the `use<Name>Events()` hook it gets; `--callback reset` for
each action a flow can call; `--headless` for one with nothing to see (hidden on a page, a badge in the builder).
Without them it writes a counter that shows the three ways an element talks to a space — to be rewritten.

Each is a folder (`src/plugins/SeatPicker/` in a project `create` wrote):

| File | What it holds |
| --- | --- |
| `SeatPicker.tsx` | the component. Its props ARE the element's attributes; render through `RootElement` |
| `declaration.ts` | its `type`, the `triggers` (events) it fires, the `callbacks` (actions) it answers, its default attributes — data only |
| `Settings.tsx` | its panel in the builder |
| `index.ts` | the three put together |

- **Registered by itself**: every folder of `src/plugins` is, under its name in camelCase (`SeatPicker` → `seatPicker`).
  Elsewhere the command prints the line that registers it (for `render()`, `<PlitziSdk>` or a page server).
- **Host it** with `custom({ renderType: 'seatPicker', … })` in `src/space.ts` — or a Custom element in the builder.
- **Checked like a built-in element**: `add plugin` also lists its declaration in `src/plugins/declarations.ts`, which
  every place the project authors the space hands to `authorSpace(space, { plugins: declarations })`. Flows on its
  events, steps to its actions and its attributes are refused when wrong; `declaredTrigger(declaration, 'onPick')` and
  `declaredCallback(declaration, 'reset', { on: 'seats' })` build those steps, typed from the declaration. A plugin
  written by hand is added to that list with its `declaration.ts`.
- **A new event or action** is declared in `declaration.ts` and registered by the component FROM there — never only
  in the component, or neither the builder nor the linter knows it exists.
- A name that is a built-in type (`button`, `form`) is refused: a space could not tell the two apart.

## Plugin packages (`create --plugin`)

Elements any space can load, published on their own, with a Vite preview to write them in:

```bash
plitzi create seat-picker --plugin
plitzi create packages/seat-picker --plugin --name @acme/plitzi-plugin-seat-picker --elements legend,price-tag
```

Its scripts: `start` (the elements inside a space, hot-replaced), `visual`, `typecheck`, `lint`. Add more elements with
`add plugin` from inside it — they are listed in `src/elements.ts` and `src/declarations.ts`, which the package
publishes from. A package's element is authored as a TYPE of its own: `defineElement<SeatPickerAttributes>(declaration)`.

## Building and shipping (`pack plugin`, `upload plugin`)

```bash
plitzi pack plugin                              # in a plugin package: every element
plitzi pack plugin src/plugins/SeatPicker       # an element of a project; several folders → one plugin, the first its main
plitzi upload plugin                            # the zip pack left, onto the space whoami names, installed there
```

`pack` writes one ES module (React and the SDK kept out — the page provides them), `plugin-manifest.json` from the
declarations with integrity hashes, and the zip the builder takes under Resources. `upload` checks the manifest,
sends the zip to one of the space's CDNs (`--cdn`) and installs it — a plugin already there moves to the new version with
its settings kept. `--plugin-version` sets the version the manifest carries. The plugin's source — every file it
imports, followed from its entry — is kept beside it on the space (`runtime push` does the same for a runtime), which
is what `create --from` brings back; `plitzi pack source` writes what would be kept to a file, to look at.

A self-hosted page server does not need `pack`: it compiles a plugin from its source
(`plugins: { seatPicker: { js: 'src/plugins/SeatPicker/index.ts', action: 'compile' } }` in `createServer`).

The same server decides its own say over the space's **feature flags**: `createServer({ flags: { newCheckout: true } })`
(or a function of `{ spaceId, environment }` when it serves several). It overrides what the space declares — only for
flags the space declares — and is overridden by the SDK's `flags` prop and a tester's dev tools. Declaring the flags
themselves is the space's (`flags` in the spec; see the authoring skill's feature flags).

## A space's functions (`functions`)

A space's own server code, edited in `functions/` with `pull`, `push`, `try` and `dev`: read
[reference/functions.md](reference/functions.md) when the task names its functions.


## When something does not work

| What you see | What it is |
| --- | --- |
| `create` printed questions and wrote nothing | nobody answered the three choices — ask the user, pass them as flags |
| `start` says the port is in use | `PORT` is set to a taken port — unset it to take the next free one, or choose another |
| A page that is not this project's, or `shot` refuses the port | another server answers there — `curl 127.0.0.1:<port>/health` names it; `.plitzi/dev-server.json` has this project's port |
| An element renders "Custom Component … Not Found" | the `renderType` names no registered plugin — check the folder name's camelCase |
| A flow on the plugin's event is refused, or never runs | the event is not in `declaration.ts`, or the plugin is missing from `src/plugins/declarations.ts` |
| `upload` opens a browser | there is no session, or no space chosen — the person completes it there |
| The upload went to the wrong space | `plitzi space` chooses another; check `whoami` first |
| `pull` wrote nothing and named files | they changed here and on the space — set your changes aside and pull again, or `--force` |
