# The six things that decide whether it looks good

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
