# Plugins

A plugin is a React component of the project's own — a chart, a map, a game — hosted in the space by a `custom`
element that names it by `renderType`:

```ts
custom({ id: 'arcade', renderType: 'nebulaRun', shipColor: 'amber', bind: { best: 'state.arcadeBest' } })
```

## Creating one

The CLI writes it, in the shape Plitzi's own elements are written in:

```bash
npx @plitzi/cli add plugin seat-picker legend # elements of this project (src/plugins/<Name> in a CLI project)
npx @plitzi/cli create seat-picker --plugin   # a package of its own: build, manifest, preview, and a zip for the builder
```

One folder, four files: `SeatPicker.tsx` (the component), `declaration.ts` (its `type`, the `triggers` it fires, the
`callbacks` it answers to, and the element the builder adds — data only), `Settings.tsx` (its panel in the builder), and
`index.ts` (`Object.assign(Component, declaration, { pluginSettings: Settings })`). An event or an action is declared in
`declaration.ts` and registered by the component from there, never only in the component.

## Props

**The host element's attributes ARE the component's props.** Whatever the space writes on the `custom` element arrives
by the same name, and so does whatever a binding writes — which is what makes a plugin live: bind an attribute to
`state`, a provider or a row, and the component re-renders with the answer. Prefer this to anything else.

`settings` is the other channel: a JSON string whose keys are merged into the props too. It is what the builder's
panel edits for a plugin it has no controls for; from code, write attributes. A `settings` that is not JSON renders
"Settings Malformed" in the page.

Every prop is optional and has a default: an attribute not authored yet, or a binding whose source has not answered,
is `undefined`, and a plugin that renders nothing then is a hole in the page.

## The component

```tsx
import { RootElement } from '@plitzi/plitzi-sdk';

const NebulaRun = ({ shipColor = 'amber', best = 0, className }: NebulaRunProps) => (
  <RootElement className={className}>…</RootElement>
);
```

- **Render `RootElement`**, not a `div`: it carries the element's id, classes and `data-plitzi-el`, so the CSS
  authored on the element applies, the builder can select it and a test can find it.
- **Render the same thing on the server and on the first client pass.** A clock, a random number or anything read from
  `window` belongs in an effect; a hydration mismatch discards the whole tree, not the plugin.
- **Borrow colours.** `currentColor` and the space's `var(--…)` tokens follow the theme; a hard-coded colour is
  invisible in one of them. A canvas reads them with `getComputedStyle(element).getPropertyValue('--accent')` and
  again when `theme.resolved` changes (bind it as a prop).

## Writing to the space

A plugin that produces something the page shows — a score, a selection — writes it to `runtime.state`, where every
binding reads it:

```ts
import { getStateManager } from '@plitzi/plitzi-sdk';

const state = getStateManager();
state.setStateByKey('arcadeBest', Math.max(score, Number(state.state.arcadeBest ?? 0)));
const stop = state.subscribe(next => save(next));      // called after every change; call `stop()` to leave
```

`state` is the current value, `setState` replaces it (or takes an updater), `setStateByKey` writes one key,
`clearState` empties it, `subscribe` listens. Bindings on `state.*` re-render at once.

## Registering

A project `plitzi create` wrote registers every folder of `src/plugins` by itself, under the folder's name in
camelCase (`StatCard` → `statCard`). Anywhere else, the entry registers the component under its `renderType`: the
third argument to `render()`, `<PlitziSdk.Plugin>` in a React application, `plugins` on a page server of your own. A `renderType` nothing registered
renders "Custom Component … Not Found", and a page server logs the missing `renderType` at `error` once per
space: on a server, register it in `plugins` AND name it in the deployment's `pluginNames`.

A plugin PACKAGE, loaded by a space from its `plugin-manifest.json`, is an element TYPE of its own rather than a
`custom` host — it is how the builder adds one somebody dropped. Author it with a typed factory:
`defineElement<SeatPickerAttributes>(declaration)` from the plugin's own `declaration.ts`, or
`elementsFromManifest<{ seatPicker: SeatPickerAttributes }>(manifest)` from what it published — or untyped,
`element('seatPicker', { id: 'seats', start: 3 })`. Name its type to `authorSpace` so it is not taken for a typo:
`authorSpace(space, { pluginTypes: ['seatPicker'] })`.
