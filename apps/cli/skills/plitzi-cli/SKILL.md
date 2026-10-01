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
npx @plitzi/cli create my-site                 # a project that renders a space
npx @plitzi/cli create my-board --from pizarra # a space on Plitzi, as a project that serves it alone
npx @plitzi/cli pull                           # that project brought up to date with its space
npx @plitzi/cli add plugin seat-picker legend  # elements of your own, in the project you are in
npx @plitzi/cli create seat-picker --plugin    # a plugin package any space can load
npx @plitzi/cli pack plugin                    # a plugin built, and zipped the way the builder takes it
npx @plitzi/cli upload plugin                  # that zip, on the space you work in, and installed there
npx @plitzi/cli whoami                         # who the CLI is signed in as, and the space it works in
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

## A space on Plitzi, as a project (`create --from`, `pull`)

`create --from <space>` (its permanent URL or id) writes a server project holding everything the space is made of, and
serving it with nothing of Plitzi's — neither its servers nor its CDN:

- its pages as authoring code in `src/space/` (`--source cloud` writes none: they stay on Plitzi, read with a key);
- its actions in `src/actions/` — each a `defineAction` call where the document reads back exactly, JSON where it does
  not (the report says why) — and its connectors as JSON;
- its functions in `functions/`, its runtime and plugins as the source they were built from, under `src/`;
- its files downloaded into `public/`, every CDN address rewritten to the project's own;
- `.env` with a signing key made for it, and the names of the variables and credentials it needs — never their values.

It takes a signed-in CLI and a space the person may change (owner, admin or writer). It takes out the draft unless
`--environment production` (that environment's latest snapshot) or `--environment production --revision 3` (that one,
pinned) says otherwise. Read the report it prints: a
plugin or runtime uploaded before Plitzi kept sources comes across built only (`vendor/`), and a space with visitor
roles needs sign-in of its own (the note in `src/main.ts`).

`pull` brings the project up to date: what changed on the space alone is written, what changed here alone is kept,
and when one file changed on both it writes **nothing** and names them — keep your changes aside and pull again, or
`--force` to take the space's copy. It never touches `.env`, and only adds to `package.json`. What the project was given
is recorded in `.plitzi/space.json`: commit it. It follows the version the project was made from; `pull --environment
… --revision …` moves it to another, `--revision latest` lets go of a pin.

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

## A space's functions (`functions`)

A space's own server code — TypeScript tasks its actions run as steps, and routes under `/fn/` — lives in the space;
`functions/` in a project is a **working copy** of it. The contract (`defineFunctions`, `ctx`) and every rule are in
`docs/en/functions.md` of the workspace; what matters for the CLI:

- **Pull before you edit, push when done.** `pull` refuses to overwrite what is not pushed (`--force` throws it
  away); `push` refuses when the space changed since the pull — someone saved in the builder. Then: keep your changes
  aside, `pull`, apply them again, `push`. Never `--force` over somebody else's work to get past it.
- **A push is checked, not just stored.** A problem comes back as `functions/<file>:<line> <message>` and nothing is
  saved — fix it and push again. `index.ts` must default-export `defineFunctions({ … })`; files import each other by
  relative path and `@plitzi/sdk-server/functions`, nothing else.
- **`try` runs the saved draft for real** (its fetches and writes happen). `dev` runs `functions/` on this machine with
  the project's own `@plitzi/sdk-server` — `npm install -D @plitzi/sdk-server isolated-vm core-js` first — and sends
  nothing to the space; `PLITZI_FUNCTIONS_CREDENTIALS='{"stripe":{"apiKey":"…"}}'` gives it credentials to name.
- **The live site runs what the space was last published with.** A push changes the draft; publishing is the person's.

## When something does not work

| What you see | What it is |
| --- | --- |
| `create` printed questions and wrote nothing | nobody answered the three choices — ask the user, pass them as flags |
| An element renders "Custom Component … Not Found" | the `renderType` names no registered plugin — check the folder name's camelCase |
| A flow on the plugin's event is refused, or never runs | the event is not in `declaration.ts`, or the plugin is missing from `src/plugins/declarations.ts` |
| `upload` opens a browser | there is no session, or no space chosen — the person completes it there |
| The upload went to the wrong space | `plitzi space` chooses another; check `whoami` first |
| `pull` wrote nothing and named files | they changed here and on the space — set your changes aside and pull again, or `--force` |
