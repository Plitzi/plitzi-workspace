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

## The six things that decide whether it looks good

1. **Width is free, height is scarce.** The widget renders in a side panel. A plain container stacks its children
   vertically — that is the tall, half-empty default to avoid. Put peers (metrics, plans, options, image + text) in
   a wrapping row (`display:flex` + `flex-wrap:wrap`, children `flex:1 1 0%` with a `min-width` as the wrap
   threshold) or a grid with `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`. Stack only what reads in
   order: heading over paragraph, forms, steps, prose.
2. **The host may be in dark mode.** Never hardcode a light palette. Take colours from the host variables with a
   `light-dark()` fallback, and always set `color` wherever you set `background-color`.
3. **You are not styling from zero.** The SDK's per-type CSS imposes **no minimum size**: a rail, a divider, a dot
   or a narrow cell is exactly as small as you make it, and no `"min-width": "0"` escape hatch is needed. The flip
   side is that an element with no content and no size takes no space at all — give a spacer its own `height`.
   What does land on your elements is the BROWSER's own defaults: `heading` and `paragraph` keep their UA margins
   (zero them, space with the parent's `gap`), `list` a 40px `padding-left`, `button` its native chrome. Borders
   start at `0 solid`, so `border-color` alone paints nothing — give `border-width` too.
4. **Draw with inline SVG, on a budget.** A logo, a sparkline, a badge or a decorative shape goes in a `blockHtml`
   element whose `props.content` is an `<svg>` — keep a `viewBox` with `width`/`height` `100%` so the element's
   class sizes it, and `fill`/`stroke` `currentColor` so it follows the theme. A handful of paths, drawn once and
   reused. Never a `data:` URI, and never a full illustration or a photo-real scene: that costs more than the rest
   of the widget, so use an `https` image, a flat colour or a CSS gradient instead. Markup only — `<script>` and
   inline `on*` handlers are rejected.
5. **Only use image URLs you have seen work.** Everything the widget loads from outside is fetched for it by the
   render server, so redirects, hotlink rules and missing CORS headers are already handled and there is nothing to
   configure — but nothing can guess a URL. Write a direct file URL, never a page about the picture, a search
   result, or a pattern assembled from memory: one that 404s leaves a grey box in the middle of a finished layout.
   With no URL you trust, draw that block instead (a gradient, a flat colour, an inline `<svg>`).
6. **Write CSS plainly.** Kebab-case properties, shorthands welcome (`padding: 8px 16px`, `border: 1px solid red`,
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

## Making it interactive

Widgets are not only static: `upsertInteractionFlow` attaches a flow to an element — a `trigger` node first
(`onClick`), then the steps that run after it, in order.

**To show and hide, use `toggleState`.** Every element registers `setState` and `toggleState` as `callback`
actions, and `elementId` names the element they act on — the flow's own element by default, or another element's
ref to act on that one. `toggleState` with `category: "state"` and `key: "visibility"` is the show/hide toggle;
there is no separate `toggleVisibility` action. The element starts hidden with `initialState: { "visibility":
false }` on the element itself.

```json
{
  "operations": [
    {
      "type": "upsertElement",
      "pageRef": "render",
      "element": {
        "ref": "card",
        "type": "container",
        "children": [
          { "ref": "card-head", "type": "button", "props": { "content": "Details" } },
          {
            "ref": "card-body",
            "type": "container",
            "initialState": { "visibility": false },
            "children": [
              { "ref": "card-text", "type": "paragraph", "props": { "content": "The hidden detail." } }
            ]
          }
        ]
      }
    },
    {
      "type": "upsertInteractionFlow",
      "pageRef": "render",
      "ref": "card-head",
      "nodes": [
        { "title": "On click", "nodeType": "trigger", "action": "onClick" },
        {
          "title": "Toggle body",
          "nodeType": "callback",
          "action": "toggleState",
          "elementId": "card-body",
          "params": { "category": "state", "key": "visibility" }
        }
      ]
    }
  ]
}
```

Expand/collapse is **one step on one trigger** — never two `setState` branches under opposite `when` conditions,
which read the state as it was when the flow started and so are always one click behind. For several flows on one
element (an `onClick` and an `onMouseEnter`, or two independent clicks), call `upsertInteractionFlow` again with
the same `ref` and **omit `flowId`**; passing an existing `flowId` replaces that flow instead.

Two things routinely go wrong. Events **bubble**, so a clickable element inside another clickable element runs
BOTH flows — put the trigger on one of them (the render warns you and names the pair). And a `globalCallback`
(`addNotification`, `navigate`, app-level `setState`) is provided by a module, not by an element, so **omit
`elementId`** on those; a step with the wrong node type resolves against nothing and silently does nothing.

For data-driven widgets, an `apiContainer` fetches at runtime and `upsertBinding` wires the result into elements —
see "Data & interactivity" in `plitzi://render/guide`, which is also the full reference for everything above.

## After it renders

The widget is shown to the user; you get a compact summary. Don't re-describe what they can already see — a short
caption or a follow-up question is enough.

When the widget has flows, the summary includes an `interactions` line per flow naming what got wired to what
(`"card-head onClick → toggleState card-body[visibility]"`). Read it: it is what confirms the flow landed on the
element you meant. But it reports the **wiring**, not a click that was performed — this tool authors the widget,
it does not drive it. So tell the user what you connected; never claim you verified the behaviour at runtime.
