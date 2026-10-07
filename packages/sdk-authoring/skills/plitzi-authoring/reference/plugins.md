# Plugins

A plugin is a React component of the project's own — a chart, a map, a game — hosted in the space by a `custom`
element that names it by `renderType`:

```ts
custom({ id: 'arcade', renderType: 'nebulaRun', shipColor: 'amber', bind: { best: 'state.arcadeBest' } })
```

## Creating one

The CLI writes it, in the shape Plitzi's own elements are written in: `npx @plitzi/cli plugin add seat-picker` (a
package of its own and packing it: the CLI skill).

One folder, four files: `SeatPicker.tsx` (the component), `declaration.ts` (its `type`, the `triggers` it fires, the
`callbacks` it answers to, and the element the builder adds — data only), `Settings.tsx` (its panel in the builder), and
`index.ts` (`Object.assign(Component, declaration, { pluginSettings: Settings })`). An event or an action is declared in
`declaration.ts` and registered by the component from there, never only in the component.

A plugin fires its events with `interactionsManager.interactionTrigger(id, action, payload)` whenever it has news —
from its first effect too: a flow starts once the page has finished mounting, so the `setState` it calls is there. No
`queueMicrotask` or delay of your own. An event that REPORTS a state, and may fire again before its flow ends (as a
component reads its real value right after mounting), wants `whileRunning('queue', …)` on the flow: by default a firing
while the flow runs is dropped, and the stale first report would stick.

## Props

**The host element's attributes ARE the component's props.** Whatever the space writes on the `custom` element arrives
by the same name, and so does whatever a binding writes — which is what makes a plugin live: bind an attribute to
`state`, a provider or a row, and the component re-renders with the answer. Prefer this to anything else.

`settings` is the other channel: a JSON string whose keys are merged into the props too. It is what the builder's
panel edits for a plugin it has no controls for; from code, write attributes. A `settings` that is not JSON renders
"Settings Malformed" in the page.

Every prop is optional with a default: an attribute not authored yet, or a binding not answered yet, is `undefined`.

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
`clearState` empties it, `subscribe` listens. Bindings on `state.*` re-render at once. With the space's `keepState`
on ([kept state](kept-state.md)), what a plugin writes there — its layout, a choice — is back after a reload too.

## Laying out the space's elements

A plugin that arranges elements — a dock, tabs, a masonry — HOLDS them: they are its children in the space
(`custom({ renderType: 'dock', children: [feed, tools] })`, or dropped into it in the builder), and the component
places each in a box of its own, by the id it was authored under:

```tsx
import { elementChildren } from '@plitzi/plitzi-sdk';

{elementChildren(children).map(({ id, node }) => <section key={id} style={placed[id]}>{node}</section>)}
```

Never write `style` onto an element the plugin does not render: nothing promises to keep it. Its boxes share one
stacking context, the plugin's. `useDisplayMode()` names the breakpoint showing — `desktop`, `tablet` or `mobile` — at
the widths the space's styles use, instead of a width of the plugin's own.

## Its own server code

`plitzi plugin add board --server` writes `functions/index.ts` in its folder (the CLI skill). Its routes answer
under `/fn/plugins/board/`; the component names them, with nothing for the space to wire:

```tsx
const route = usePluginRoute('board'); // from '@plitzi/plitzi-sdk'
const url = route('/layout'); // undefined where no server runs code (the canvas)
```

Its `ctx.kv` is the plugin's own; the space's credentials, channels and data are not.

## Talking to other pages

A plugin that moves at the speed of a cursor reads a realtime channel through `useChannel` rather than through flows —
messages arrive through a callback and re-render nothing:

```tsx
import { useChannel } from '@plitzi/plitzi-sdk';

const room = useChannel(roomTopic, { onMessage: message => move(message.from, message.data) });
room.publish('pointer', { x, y });   // throttle it: ~20 a second, the latest position each time
room.members;                        // who is here, with the state each announced
```

Take the topic as a prop (`bindTemplate('roomTopic', 'board.id', 'room:{{ source }}')`) so the space names its
channels, and trust a message you act on only when `message.from === 'server'`. The page has one connection and is one
member per topic, however many elements and plugins listen.

## Feature flags

