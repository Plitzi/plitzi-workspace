---
name: plitzi-authoring
description: >-
  Write or change a Plitzi space or snippet in TypeScript with @plitzi/sdk-authoring — pages, layouts, components,
  elements, CSS classes, data bindings, providers and flows — instead of hand-writing schema JSON. Use whenever the task is to
  create, extend, restyle or fix a space: adding a page or a section, sharing a header across pages, binding an
  element to data, showing or hiding something, wiring what happens on click, or turning an exported JSON into code.
---

# Authoring Plitzi spaces

A space is two JSON documents full of cross-referenced ids — **never write them by hand**. `@plitzi/sdk-authoring`
derives them from a small declaration, and refuses one that would not render.

```ts
import { heading, styles, text } from '@plitzi/sdk-authoring';

const page = styles('page', { display: 'flex', 'flex-direction': 'column', gap: '16px' });

export const space = {
  name: 'My space',
  permanentUrl: 'my-space',
  pages: [{ name: 'Home', slug: '', class: page, body: [heading('Hello', { subType: 'h1' }), text('A paragraph.')] }]
};
```

A space on Plitzi — edited in the builder — is edited through the Plitzi MCP server instead, never both on one space.

## How to work

1. **Find, then write.** `npx plitzi element where <id|class|words>` answers the file, the line and the call: edit there, and
   extend what the space already has. People move files — never keep a note of where something is.
2. **Author.** `npm run author`. A refusal says what to write instead: do exactly that. Every problem comes at once —
   fix them all before running again. Zero warnings; take the suggestions, the biggest first.
3. **Look.** `npm run check -- /path --width 1440,390` says in text whether the page is whole; `npm run shot` only
   when the text is not enough.
4. **Before saying done:** `npm run lint:space` clean, and the [review checklist](reference/review-checklist.md).

What a name means — an element, a step, a trigger, a code, any export (`pageFamily`, `SpaceSpec`): `npx plitzi explain
<name>`, in a few lines. Never read the `.d.ts`.

## Five rules authoring cannot check for you

1. **Name what is referred to.** An `id` for every element a binding, a flow or a test addresses; ids are one namespace,
   so a helper that runs twice builds inside `scope('promos', ref => …)`.
2. **Share, never copy.** A look used twice is a class; chrome on several pages a layout; a block placed again with
   other content a component; rows of data one `list`.
3. **What is revealed starts hidden** (`visible: 'source'`), so it never flashes while its data loads.
4. **Know where a template runs.** A binding and a step's params are full Twig; an attribute resolves a name with
   filters. A source is spelled in full: `apiContainer_stats`.
5. **Tokens, not colours** — a variable with a `light` and a `dark` value.

The rest, and why: [rules](reference/rules.md).

## What to read

Start with [the cheatsheet](CHEATSHEET.md), then only what the task names:

| The task | Read |
| --- | --- |
| A site — landing, catalogue, blog | [elements-and-styles](reference/elements-and-styles.md), [layouts](reference/layouts.md), [components](reference/components.md), [lists](reference/lists.md) |
| An app with state and actions | [data-and-visibility](reference/data-and-visibility.md), [templates](reference/templates.md), [flows](reference/flows.md) |
| A component of your own | [plugins](reference/plugins.md) |
| A whole working file to copy | [recipes](reference/recipes.md) |
| A refusal or a warning | `npx plitzi explain <code>` |
| Tests | [testing](reference/testing.md) |
| Anything else | [the index](reference/index.md): every reference, and when |
