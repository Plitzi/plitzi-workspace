---
name: plitzi-render
description: >-
  Show answers as a rendered visual widget instead of plain text, using the Plitzi MCP's plitzi_render tool.
  Use whenever the reply is naturally visual or structured — a recipe, a comparison, pricing tiers, a profile,
  a menu, steps/checklist, a product card, a dashboard-like summary — or whenever the user asks to design,
  build, show, or "make it look nice". Requires the Plitzi MCP server (the plitzi_render tool) to be connected.
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

## The shape of a good call

Everything the widget needs travels in ONE call, as `operations`. Three ops carry almost every widget:

- **`upsertDefinitions`** — declare ALL the CSS classes at once, one class per *look* (not per property).
- **`upsertElement`** — build the whole tree in a single op, nesting with `children` under `pageRef: "render"`.
- **`repeatElement`** — the moment two siblings differ only in data, write the row ONCE as a template with
  `{{item.field}}` placeholders and pass `items`. Rows come out numbered (`tile-1`, `tile-2`…). A list inside each
  row is the same op: give a template node `repeat: { items: "{{item.<field>}}", template: … }`.

```json
{
  "operations": [
    {
      "type": "upsertDefinitions",
      "definitions": {
        "panel": {
          "desktop": {
            "display": "flex",
            "flex-direction": "column",
            "gap": "12px",
            "padding": "16px",
            "min-width": "0",
            "color": "var(--color-text-primary, light-dark(#0f172a, #e8eaed))"
          }
        },
        "row": {
          "desktop": { "display": "flex", "flex-wrap": "wrap", "gap": "12px", "min-width": "0" },
          "mobile": { "flex-direction": "column" }
        },
        "tile": {
          "desktop": {
            "flex": "1 1 0%",
            "min-width": "160px",
            "padding": "12px",
            "border-radius": "10px",
            "border": "1px solid var(--color-border-primary, light-dark(#e2e8f0, #333a48))",
            "background-color": "var(--color-background-secondary, light-dark(#ffffff, #1f2430))"
          }
        },
        "tile-title": { "desktop": { "margin": "0", "font-size": "15px" } },
        "tile-price": { "desktop": { "margin": "0", "font-size": "13px", "opacity": "0.75" } }
      }
    },
    {
      "type": "upsertElement",
      "pageRef": "render",
      "element": {
        "ref": "panel",
        "type": "container",
        "style": { "base": ["panel"] },
        "children": [{ "ref": "title", "type": "heading", "subType": "h3", "props": { "content": "Plans" } }]
      }
    },
    {
      "type": "repeatElement",
      "pageRef": "render",
      "parentRef": "panel",
      "ref": "plans",
      "style": { "base": ["row"] },
      "template": {
        "ref": "tile",
        "type": "container",
        "style": { "base": ["tile"] },
        "children": [
          {
            "ref": "name",
            "type": "heading",
            "subType": "h4",
            "props": { "content": "{{item.name}}" },
            "style": { "base": ["tile-title"] }
          },
          {
            "ref": "price",
            "type": "paragraph",
            "props": { "content": "{{item.price}}" },
            "style": { "base": ["tile-price"] }
          }
        ]
      },
      "items": [
        { "name": "Starter", "price": "$0 / month" },
        { "name": "Team", "price": "$19 / month" },
        { "name": "Business", "price": "$49 / month" }
      ]
    }
  ]
}
```

## The five things that decide whether it looks good

1. **Width is free, height is scarce.** The widget renders in a side panel. A plain container stacks its children
   vertically — that is the tall, half-empty default to avoid. Put peers (metrics, plans, options, image + text) in
   a wrapping row (`display:flex` + `flex-wrap:wrap`, children `flex:1 1 0%` with a `min-width` as the wrap
   threshold) or a grid with `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`. Stack only what reads in
   order: heading over paragraph, forms, steps, prose.
2. **The host may be in dark mode.** Never hardcode a light palette. Take colours from the host variables with a
   `light-dark()` fallback, and always set `color` wherever you set `background-color`.
3. **Watch the SDK defaults.** Every container has `min-width`/`min-height: 50px` — set them to `0` for rails,
   dividers, dots and any flex child that must shrink. Headings and paragraphs keep the browser's margins; zero
   them and space with the parent's `gap`.
4. **Draw with inline SVG, on a budget.** A logo, a sparkline, a badge or a decorative shape goes in a `blockHtml`
   element whose `props.content` is an `<svg>` — keep a `viewBox` with `width`/`height` `100%` so the element's
   class sizes it, and `fill`/`stroke` `currentColor` so it follows the theme. A handful of paths, drawn once and
   reused. Never a `data:` URI, and never a full illustration or a photo-real scene: that costs more than the rest
   of the widget, so use an `https` image, a flat colour or a CSS gradient instead. Markup only — `<script>` and
   inline `on*` handlers are rejected.
5. **Write CSS plainly.** Kebab-case properties, shorthands welcome (`padding: 8px 16px`, `border: 1px solid red`,
   `font: bold 16px/1.5 Arial`) — they are expanded and stored as longhands, so a breakpoint or state can override
   one property on its own.

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

## Going further

Widgets can be data-driven and interactive, not only static: an `apiContainer` fetches at runtime, `upsertBinding`
wires that data into elements, and `upsertInteractionFlow` makes them react to clicks. See the "Data &
interactivity" section of `plitzi://render/guide`.
