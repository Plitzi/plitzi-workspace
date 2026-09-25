---
name: plitzi-cli
description: >-
  Use the Plitzi command line (@plitzi/cli, `plitzi …` or `npx @plitzi/cli …`) instead of hand-writing what it
  generates: scaffold a project that renders a space, add elements of your own (plugins) to it, create a plugin package,
  build a plugin into the module + manifest + zip the platform takes, and sign in to upload and install it on a space.
  Use whenever the task is to start a Plitzi project, create or change a plugin/custom element, pack, upload or install
  one, or work out which space the CLI is connected to.
---

# The Plitzi CLI

The CLI writes what an agent would otherwise get subtly wrong by hand: a project's server, bundler, lint and visual
test wired together; a plugin's four files in the shape Plitzi's own elements use; a manifest with integrity hashes;
a signed-in upload. **Reach for it before writing any of those yourself.**

```bash
npx @plitzi/cli create my-site                 # a project that renders a space
npx @plitzi/cli add plugin seat-picker legend  # elements of your own, in the project you are in
npx @plitzi/cli create seat-picker --plugin    # a plugin package any space can load
npx @plitzi/cli pack plugin                    # a plugin built, and zipped the way the builder takes it
npx @plitzi/cli upload plugin                  # that zip, on the space you work in, and installed there
npx @plitzi/cli whoami                         # who the CLI is signed in as, and the space it works in
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

## Projects (`create`)

| | `--source local` | `--source cloud` |
| --- | --- | --- |
| `--mode server` | A page server of your own, rendering the space in `src/space.ts`. No account | Your page server, rendering the live space from Plitzi (secret self-hosting key in `.env`) |
| `--mode client` | Vite + the SDK in the browser, no server, no account | The SDK fetches the space with the public render key |

What a project gives you, so you use it rather than rebuild it:

| Script | What it is for |
| --- | --- |
| `start` | serve it — in client mode Vite, which hot-replaces on save |
| `start:dev` | server mode: the server, restarted on save |
| `author` | author `src/space.ts` and print every warning — the check after each change (local projects) |
| `shot -- /path --width 390 --scheme dark` | a picture of one page |
| `visual` | a browser asserts every element the space names is visible |
| `typecheck`, `lint`, `format` | before calling a change done |

The space itself is written with `@plitzi/sdk-authoring` — see the `plitzi-authoring` skill, which `create` copies into
`.claude/skills/` beside this one.

## Elements of your own (`add plugin`)

A plugin is a React component the space renders — a map, a chart, a seat picker: whatever is not text in a box. **Never
start one from a blank file**: `add plugin <name>` writes it in the shape the platform, the builder and the linter all
read.

```bash
plitzi add plugin seat-picker                                  # one; asks what the builder calls it and what it is for
plitzi add plugin seat-picker legend                           # several at once
plitzi add plugin seat-picker --title "Seat Picker" --description "Pick a seat from a venue map"
```

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
- **Hand its declaration to authoring**: `authorSpace(space, { plugins: [declaration] })`. Flows on its events, steps
  to its actions and its attributes are then checked like a built-in element's; `declaredTrigger(declaration, 'onPick')`
  and `declaredCallback(declaration, 'reset', { on: 'seats' })` build those steps, typed from the declaration.
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
its settings kept. `--plugin-version` sets the version the manifest carries.

A self-hosted page server does not need `pack`: it compiles a plugin from its source
(`plugins: { seatPicker: { js: 'src/plugins/SeatPicker/index.ts', action: 'compile' } }` in `createServer`).

## When something does not work

| What you see | What it is |
| --- | --- |
| `create` printed questions and wrote nothing | nobody answered the three choices — ask the user, pass them as flags |
| An element renders "Custom Component … Not Found" | the `renderType` names no registered plugin — check the folder name's camelCase |
| A flow on the plugin's event is refused, or never runs | the event is not in `declaration.ts`, or the space was authored without `plugins: [declaration]` |
| `upload` opens a browser | there is no session, or no space chosen — the person completes it there |
| The upload went to the wrong space | `plitzi space` chooses another; check `whoami` first |
