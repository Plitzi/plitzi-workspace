---
name: plitzi-render
description: >-
  Show answers as a rendered visual widget instead of plain text, using the Plitzi MCP's plitzi_render tool.
  Use whenever the reply is naturally visual or structured — a recipe, a comparison, pricing tiers, a profile,
  a menu, steps/checklist, a product card, a dashboard-like summary — or whenever the user asks to design,
  build, show, or "make it look nice", including widgets that react to clicks (toggles, expanders, tabs).
  Requires the Plitzi MCP server (the plitzi_render tool) to be connected.
---

# Rendering answers as Plitzi widgets

`plitzi_render` renders a small, self-contained UI widget the user can SEE. It runs the Plitzi SDK offline — no
backend, no account, no space, so it works even on a connection with no credentials. Prefer **showing** a widget
over a long text answer whenever the content is naturally visual.

## When to reach for it

- **Something to design or build**: a card, hero, banner, form, pricing table — anything the user asks you to
  "create / design / build / show / make look nice".
- **A naturally visual answer**: a recipe → a card with photo + ingredients; a comparison → side-by-side tiles;
  steps → a checklist; a product, place or person → a profile card; options → a tiled menu.

Keep writing plain text when the answer is genuinely textual — an explanation, code, a discussion. One good widget
beats a wall of text, but a widget wrapping a paragraph helps no one.

## Before the first call

Read the MCP resource **`plitzi://render/guide`** once per conversation. It is the authoritative authoring model:
every operation, the element types and their props, the styling system, worked examples. `plitzi://render/types`
lists every element type with its description. Don't reconstruct the schema from memory — read the guide.

## Iterating on a widget you already rendered

Every render answers with a **`renderId`**. To change that widget, do NOT rebuild it: call again with
`patch: true`, that `renderId`, and only the operations that differ (`patchElement`, `patchDefinition`,
`deleteElement`, a new `repeatElement`). Address rows by the refs you already know (`tile-1`, `tile-2`). The widget
merges the delta into the batch it was built from and reports back what it applied, errors included.

Patch **only** to modify that widget. A different subject, or a different kind of widget, is a fresh render with no
`patch` — the delta is merged into the previous batch, so patching a new idea leaves the user looking at both at
once. Rebuilding when you could have patched only costs tokens; patching when you should have rebuilt costs the
user a wrong widget.

If the answer says the widget could not be recovered (a surface that renders no widgets, a host that keeps no
storage, a conversation resumed elsewhere), send the whole batch again without `patch`.

## When a call fails

`plitzi_render` answers with `rendered: false` and `errors: [{ path, message, hint }]`, plus `warnings` for smaller
issues. The `path` names the operation, so fix that one and call again — you never lose the rest of the batch. An
unknown prop comes back as a warning naming the right one, so probing is safe.

## After it renders

The widget is shown to the user; you get a compact summary. Don't re-describe what they can already see — a short
caption or a follow-up question is enough.

When the widget has flows, the summary includes an `interactions` line per flow naming what got wired to what
(`"card-head onClick → toggleState card-body[visibility]"`). Read it: it is what confirms the flow landed on the
element you meant. But it reports the **wiring**, not a click that was performed — this tool authors the widget,
it does not drive it. So tell the user what you connected; never claim you verified the behaviour at runtime.

## What to read

| The task | Read |
| --- | --- |
| Writing the call: the tree, the classes, the order of operations | [the shape of a good call](reference/good-call.md) |
| Making it look good: spacing, type, colour, images | [the six things](reference/looks.md) |
| Toggles, expanders, tabs — a widget that reacts | [making it interactive](reference/interactive.md) |
