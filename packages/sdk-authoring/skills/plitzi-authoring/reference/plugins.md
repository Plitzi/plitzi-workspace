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
npx @plitzi/cli create seat-picker --plugin   # a package of its own, with a preview
npx @plitzi/cli pack plugin                   # built, with its manifest and the zip the builder takes
```

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

## Components that draw into DOM they do not render

A map, a chart library, anything that positions its own markers or popups: its roots are the library's to place. Never
give them a class that sets `position` — the element falls into the page's flow, offset by every marker before it. Put
the look in the plugin's own stylesheet (imported CSS ships beside the bundle) and take colours from custom properties
the space sets (`--seat-accent: var(--accent)` in `customCss`); a canvas or WebGL layer resolves them through a probe
element with `getComputedStyle(probe).color`, again whenever `theme.resolved` changes (bind it as a prop).

## Components that draw a lot

A canvas with thousands of shapes on it — a whiteboard, a diagram, a map of points — is judged on a slower machine than
yours: sixty frames a second here says nothing about a four-year-old laptop. What keeps one fast is doing work in
proportion to what CHANGED, not to what is there:

- **Two layers.** Paint what stands still on one canvas and leave it; clear and draw the one over it every frame, with
  only what moves: the cursor, the selection, what is being dragged.
- **Repaint the part that changed.** Something added, edited or removed repaints the area it was and is in, clipped,
  with whatever reaches into it — not the whole board. A pan moves the picture already painted by whole device pixels
  and paints the edges it uncovers.
- **Draw a dragged group once.** Everything picked up moves by the same amount at every step: draw it to a canvas of its
  own when the drag begins and copy that into place after.
- **Cache per object, not per frame.** Treat elements as immutable and key what is derived from one — its bounds, its
  shape, a resolved connector — on the object itself (a `WeakMap`), so nothing is worked out twice for the same thing.
- **Hand the space outcomes, not motion.** A stroke finished, a selection changed: a trigger each. Firing one at every
  pointer move runs a flow and renders the page at every pointer move.
- **Measure with a bench, throttled.** A script that drives the real thing in a browser with the CPU slowed
  (`Emulation.setCPUThrottlingRate`) and reports script time per frame, not only frames per second — and a test that
  counts WORK (full repaints, strokes drawn during a drag), which holds on any machine where a timing does not.

`examples/06-full-examples/04-whiteboard` does all of it; its README's Performance section and its `bench/` are the
worked example.
