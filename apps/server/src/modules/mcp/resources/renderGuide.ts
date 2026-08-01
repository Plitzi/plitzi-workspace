import { envelope, jsonContents } from './envelope';
import { BUILTIN_COMPONENTS } from '../catalogs';

import type { McpLog } from '../helpers';
import type { ResourceEnvelope } from '../types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// A public, space-independent authoring guide scoped to plitzi_render — the conversational surface where an agent
// may hold this ONE tool and none of the space/editing context. The full plitzi://guide is editing-oriented (spaces,
// navigation, write tools) and would mislead here; this teaches only how to assemble a render widget.
export const RENDER_GUIDE_URI = 'plitzi://render/guide';

// The catalog of built-in element types the agent can author. plitzi://types is space-dependent (types observed from
// a real space), so it is empty on the auth-less conversational surface; this serves the static built-in set instead.
export const RENDER_TYPES_URI = 'plitzi://render/types';

// Categories an offline widget can use: layout, content, media, forms and data providers (apiContainer fetches at
// runtime). Excluded — 'internal' (page/loading, not authorable) and 'advanced' (raw HTML/JSX/plugin escape hatches).
const RENDER_TYPE_CATEGORIES = new Set(['structure', 'basic', 'media', 'form', 'provider']);

// The one 'advanced' type a widget is offered, and only for what it is good at here: an inline <svg>. Vector marks,
// sparklines and background shapes are what a widget cannot draw any other way, and every other route to one (a
// data: URI, a stack of styled containers) costs more and themes worse. Its description is overridden because the
// catalog's — a general-purpose escape hatch — invites exactly the raw scripting the widget validator rejects.
const RENDER_RAW_HTML_TYPE = 'blockHtml';

const rawHtmlDescription =
  'Renders a raw HTML string (props.content) — in a widget, the way to draw an inline <svg>: a logo, an icon, a ' +
  'sparkline, a decorative shape. Use fill/stroke "currentColor" so it takes the host theme. Markup only: ' +
  '<script>, javascript: URLs and inline on* handlers are rejected.';

const renderTypesNote =
  'The built-in element types you can put in a plitzi_render widget, grouped by category. Pick by `description`. ' +
  'For the props of each type and the full authoring model, read plitzi://render/guide. Types that need a backend ' +
  '(providers) or a plugin are omitted because the widget renders offline.';

type RenderTypeInfo = { label?: string; category?: string; description?: string };

const renderTypes = (): { note: string; types: Record<string, RenderTypeInfo> } => {
  const types: Record<string, RenderTypeInfo> = {};
  for (const [name, info] of Object.entries(BUILTIN_COMPONENTS)) {
    if (info && info.category && RENDER_TYPE_CATEGORIES.has(info.category)) {
      types[name] = { label: info.label, category: info.category, description: info.description };
    }
  }

  const rawHtml = BUILTIN_COMPONENTS[RENDER_RAW_HTML_TYPE];
  if (rawHtml) {
    types[RENDER_RAW_HTML_TYPE] = {
      label: rawHtml.label,
      category: rawHtml.category,
      description: rawHtmlDescription
    };
  }

  return { note: renderTypesNote, types };
};

