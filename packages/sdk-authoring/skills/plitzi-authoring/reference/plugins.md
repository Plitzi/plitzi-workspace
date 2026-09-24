# Plugins

A plugin is a React component of the project's own — a chart, a map, a game — hosted in the space by a `custom`
element that names it by `renderType`:

```ts
custom({ id: 'arcade', renderType: 'nebulaRun', shipColor: 'amber', bind: { best: 'state.arcadeBest' } })
```

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

The client entry registers the component under its `renderType` (the third argument to `render()` in a client
project; `plugins` in a server one — see the project's `src/plugins/README.md`). A `renderType` nothing registered
renders "Custom Component … Not Found", and a page server logs the missing `renderType` at `error` once per
space: on a server, register it in `plugins` AND name it in the deployment's `pluginNames`.

A plugin that is its own element TYPE (`defineElement`, `elementsFromManifest`) rather than a `custom` host is named
to `authorSpace` so it is not taken for a typo: `authorSpace(space, { pluginTypes: ['acmeChart'] })`.
