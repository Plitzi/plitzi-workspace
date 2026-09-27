# Performance: what renders, and what it costs

A page that does the right thing can still do it by rendering everything, and nothing shows it but the frame rate — on
somebody else's slower machine. Measure it (`inspectRenders`, below) instead of guessing, and write the page so that a
change renders what shows it.

## What makes an element render

An element renders again when something it READS changes, and only then:

- **A binding, a `when` rule or an attribute template subscribes to each path it names** — `computed.tool`, not all of
  `computed`; `state.cart.count`, not all of `state`. Name what you show: a template that reads `state.cart` renders on
  every change to anything in the cart.
- **A computed value is evaluated again whenever the state, the variables, the route, the session, the host or the
  theme changes.** A value that comes out the same keeps its object, so what reads it does not render — but the work of
  evaluating it is done every time. Keep computed values cheap: a filter over a list of five thousand rows belongs in
  the binding of the list that shows them (`bindTemplate(…, { returns: 'value' })`) or in the provider, where it runs
  when the list changes and not on every keystroke anywhere on the page.
- **A parent rendering does not render its children** unless it hands them something new. What an element's own
  bindings change is its own.

## What a flow costs

- **Synchronous steps are one change.** A `setState` after a `setState` after a `toggleState` renders once, when the
  flow gives the page back — at its end, or at the first step that waits (a request, a `delay`), which renders what
  came before it.
- **A trigger that fires on every pointer move or keystroke is a flow per event.** For a stream of events, keep the
  moment-to-moment state inside a plugin and hand the space the outcome (`onCommit`, `onSelectionChange`), not every
  step of it.
- **`whileRunning`** decides what a trigger fired again does while its flow runs: `skip` (the default) drops it,
  `queue` runs it after, `parallel` alongside. A burst of events queued behind a slow request is a burst of renders
  later.

## What mounts

- **A hidden element stays mounted** with its whole subtree — a modal's form, a closed panel's lists. `loadStrategy:
  'visible'` mounts the contents only while it is shown, `'lazy'` from the first time it is shown. Use it for heavy
  subtrees that start hidden.
- **Every list row is a subtree.** Filter the items the list is given; a row hidden by a condition is still a row.

## Measuring it: `inspectRenders`

Render the space with `debugMode` (the SDK profiles every element then), and ask what an interaction rendered:

```ts
import { inspectRenders } from '@plitzi/sdk-authoring';

const report = await inspectRenders(page, () => page.click('[data-plitzi-el="save"]'), { max: 10 });
expect(report.problems).toEqual([]);
```

`report.elements` lists every element that rendered, how often, and what changed for it (`attributes`, `elementState`,
a prop's name); `report.causes` the store paths written meanwhile. `max` turns it into an assertion: over it,
`problems` names the elements that rendered most. A test that holds an interaction to its budget is how a regression
is caught before anybody feels it.

## When something is slow: where to look

1. **Count before changing anything.** `inspectRenders` around the interaction that feels slow. Hundreds of elements
   for one click is the problem; three is not, and the cost is somewhere else (a plugin, a large list mounting).
2. **Read `changed` for the elements that rendered most.** Their own `attributes` or `elementState` changed: find what
   they read in `causes` — a template naming more than it shows, a computed value that reads it. `nothing of its own`:
   its context or its parent carried it; look at the element above it that did change.
3. **Read `causes`.** A path you did not expect written — a flow writing on every pointer move, a provider refetching —
   is the change to stop at its source.
4. **Only then the browser's profiler**, for what a render costs rather than how many there are: a plugin drawing, a
   list of thousands mounting at once.
