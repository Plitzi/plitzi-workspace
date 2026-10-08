---
'@plitzi/sdk-server': patch
'@plitzi/sdk-style': patch
'@plitzi/plitzi-builder': patch
'@plitzi/sdk-variables': patch
---

- **`server.cache.invalidate` drops what a page is rendered from** (`@plitzi/sdk-server`): the pages, the RSC answers
  and the schema data they are rendered from go together. It dropped the pages alone, and the next request rendered
  the same page again from the schema still cached under the same key — a publish that invalidated the space changed
  nothing until the schema's TTL ran out. `clear()` and `size` cover the three. A filter on `hostname` drops the schema
  data too, which belongs to no one host. `server.cache` is `null` only when nothing is cached (`cacheTtlMs: 0` and
  `rsc.cacheTtlMs: 0`).

## Style inspector

- **Finds a property** (`@plitzi/sdk-style`): a search above the categories narrows them to the ones that edit what was
  typed — a CSS name in any order of its words (`border radius` finds the four corners), a category's title, or a
  common word for it (`bg`, `rounded`) — opens them, and shows the advanced rows when the match lives there. Escape
  clears it. The categories' properties live in one list (`categoryKeys.ts`) that the dots, the advanced hint and the
  search all read.
- **Rows that fit**: a section with more than two controls puts its label above them and lays them out in as many
  columns as the panel is wide, instead of one row where every label was cut (`Appearan…`, `Cell Spaci…`, the five
  scroll-snap controls). A row's label column is 80px.
- **Where a value comes from, said quietly**: the label's tint keeps its four meanings — set here, from a token, bound
  to data, inherited — without the solid blocks of colour; hovering says which (an inherited one names its selector and
  breakpoint) and that a click resets it, the click shows it by striking the label through. The footer's info icon
  holds the legend, and its arrow folds every category.
- **What is being edited**: an "Editing … › Hover" line under the pickers whenever the rules being written are not the
  selector's plain ones, with a button back to them. Ancestor, pseudo-element and condition fold behind a toggle —
  never while one is in use.
- The class being edited is the panel's one strong mark (violet), the element's type defaults a softer one; the tools'
  tabs fit the panel and are reachable from the keyboard.

- **Lists edited in a popover, all alike**: box and text shadows, transforms, transitions and filters share one row
  (the CSS it writes, a swatch, a remove button) and one popover (a title, a close button, Escape, the focus moved
  into it). What none of them could read is now kept and edited as text instead of being replaced with a default — a
  token for the whole value, `drop-shadow(…)`, `url(#…)`.
- **Values read the way CSS writes them**: a shadow with two, three or four lengths and its color on either end;
  `rgba(…)` inside text shadows and filters no longer split; negative shadow offsets accepted; a transition with any
  of its parts left out; brightness, contrast and saturation past 1. Transition presets are written as CSS — the
  preset names (`easeInQuad`) made the browser drop the whole declaration — the curve can be dragged into one of your
  own, and the preview stops with the editor. `font-color` (not CSS) became `color`.
- **Background layers keep what they hold**: a repeating gradient (now a switch), a radial gradient's explicit size, a
  token or `image-set()` as a layer (a "Custom (CSS)" layer), a one-value position read as CSS reads it (`20%` is
  `20% center`), lists shorter than the layers repeated as CSS repeats them, an unset repeat read as tiling, two-position
  stops, negative angles — every one of them was rewritten on the next edit of any layer. Defaults are no longer
  written back, and "Token values" no longer bakes resolved tokens into the layers.
- **A layer's editor in two halves** — what it draws, then where it goes (size, position, tile, attachment, clip,
  which now offers `text`). The gradient's stops sit on one bar, each a handle that drags or moves with the arrow keys;
  the stop's color and position below it. Previews and swatches resolve the space's tokens.
- Spacing tells margin (dashed, outside) from padding; Border's sides are labelled and readable in the dark theme; a
  class's menu says what each action does to whom; the Style Manager opens at a size that holds both columns.

## Builder

- **Shortcuts**: `?` shows every shortcut the builder answers to — the same list the "Nothing selected" card teaches
  from — and ⌘\ / Ctrl+\ hides both side panels for the canvas alone and brings back the ones that were open. Both
  work with the canvas focused.
- **Panels keep their width**: each side panel opens at the width it was left at; the right one starts at 380px.
- **Text no smaller than 11px** across the builder's panels (it went down to 10px in fifty places).