const renderGuideText = `# plitzi_render — authoring guide

\`plitzi_render\` shows the user a live UI widget. You build it as a list of \`operations\` (applied IN ORDER) that
assemble an element tree under one pre-seeded root page whose ref is **"render"**. It renders fully offline — no
space, no backend, no account. Same operation vocabulary as the editing tool plitzi_apply, aimed at one page.

Most widgets are **presentation only** — the structure + styling below is all you need, so start there. The widget
runs the live Plitzi SDK though, so it can also **fetch data** (an \`apiContainer\`) and **react to events**
(interaction flows); see "Data & interactivity" at the end when a widget needs them.

Each call renders a **fresh** widget: send **every** operation it needs in the one call.

**To CHANGE a widget you already rendered, do not rebuild it** — every render answers with a \`renderId\`; call
again with that id, \`patch: true\` and only the operations that differ:

\`\`\`json
{ "patch": true, "renderId": "r7f3a2c", "operations": [
  { "type": "patchDefinition", "ref": "tl-card", "desktop": { "border-radius": "20px" } },
  { "type": "patchElement", "pageRef": "render", "ref": "title-2", "props": { "content": "EPCOT (día largo)" } }
] }
\`\`\`
The widget merges the delta into the batch it was built from and reports back what it applied — including the
errors, if a ref does not exist. Address rows by the refs you already know (\`card-1\`, \`blk-2-3\`). If it reports
that the widget could not be recovered (a surface that renders none, a host that keeps no storage, a conversation
resumed elsewhere), send the whole batch again without \`patch\`.

**Patch only to modify what is on screen.** A different subject, or a different kind of widget, is a FRESH render
with no \`patch\` — the delta is merged into the previous widget, so patching a new idea leaves the user looking at
both at once. Rebuilding when you could have patched only costs tokens; patching when you should have rebuilt costs
the user a wrong widget.

## Build the whole widget in ONE upsertElement (nest with \`children\`)

The simplest, least error-prone path: a single \`upsertElement\` whose \`element\` carries a nested \`children\` tree —
so you describe the layout the way it renders, no ref-juggling. \`pageRef: "render"\` is required; each element in the
tree needs a unique \`ref\` — a name you choose from letters, digits, \`-\` and \`_\`, **starting with a letter and with
no dots** (e.g. \`price-row\`, \`cta_button\`).

\`\`\`json
{ "type": "upsertElement", "pageRef": "render", "element": {
    "ref": "card", "type": "container", "style": { "base": ["card"] },
    "children": [
      { "ref": "plan",   "type": "heading",   "subType": "h3", "props": { "content": "Pro" } },
      { "ref": "amount", "type": "text",      "props": { "content": "$29/mo" }, "style": { "base": ["price"] } },
      { "ref": "buy",    "type": "button",    "props": { "content": "Start free trial" }, "style": { "base": ["cta"] } }
    ]
} }
\`\`\`

An element is \`{ ref, type, subType?, props?, style?, children? }\`. Children render in array order. (You *can* also
add elements one-by-one with a top-level \`parentRef: "<existing ref>"\` and optional \`position\` — useful to append to
or restructure something you already created — but for a fresh widget the inline \`children\` tree is easier.)

## Repeating rows — repeatElement, never copy-paste

The moment two siblings have the same shape and different data — a list, steps, cards, a table, a timeline —
**write the shape once** and hand over the rows. \`repeatElement\` creates the wrapper (style it with the row/grid
class) and renders the template once per entry of \`items\`:

\`\`\`json
{ "type": "repeatElement", "pageRef": "render", "ref": "steps", "style": { "base": ["list"] },
  "template": {
    "ref": "step", "type": "container", "style": { "base": ["row"] },
    "children": [
      { "ref": "at",   "type": "paragraph", "style": { "base": ["time"] }, "props": { "content": "{{item.time}}" } },
      { "ref": "what", "type": "paragraph", "style": { "base": ["txt"] },  "props": { "content": "{{item.text}}" } }
    ]
  },
  "items": [
    { "time": "08:00", "text": "Doors open, head straight to the main hall." },
    { "time": "10:30", "text": "Workshops in the east wing." },
    { "time": "13:00", "text": "Lunch, then the keynote." }
  ]
}
\`\`\`
- \`{{item.<field>}}\` is replaced by that row's field, anywhere in the template (props, a style ref, a param).
  A placeholder that is the WHOLE value keeps the field's type (\`"{{item.count}}"\` with \`count: 3\` stays the
  number 3); mixed with text it interpolates. Dotted paths work: \`{{item.author.name}}\`.
- Every ref in the template gets the row number appended — \`step\` becomes \`step-1\`, \`step-2\`… — so rows never
  collide and you can address one later without reading anything back.
- Other \`{{…}}\` names are left untouched, so schema variables keep working inside a template.
- A row missing a field the template reads fails the batch and names the row and the fields it does carry.
- Up to 100 rows per op. Rows that differ in SHAPE (not just data) are not rows — write those as plain elements.

**A list inside each row** — a timeline of days each with its own steps, a menu of sections each with its dishes —
is one op too: give the node that should wrap the sub-list a \`repeat\`, and put the sub-rows in the row's data.

\`\`\`json
{ "type": "repeatElement", "pageRef": "render", "ref": "timeline", "style": { "base": ["tl"] },
  "template": {
    "ref": "day", "type": "container", "style": { "base": ["day"] },
    "children": [
      { "ref": "title", "type": "heading", "subType": "h3", "props": { "content": "{{item.park}}" } },
      { "ref": "body", "type": "container", "style": { "base": ["body"] },
        "repeat": { "items": "{{item.blocks}}", "template": {
            "ref": "blk", "type": "container", "style": { "base": ["blk"] },
            "children": [
              { "ref": "at",   "type": "paragraph", "props": { "content": "{{item.time}}" } },
              { "ref": "what", "type": "paragraph", "props": { "content": "{{item.text}}" } }
            ]
        } } }
    ]
  },
  "items": [
    { "park": "Magic Kingdom", "blocks": [ { "time": "08:00", "text": "Rope drop." }, { "time": "10:30", "text": "Space Mountain." } ] },
    { "park": "EPCOT",         "blocks": [ { "time": "08:30", "text": "Cosmic Rewind." } ] }
  ]
}
\`\`\`
- The node carrying \`repeat\` becomes the WRAPPER of its sub-list (its own \`children\` are ignored), so put the
  sub-list's layout class on it.
- Inside the sub-template \`{{item.…}}\` reads the SUB-row; a field of the outer row is not reachable from there,
  so repeat it in each sub-row if you need it.
- Refs number both levels, outer first: \`blk-2-3\` is the third block of the second day.
- **One level of nesting**: the sub-template is a plain element tree, so it cannot carry another \`repeat\`.
- The whole op is capped at 500 rows across both levels.

## Style with reusable classes — upsertDefinitions

Styling is separate from structure: declare the classes, then attach them by ref. **Declare them all in ONE
\`upsertDefinitions\`**, keyed by class name — a widget usually needs a dozen classes, and one op per class spends a
noticeable slice of the call on repeated \`{"type":"upsertDefinition","ref":…}\` envelopes.

\`\`\`json
{ "type": "upsertDefinitions", "definitions": {
    "card": { "desktop": { "display": "flex", "flex-direction": "column", "gap": "8px", "padding": "16px", "border-radius": "12px" } },
    "title": { "desktop": { "font-size": "16px", "font-weight": "600", "margin-top": "0", "margin-bottom": "0" } }
} }
\`\`\`
Each value is exactly what \`upsertDefinition\` takes minus \`type\`/\`ref\` (\`desktop\`/\`tablet\`/\`mobile\`, \`states\`,
\`variants\`, \`slots\`), and the result is identical. The single \`upsertDefinition\` still exists for a one-off class,
and \`patchDefinition\` still changes only some CSS of one class.
- CSS properties in **kebab-case** (\`background-color\`, \`font-size\`, \`border-radius\`), values as plain strings.
- Attach to an element via \`style: { "base": ["card"] }\`. Stack classes: \`"base": ["card", "shadow"]\`.
- One \`ref\` can name both an element and its class (as above) — they live in different namespaces.
- Lay containers out with flexbox or grid — pick the direction on purpose, see **Fit the panel** below.
- **You are not styling from zero.** Each type lands on the page with CSS you did not write, and it is the usual
  reason a widget does not look like the definitions say:
  - The per-type CSS the SDK ships imposes **no minimum size**: a rail, a divider, a dot or a narrow cell is
    exactly as small as you make it, and no \`"min-width": "0"\` escape hatch is needed. The flip side is that an
    element with no content and no size takes no space at all — give a spacer its own \`height\`. (The 50px box
    empty containers show on the builder canvas is a drop target, scoped to it; it never reaches a widget.)
  - The BROWSER's own defaults for the rest: \`heading\` keeps its UA font-size and ~0.67em top/bottom margins,
    \`paragraph\` ~1em margins, \`list\` a 40px \`padding-left\`, \`button\` its native chrome, \`image\` its intrinsic
    size, \`link\` its own colour and underline. In a compact widget set these explicitly — usually
    \`"margin-top": "0"\`, \`"margin-bottom": "0"\` — and space things with the parent's \`gap\` instead.
  - Borders start at \`0 solid\`, so \`border-color\` alone paints nothing: give \`border-width\` (and the colour).
  - The \`defaultStyle\` a type reports in the EDITING catalog (\`plitzi://types\`) is authoring metadata for the
    builder — it does not paint here, so do not count on it in a widget.
- **Mind the intrinsic display.** Some types start non-block: \`text\` is \`display: inline\`, so to stack or size it,
  wrap it in a \`container\` (or set \`display: block\`). \`heading\` and \`paragraph\` are already block.
- **Shorthands are welcome** and cheaper to write: \`padding: 8px 16px\`, \`border: 1px solid #ddd\`,
  \`font: bold 16px/1.5 Arial\`, \`flex: 1 1 auto\`, \`transition: opacity 200ms ease\`. They are stored expanded to
  their longhands, so a breakpoint, state or variant can override each property on its own — and a read-back shows
  the longhands, not what you wrote. An unknown property errors with the correct kebab-case key suggested.
- **Responsive:** add \`tablet\` and/or \`mobile\` blocks next to \`desktop\` (same shape); they override desktop on
  smaller screens — \`{ "desktop": { "font-size": "36px" }, "mobile": { "font-size": "24px" } }\`.
- **Interactive states:** nest under \`states\` keyed by pseudo-class, each with its own breakpoint block —
  \`{ "desktop": { "background-color": "#3b82f6" }, "states": { "hover": { "desktop": { "background-color": "#2563eb" } } } }\`
  (\`hover\`, \`active\`, \`focus\`).

## Fit the panel — go wide, stay short

The widget renders in a **side panel** (Claude Desktop, ChatGPT, the Plitzi builder), so it gets a usable width but
very little height: everything past the first screenful costs the user a scroll. Height is the scarce resource —
spend width instead.

Plain containers are blocks, so doing nothing stacks children **vertically** and produces exactly the tall,
half-empty widget to avoid. Choose the axis every time:

- **Peers side by side** — metrics, plans, options, a comparison, an image next to its text: a row, wrapping when
  it runs out of width, children sharing it (no fixed widths).
  \`\`\`json
  { "type": "upsertDefinitions", "definitions": {
      "row": { "desktop": { "display": "flex", "flex-direction": "row", "flex-wrap": "wrap", "gap": "12px", "align-items": "stretch" } },
      "col": { "desktop": { "flex-grow": "1", "flex-basis": "0%", "min-width": "150px" } }
  } }
  \`\`\`
  \`flex-grow: 1\` + \`flex-basis: 0%\` splits the row evenly; \`min-width\` is the wrap threshold — under it the item
  drops to the next line by itself, so a narrow panel degrades gracefully with no breakpoints.
- **Many uniform items** — cards, tiles, a gallery: one grid line does it all.
  \`\`\`json
  { "type": "upsertDefinitions", "definitions": { "grid": { "desktop": { "display": "grid", "grid-template-columns": "repeat(auto-fit, minmax(160px, 1fr))", "gap": "12px" } } } }
  \`\`\`
- **Label + value pairs** stay on one line (\`display: flex\`, \`justify-content: space-between\`) instead of two.
- **Vertical is right** for reading order: a heading over its paragraph, a form, a step list, long prose.
- Force a stack on tiny screens with the \`mobile\` block: \`"mobile": { "flex-direction": "column" }\`.

Keep it compact, and the numbers low: \`padding\` 12–16px (24+ only on a single hero card), \`gap\` 8–12px,
\`font-size\` 13–15px for body and 16–20px for headings. Let the outer container **fill** the panel — no \`width\` on
it — and reach for \`max-width\` only to stop one lone card from stretching across the whole panel.

## Match the host theme — never hardcode a light palette

The widget is embedded in the host's own UI (Claude Desktop, ChatGPT, the builder), and that UI **may be in dark
mode**. A widget painted with fixed light colours is the most common way to ship something unusable: a white card
in a dark chat glares, and — worse — text left at a dark default disappears against the host's dark background.

The host publishes its palette as CSS variables on the page, so use them for every colour, with a
\`light-dark(<light>, <dark>)\` fallback for hosts that send none:

\`\`\`json
{ "type": "upsertDefinitions", "definitions": { "card": { "desktop": {
    "background-color": "var(--color-background-secondary, light-dark(#ffffff, #1f2430))",
    "color": "var(--color-text-primary, light-dark(#0f172a, #e8eaed))",
    "border-width": "1px", "border-style": "solid",
    "border-color": "var(--color-border-primary, light-dark(#e2e8f0, #333a48))"
} } } }
\`\`\`

- Surfaces: \`--color-background-primary\` (the page), \`--color-background-secondary\` / \`--color-background-tertiary\`
  (cards, raised areas). Text: \`--color-text-primary\`, \`--color-text-secondary\`, \`--color-text-tertiary\` (muted).
  Borders: \`--color-border-primary\` / \`--color-border-secondary\`. Status pairs: \`--color-background-danger\` |
  \`success\` | \`warning\` | \`info\` with the matching \`--color-text-…\`. Also \`--font-sans\`, \`--border-radius-md\` /
  \`lg\` / \`full\`, \`--shadow-sm\` / \`md\`.
- **Set \`color\` wherever you set \`background-color\`** — the pair is what stays legible, either one alone is a
  gamble. Same rule for a brand accent: a CTA on your own blue must state its own text colour (\`#ffffff\`).
- Prefer a border to a drop shadow for separation: shadows all but vanish on a dark surface.

## Element types (type → what to set)

| type | renders | set |
|---|---|---|
| \`container\` | layout box (a div) | nothing — style it with flex/grid |
| \`heading\` | h1–h6 title | \`props.content\`, element \`subType\`: "h1"…"h6" |
| \`paragraph\` | body text block (\`<p>\`) | \`props.content\` |
| \`text\` | inline text | \`props.content\` |
| \`button\` | clickable button | \`props.content\` |
| \`link\` | anchor | \`props.content\` (label), \`props.href\`, \`props.target\`: "self" \\| "blank" |
| \`image\` | \`<img>\` | \`props.src\`, \`props.alt\` |
| \`video\` | embedded video | \`props.src\` |
| \`list\` / \`listItem\` | \`<ul>\` / \`<li>\` | nesting only |
| \`markdown\` | rendered markdown | \`props.content\` |
| \`blockHtml\` | a raw HTML string, as written | \`props.content\` — how you draw an inline \`<svg>\`, see below |

\`subType\` is an element-level field (not a prop). Guessing is safe: an unknown prop for a type comes back as a
**warning naming the right one**, not an error. This table covers the everyday types; the resource
**plitzi://render/types** lists every built-in type you can use (with descriptions) — read it when you need one
that is not here (lists, tabs, dialogs, forms, icons…).

\`image\`/\`video\` \`src\` accepts any \`https\` URL, or a \`data:\`/\`blob:\` URI for a fully self-contained graphic (a
base64 raster) — both render with no extra setup. For a **vector** graphic do not encode a \`data:\` URI: draw it
inline, as below.

## Draw with inline SVG

A widget can draw its own graphics, and it is often the difference between a plain block of text and something
worth showing: a brand mark, a sparkline or donut, a badge, an empty-state glyph, a wave or blob behind a header,
an arrow between two steps. Put the SVG **inline** in a \`blockHtml\` element — its \`props.content\` is rendered as
written, so the markup needs no escaping, and the element is styled and laid out like any other box.

\`\`\`json
{
  "operations": [
    { "type": "upsertDefinitions", "definitions": {
        "mark": { "desktop": { "display": "flex", "width": "32px", "height": "32px", "color": "var(--color-text-primary, light-dark(#0f172a, #e8eaed))" } }
    } },
    { "type": "upsertElement", "pageRef": "render", "element": {
        "ref": "trend", "type": "blockHtml", "style": { "base": ["mark"] },
        "props": { "content": "<svg viewBox='0 0 24 24' width='100%' height='100%' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'><path d='M3 17l6-6 4 4 8-8'/><path d='M21 7v6h-6'/></svg>" }
    } }
  ]
}
\`\`\`
- **Size from the class, not the drawing**: keep a \`viewBox\` and set \`width\`/\`height\` to \`100%\`, then the
  \`blockHtml\`'s own \`width\`/\`height\` decide how big it renders — one drawing, any size.
- **Colour with \`currentColor\`** (\`fill\` and/or \`stroke\`) and set \`color\` on the class from a host variable. A hex
  buried inside the path is the same mistake as a hardcoded light palette: it cannot follow the theme.
- **Single quotes inside the markup** keep the JSON free of \`\\"\` escapes, as above.
- **Markup only.** \`<script>\`, \`javascript:\` URLs and inline \`on*\` handlers are rejected with an error — a widget
  runs inside the host's UI. Animate with CSS (a \`states\` block, a \`transition\`) and wire behaviour with
  interaction flows.

**The budget.** Every path is text you write, so an SVG earns its place only while it stays small: a handful of
paths, a few hundred characters, drawn ONCE and reused (same class, same content, or a \`repeatElement\` row) rather
than redrawn per card. Skip it entirely when something cheaper does the job — a \`fontAwesome\` icon, an emoji in a
\`text\`, an \`https\` image the user gave you, a CSS gradient or a \`border-radius\` shape. And a full illustration or
a photo-real scene (a castle, a skyline, a detailed mascot) is still the wrong trade: it costs more than the entire
rest of the widget and renders worse than the image it is imitating.

## Keep the call small

Everything in \`operations\` is text you write, and a widget that takes two calls because the first ran long is a
widget the user waits twice for. Two habits pay for themselves:

- **Keep a drawing to a drawing.** Inline SVG is allowed and often worth it (see above), but a graphic that runs
  longer than the widget around it has stopped paying for itself: a handful of paths, drawn once and reused rather
  than redrawn per card, and an \`https\` image, a flat colour or a two-stop \`linear-gradient\` for anything bigger.
- **One class per look, not per property.** Classes like \`tone-blue\` + \`tone-blue-text\` + \`tone-blue-bg\` for the
  same card triple the declarations and the attachments. Put everything the look needs in one class, add a second
  only for the part that genuinely varies between siblings (a colour), and reuse it — the whole point of a class.

## Full worked example — two plans side by side

The cards sit in a wrapping row and split it evenly, so the widget uses the panel's width and stays short; on a
narrow panel \`min-width\` drops the second card under the first on its own.

\`\`\`json
{
  "operations": [
    { "type": "upsertDefinitions", "definitions": {
        "plans": { "desktop": { "display": "flex", "flex-direction": "row", "flex-wrap": "wrap", "gap": "12px", "align-items": "stretch" } },
        "card": { "desktop": { "display": "flex", "flex-direction": "column", "gap": "6px", "flex-grow": "1", "flex-basis": "0%", "min-width": "150px", "padding": "16px", "background-color": "var(--color-background-secondary, light-dark(#ffffff, #1f2430))", "color": "var(--color-text-primary, light-dark(#0f172a, #e8eaed))", "border-width": "1px", "border-style": "solid", "border-color": "var(--color-border-primary, light-dark(#e2e8f0, #333a48))", "border-radius": "var(--border-radius-lg, 12px)", "text-align": "center" } },
        "price": { "desktop": { "font-size": "28px", "font-weight": "800", "color": "#3b82f6" } },
        "cta": { "desktop": { "background-color": "#3b82f6", "color": "#ffffff", "padding": "10px 16px", "border-radius": "8px", "font-weight": "600" }, "states": { "hover": { "desktop": { "background-color": "#2563eb" } } } }
    } },
    { "type": "upsertElement", "pageRef": "render", "element": {
        "ref": "plans", "type": "container", "style": { "base": ["plans"] },
        "children": [
          { "ref": "free", "type": "container", "style": { "base": ["card"] }, "children": [
            { "ref": "free-plan",   "type": "heading", "subType": "h3", "props": { "content": "Starter" } },
            { "ref": "free-amount", "type": "text",    "props": { "content": "$0" }, "style": { "base": ["price"] } },
            { "ref": "free-buy",    "type": "button",  "props": { "content": "Start free" }, "style": { "base": ["cta"] } }
          ] },
          { "ref": "pro", "type": "container", "style": { "base": ["card"] }, "children": [
            { "ref": "pro-plan",   "type": "heading", "subType": "h3", "props": { "content": "Pro" } },
            { "ref": "pro-amount", "type": "text",    "props": { "content": "$29/mo" }, "style": { "base": ["price"] } },
            { "ref": "pro-buy",    "type": "button",  "props": { "content": "Start free trial" }, "style": { "base": ["cta"] } }
          ] }
        ]
    } }
  ]
}
\`\`\`

## Data & interactivity (optional)

The widget runs the live SDK, so beyond static layout it can fetch data and respond to events. Both are wired by
\`ref\`, just like styling. (Full reference: **plitzi://guide** — sections Data bindings and Interactions.)

### Fetch data — a provider + a binding
An \`apiContainer\` fetches at runtime and exposes the result as the source **\`apiContainer_<idRef>.data\`**, visible
to its **DESCENDANTS only** — the bound element must live inside the container's subtree. \`upsertBinding\` then
connects that source to a descendant's field.

\`\`\`json
{
  "operations": [
    { "type": "upsertElement", "pageRef": "render", "element": {
        "ref": "products", "type": "apiContainer", "props": { "query": "<your data query — see plitzi://guide>" },
        "children": [ { "ref": "title", "type": "heading", "subType": "h3", "props": { "content": "…" } } ]
    } },
    { "type": "upsertBinding", "pageRef": "render", "ref": "title", "category": "attributes", "binding": { "to": "content", "source": "apiContainer_products.data.0.name" } }
  ]
}
\`\`\`
- \`category\`: \`"attributes"\` (a prop such as \`content\`/\`src\`), \`"style"\` (a CSS value) or \`"initialState"\`.
- \`binding.to\` is the target field; \`binding.source\` is the \`<type>_<idRef>.path\` into the provider's data.
- \`mockData\` on the provider is builder-only — set a real \`query\` for the widget to actually fetch.

### React to events — an interaction flow
\`upsertInteractionFlow\` attaches an ordered \`nodes\` list to an element; the FIRST node is a \`trigger\` (e.g.
\`onClick\`), the rest run after it. Each following step is one of:
- **\`globalCallback\`** (OMIT \`elementId\`) — a built-in app action: \`addNotification\` (\`params.content\`),
  \`navigate\`, \`setState\` (\`key\`/\`type\`/\`value\`), \`authLogin\`/\`authLogout\`…
- **\`callback\`** (\`elementId\` = an element, defaults to the trigger's) — that ELEMENT's OWN callback: e.g. an
  \`apiContainer\` re-fetches, a \`form\` submits. Each type's own callback action names are in plitzi://guide.

\`\`\`json
{ "type": "upsertInteractionFlow", "pageRef": "render", "ref": "buy", "nodes": [
    { "title": "On click", "nodeType": "trigger", "action": "onClick" },
    { "title": "Toast", "nodeType": "globalCallback", "action": "addNotification", "params": { "content": "Added to cart" } }
] }
\`\`\`

## When it fails
The tool returns \`rendered: false\` with \`errors: [{ path, message, hint }]\`. Read the hint, fix that one op, and
retry — you never lose the rest of the batch.
`;