A plugin that ships a feature behind one of the space's [feature flags](feature-flags.md) asks with `useFlag` — the
answer every layer gave (the space's rules, the server, the SDK, a tester forcing it), and it renders again when it
changes:

```tsx
import { useFlag } from '@plitzi/plitzi-sdk';

const newChart = useFlag('newChart'); // false for a flag the space does not declare
```

Gating the whole plugin needs no code: give its element `flag: 'newChart'`.

## Drawing and animating

A canvas, WebGL or a loop of its own: `useCanvas2d`, `useWebGL`, `useWebGL2` and `useAnimationFrame` — and keeping one
with thousands of shapes fast — see [drawing](drawing.md).

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
`element('seatPicker', { id: 'seats', start: 3 })`.

## Checked like a built-in element

Hand `authorSpace` the plugin's DECLARATION — the `declaration.ts` beside the component, or a manifest's
`pluginSchema` entry:

```ts
import declaration from './plugins/SeatPicker/declaration';

authorSpace(space, { plugins: [declaration] });
```

It is then held to what it declares, whether it is authored as its own type or hosted by `custom({ renderType:
'seatPicker' })`: a flow on an event it never fires, a step sent to an action it does not answer, an attribute it does
not read — each is refused with the name it should have been. (`pluginTypes: ['seatPicker']` only tells the linter the
type exists; nothing about how the space uses it is checked.) A `custom` host whose component is NOT handed over is not
judged on its events at all — nothing here knows them.

Its events and actions have builders typed from the same declaration, so a name it does not declare is a compile error:

```ts
seats({ id: 'seats', flows: [[named('picked', declaredTrigger(declaration, 'onPick')), setState({ key: 'seat', type: 'text', value: '{{ picked.seat }}' })]] })
button({ content: 'Clear', flows: [[onClick(), declaredCallback(declaration, 'reset', { on: 'seats' })]] })
```

A plugin says what HAPPENED through its events (`onPick`, with the seat in the payload) and lets the space's flows
decide what that means — write `state`, open a modal, call a server action. Prefer that to writing `state` from inside
the component: the flow is visible in the space, the builder shows it, and the same act can come from a button too.

- A param declared `number` or `boolean` arrives as one, written or bound; any other arrives as written.
- To act when another element appears, `useElementVisible('tools')` (`@plitzi/plitzi-sdk`) — never watch classes.
- A name for screen readers is a prop of its own: declare `label`, write it as the root's `aria-label`.

## Behaving in the builder

The builder draws the element on its canvas while somebody edits the page: a click selects it, a drag moves it, a key
belongs to the editor.

- **Outside preview, do nothing on your own.** `usePlitziServiceContext().settings.previewMode` is `false` while the
  page is edited. Declared interactions are already held back then; your own click handlers, timers, global listeners,
  permission prompts and map gestures are not — gate them on `previewMode`, and still render something to select.
- **A drag lives in state, not in refs read while rendering** (the project's lint refuses that): keep the gesture
  in `useState`, mirror the latest props into a ref inside an effect, and attach `pointermove` on `pointerdown`.
- **Never the global `window` or `document`.** The canvas is a frame of its own and the code runs in the builder's
  window: listen, measure and go full screen through the node's own page (`ref.current.ownerDocument`, its
  `defaultView`) or `usePlitziServiceContext().utils.getWindow()`. An `instanceof` check takes its class from there too.

## The plugin's stylesheet and the space's CSS

A plugin's stylesheet ships in a layer below the space's (`plitzi-sdk-plugin`, written by the build): the space's
classes and `customCss` win over it whatever their specificity, as over a built-in element's defaults.

A file a library needs whole is imported as Vite imports it, and travels inside the bundle: `worker.js?raw` is its
text (a worker, started from `URL.createObjectURL(new Blob([source]))`), `engine.wasm?inline` a data URI. Images and
fonts a stylesheet names are carried the same way.

## Components that draw into DOM they do not render

A map, a chart library, anything that positions its own markers or popups: its roots are the library's to place. Never
give them a class that sets `position` — the element falls into the page's flow, offset by every marker before it. Put
the look in the plugin's own stylesheet (imported CSS ships beside the bundle) and take colours from custom properties
the space sets (`--seat-accent: var(--accent)` in `customCss`); a canvas or WebGL layer resolves them through a probe
element with `getComputedStyle(probe).color`, again whenever `theme.resolved` changes (bind it as a prop).
