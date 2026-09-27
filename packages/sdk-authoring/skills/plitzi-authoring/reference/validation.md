# How `authorSpace` checks — and the loop that wastes no attempts

`authorSpace(space, options)` is the whole check. It either returns `{ schema, style, handles, warnings }` or throws, and
knowing HOW it throws is what turns ten attempts into two.

## Three stages, two ways of failing

| Stage | What it checks | How it fails |
| --- | --- | --- |
| 1. Assembly | Each spec as it is turned into a document: fields that exist, CSS properties the editor can read, a class declared twice with different rules, fonts, selector names | **Throws at the FIRST problem**, naming where it was written (`Element "text" (price) at shop/home/0/2`) |
| 2. Structure | The documents: parents, roots, pages, cycles, style targets | Collected, then thrown together |
| 3. Linter | What the documents MEAN: every template, binding, flow step, trigger, callback, attribute and link, read the way the runtime reads them | **All errors at once**, one line each: `Invalid space (…):\n  - [code] message` |

The linter only runs once stage 2 holds, so the pattern of a session is: a few single refusals (fix, re-run), then one
list — **fix every line of the list in one pass** before running again. Each message says what to write instead; do
exactly that (see [authoring-errors](authoring-errors.md) for every code).

Warnings come back in `warnings` and never throw. Each one is written code that will not do what it says — zero is the
bar.

## The loop

0. **Before writing an element you have not used, print what it takes.** One command answers attributes, values,
   triggers, callbacks and slots, and saves a refusal per guess:

   ```bash
   node --input-type=module -e "import * as a from '@plitzi/sdk-authoring'; const t = 'dropdown'; console.log({ attributes: a.elementDefaultAttributes[t], values: a.elementAttributeValues[t], triggers: a.elementTriggers[t], callbacks: a.elementCallbacks[t], slots: a.elementSlots[t] })"
   ```

1. **Author once, print everything.** In a project `plitzi create` wrote, `npm run author`. Anywhere else, a file you run
   with `node` (≥ 22.18 strips the types) — outside the project's source, never committed:

   ```ts
   import { authorSpace } from '@plitzi/sdk-authoring';

   import { space } from './src/space.ts';

   try {
     const { schema, warnings } = authorSpace(space, { plugins: [] /* your declarations */ });
     console.log(`${Object.keys(schema.flat).length} elements, ${warnings.length} warnings`);
     warnings.forEach(warning => console.log(`[${warning.code}] ${warning.message}`));
   } catch (error) {
     console.log((error as Error).message);
   }
   ```

2. **Fix, re-run, until it prints zero warnings.** Then typecheck the project.
3. **Look at it** — in a browser, at desktop and phone width, in both themes (see [testing](testing.md)). Stage 3 is
   thorough about MEANING and blind to what follows.

## What it cannot see

A space that authors cleanly can still render wrong. These are the places to look with your own eyes:

- **The shape of data it does not have.** A binding to `feed.records` is checked to name a provider; whether the
  action's output HAS `records`, or its rows a `magnitude`, is known only at run time. Render with real data.
- **Layout and cascade.** Overflow, stacking, a type's default style under your class (a `button` or `text` default
  applies beneath your rules), a `gap` holding a slot for a hidden element.
- **A plugin's inside** — and, unless you hand its declaration over (`plugins: [declaration]`, see
  [plugins](plugins.md)), its events, actions and attributes too.
- **Anything positioned by a component.** A map marker, a dropdown popup, a tooltip: the component sets `position` on
  its root. A class that sets `position` on it (a panel preset spread into it, say) takes that away, and it lands in
  the page flow — offset, or holding its container open while hidden.
- **What an ancestor's `backdrop-filter`, `filter` or `transform` does**: it becomes the containing block of every
  `position: fixed` descendant and a stacking context of its own, so a popup inside it opens offset and paints UNDER
  its siblings.

## When a CSS property is refused

The style vocabulary is the closed list the editor can read back. What is outside it — `zoom`, `mask`, a custom
property (`--seismic-accent`), a pseudo-element, a keyframe — is not an error to work around: it goes in the space's
`customCss`, addressed by the class name (`.panel`, and `.panel--open` for a variant `variantFrom` applies). Shorthands
inside it ARE accepted and expanded: `inset`, `grid-area`, `outline`, `border`, `padding` all work in `css`.