/** The same two documents through the READ path (the router, hence plitzi_read), not only as MCP resources: an
 *  agent that reaches for the batch-read tool — the reflex the guide itself teaches — must not be told its own
 *  authoring guide does not exist. Space-independent, like the core singletons. */
export const readRenderResource = (uri: string): ResourceEnvelope<unknown> | undefined => {
  if (uri === RENDER_GUIDE_URI) {
    return envelope(renderGuideText);
  }

  if (uri === RENDER_TYPES_URI) {
    return envelope(renderTypes());
  }

  return undefined;
};

// Register the render support resources as public (no space, no auth) so a conversational agent holding only
// plitzi_render can read them before authoring: the authoring guide and the catalog of usable element types.
export const registerRenderResources = (server: McpServer, log: McpLog): void => {
  server.registerResource(
    'Render guide',
    RENDER_GUIDE_URI,
    {
      description: 'How to author a plitzi_render widget: operations, element types, styling, examples.',
      mimeType: 'text/markdown'
    },
    () => {
      const start = performance.now();
      const contents = { contents: [{ uri: RENDER_GUIDE_URI, mimeType: 'text/markdown', text: renderGuideText }] };
      log.resourceRead(RENDER_GUIDE_URI, performance.now() - start);

      return contents;
    }
  );

  server.registerResource(
    'Render element types',
    RENDER_TYPES_URI,
    {
      description: 'Built-in element types a plitzi_render widget can use, with descriptions.',
      mimeType: 'application/json'
    },
    () => {
      const start = performance.now();
      const contents = jsonContents(RENDER_TYPES_URI, envelope(renderTypes()));
      log.resourceRead(RENDER_TYPES_URI, performance.now() - start);

      return contents;
    }
  );
};
