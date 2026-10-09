# Elements of your own, and plugin packages

## Elements of your own (`plugin add`)

A plugin is a React component the space renders — a map, a chart, a seat picker: whatever is not text in a box. **Never
start one from a blank file**: `add plugin <name>` writes it in the shape the platform, the builder and the linter all
read.

```bash
plitzi plugin add seat-picker                                  # one; asks what the builder calls it and what it is for
plitzi plugin add seat-picker legend                           # several at once
plitzi plugin add ticker --prop interval:number=5000 --prop paused:boolean --trigger onTick:count --callback reset --headless
```

**Say its shape and it is written in it**: `--prop name:type=default` (string, number, boolean; `list`/`json` for data
a binding fills) per attribute — typed, bindable, with a control in its panel; `--trigger onTick:count` per event and
what a flow reads, fired with `usePluginTrigger(declaration)` — `fire('onTick', { count })`, typed; `--callback reset` per action a flow calls; `--headless`
for one with nothing to see. Without them it writes a counter showing the three ways an element talks to a space.

Each is a folder (`src/plugins/SeatPicker/` in a project `create` wrote):

| File | What it holds |
| --- | --- |
| `SeatPicker.tsx` | the component. Its props ARE the element's attributes; render through `RootElement` |
| `declaration.ts` | `definePlugin<…Attributes>()({ type, label, attributes, triggers, callbacks })` — the events it fires, the actions it answers, its defaults; the rest derived. Data only |
| `Settings.tsx` | its panel in the builder |
| `index.ts` | the three put together |

- **Registered by itself**: every folder of `src/plugins` is, under its name in camelCase (`SeatPicker` → `seatPicker`).
  Elsewhere the command prints the line that registers it (for `render()`, `<PlitziSdk>` or a page server).
- **Place it** from its declaration in `src/space/`: `const seatPicker = defineElement(declaration)`,
  then `seatPicker({ id: 'seats', … })` — what `plugin add` and `explain` print. On Plitzi, the builder adds the same.
- **Checked like a built-in element**: its folder's `declaration.ts` is found by itself and handed to
  `authorSpace(space, { plugins })`: flows on its events, steps to its actions and its attributes are
  refused when wrong; `declaredTrigger(declaration, 'onPick')` and `declaredCallback(declaration, 'reset', { on: 'seats' })`
  build them typed. A plugin written by hand is added to that list.
- **A new event or action** is declared in `declaration.ts` and registered by the component FROM there — never only
  in the component, or neither the builder nor the linter knows it exists.
- A name that is a built-in type (`button`, `form`) is refused: a space could not tell the two apart.
- **A server half** (`--server`): `functions/index.ts` in its folder — routes under `/fn/plugins/<type>/`
  (`usePluginRoute`), steps `<type>.<action>`, its own `kv`, none of the space's credentials.

## Plugin packages (`create --plugin`)

Elements any space can load, published on their own, with a Vite preview to write them in:

```bash
plitzi create seat-picker --plugin
plitzi create packages/seat-picker --plugin --name @acme/plitzi-plugin-seat-picker --elements legend,price-tag
```

Its scripts: `start` (the elements inside a space, hot-replaced), `visual`, `typecheck`, `lint`. Add more elements with
`plugin add` from inside it — they are listed in `src/elements.ts` and `src/declarations.ts`, which the package
publishes from. A package's element is placed the same way: `defineElement(declaration)`.

## Building and shipping (`plugin pack`, `plugin upload`)

```bash
plitzi plugin pack                              # in a plugin package: every element
plitzi plugin pack src/plugins/SeatPicker       # an element of a project; several folders → one plugin, the first its main
plitzi plugin upload                            # the zip pack left, onto the space whoami names, installed there
```

`pack` writes one ES module (React and the SDK kept out — the page provides them), `plugin-manifest.json` from the
declarations with integrity hashes, and the zip the builder takes under Resources. `upload` checks the manifest,
sends the zip to one of the space's CDNs (`--cdn`) and installs it — a plugin already there moves to the new version with
its settings kept. `--plugin-version` sets the version the manifest carries. The plugin's source — every file it
imports, followed from its entry — is kept beside it on the space (`runtime push` does the same for a runtime), which
is what `create --from` brings back; `plitzi source pack` writes what would be kept to a file, to look at.

A self-hosted page server does not need `pack`: it compiles a plugin from its source (`action: 'compile'`).

The same server decides its own say over the space's **feature flags**: `createServer({ flags: { newCheckout: true } })`
(or a function of `{ spaceId, environment }` when it serves several). It overrides what the space declares — only for
flags the space declares — and is overridden by the SDK's `flags` prop and a tester's dev tools. Declaring the flags
themselves is the space's (`flags` in the spec; see the authoring skill's feature flags).
