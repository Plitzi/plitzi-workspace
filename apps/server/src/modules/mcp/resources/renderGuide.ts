import { envelope, jsonContents } from './envelope';
import { BUILTIN_COMPONENTS } from '../catalogs';

import type { McpLog } from '../helpers';
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

  return { note: renderTypesNote, types };
};

const renderGuideText = `# plitzi_render — authoring guide

\`plitzi_render\` shows the user a live UI widget. You build it as a list of \`operations\` (applied IN ORDER) that
assemble an element tree under one pre-seeded root page whose ref is **"render"**. It renders fully offline — no
space, no backend, no account. Same operation vocabulary as the editing tool plitzi_apply, aimed at one page.

Most widgets are **presentation only** — the structure + styling below is all you need, so start there. The widget
runs the live Plitzi SDK though, so it can also **fetch data** (an \`apiContainer\`) and **react to events**
(interaction flows); see "Data & interactivity" at the end when a widget needs them.

Each call renders a **fresh** widget with no memory of previous calls — always send **every** operation the widget
needs in the one call. To change a widget, re-send the whole thing.

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

## Style with reusable classes — upsertDefinition

Styling is separate from structure: declare a class, then attach it by ref.

\`\`\`json
{ "type": "upsertDefinition", "ref": "card", "desktop": { "display": "flex", "flex-direction": "column", "gap": "8px", "padding": "24px", "border-radius": "12px" } }
\`\`\`
- CSS properties in **kebab-case** (\`background-color\`, \`font-size\`, \`border-radius\`), values as plain strings.
- Attach to an element via \`style: { "base": ["card"] }\`. Stack classes: \`"base": ["card", "shadow"]\`.
- One \`ref\` can name both an element and its class (as above) — they live in different namespaces.
- Lay containers out with flexbox or grid — pick the direction on purpose, see **Fit the panel** below.
- **You are not styling from zero.** Each type lands on the page with CSS you did not write, and it is the usual
  reason a widget does not look like the definitions say. The SDK stylesheet resets almost nothing (\`box-sizing\`,
  \`border: 0 solid\`, \`body\` margin), so anything you leave unset comes from one of two places:
  - The per-type rule the SDK ships — the one that changes layouts is \`container\`, which carries
    \`min-width: 50px; min-height: 50px\`. A rail, a divider, a dot, a spacer or a narrow cell will NOT go below
    50px until you say \`"min-width": "0"\` (and/or \`"min-height": "0"\`) on it: a 2px timeline line renders 50px
    wide otherwise. Any flex child that must be allowed to shrink needs it too.
  - The BROWSER's own defaults for the rest: \`heading\` keeps its UA font-size and ~0.67em top/bottom margins,
    \`paragraph\` ~1em margins, \`list\` a 40px \`padding-left\`, \`button\` its native chrome, \`image\` its intrinsic
    size, \`link\` its own colour and underline. In a compact widget set these explicitly — usually
    \`"margin-top": "0"\`, \`"margin-bottom": "0"\` — and space things with the parent's \`gap\` instead.
  - Borders start at \`0 solid\`, so \`border-color\` alone paints nothing: give \`border-width\` (and the colour).
  - The \`defaultStyle\` a type reports in the EDITING catalog (\`plitzi://types\`) is authoring metadata for the
    builder — it does not paint here, so do not count on it in a widget.
- **Mind the intrinsic display.** Some types start non-block: \`text\` is \`display: inline\`, so to stack or size it,
  wrap it in a \`container\` (or set \`display: block\`). \`heading\` and \`paragraph\` are already block.
- **Use atomic longhands.** \`padding\`, \`margin\`, \`border\`, \`border-radius\` are fine (they expand cleanly), but
  \`flex\`, \`background\` and \`font\` are rejected — write \`display\`+\`flex-direction\`, \`background-color\`,
  \`font-size\`+\`font-weight\` instead. An unknown property errors with the correct kebab-case key suggested.
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
  { "type": "upsertDefinition", "ref": "row", "desktop": { "display": "flex", "flex-direction": "row", "flex-wrap": "wrap", "gap": "12px", "align-items": "stretch" } }
  { "type": "upsertDefinition", "ref": "col", "desktop": { "flex-grow": "1", "flex-basis": "0%", "min-width": "150px" } }
  \`\`\`
  \`flex-grow: 1\` + \`flex-basis: 0%\` splits the row evenly; \`min-width\` is the wrap threshold — under it the item
  drops to the next line by itself, so a narrow panel degrades gracefully with no breakpoints.
- **Many uniform items** — cards, tiles, a gallery: one grid line does it all.
  \`\`\`json
  { "type": "upsertDefinition", "ref": "grid", "desktop": { "display": "grid", "grid-template-columns": "repeat(auto-fit, minmax(160px, 1fr))", "gap": "12px" } }
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
{ "type": "upsertDefinition", "ref": "card", "desktop": {
    "background-color": "var(--color-background-secondary, light-dark(#ffffff, #1f2430))",
    "color": "var(--color-text-primary, light-dark(#0f172a, #e8eaed))",
    "border-width": "1px", "border-style": "solid",
    "border-color": "var(--color-border-primary, light-dark(#e2e8f0, #333a48))"
} }
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

\`subType\` is an element-level field (not a prop). Guessing is safe: an unknown prop for a type comes back as a
**warning naming the right one**, not an error. This table covers the everyday types; the resource
**plitzi://render/types** lists every built-in type you can use (with descriptions) — read it when you need one
that is not here (lists, tabs, dialogs, forms, icons…).

\`image\`/\`video\` \`src\` accepts any \`https\` URL, or a \`data:\`/\`blob:\` URI for a fully self-contained graphic
(e.g. an inline SVG icon or a base64 image) — both render with no extra setup.

## Full worked example — two plans side by side

The cards sit in a wrapping row and split it evenly, so the widget uses the panel's width and stays short; on a
narrow panel \`min-width\` drops the second card under the first on its own.

\`\`\`json
{
  "operations": [
    { "type": "upsertDefinition", "ref": "plans", "desktop": { "display": "flex", "flex-direction": "row", "flex-wrap": "wrap", "gap": "12px", "align-items": "stretch" } },
    { "type": "upsertDefinition", "ref": "card", "desktop": { "display": "flex", "flex-direction": "column", "gap": "6px", "flex-grow": "1", "flex-basis": "0%", "min-width": "150px", "padding": "16px", "background-color": "var(--color-background-secondary, light-dark(#ffffff, #1f2430))", "color": "var(--color-text-primary, light-dark(#0f172a, #e8eaed))", "border-width": "1px", "border-style": "solid", "border-color": "var(--color-border-primary, light-dark(#e2e8f0, #333a48))", "border-radius": "var(--border-radius-lg, 12px)", "text-align": "center" } },
    { "type": "upsertDefinition", "ref": "price", "desktop": { "font-size": "28px", "font-weight": "800", "color": "#3b82f6" } },
    { "type": "upsertDefinition", "ref": "cta", "desktop": { "background-color": "#3b82f6", "color": "#ffffff", "padding": "10px 16px", "border-radius": "8px", "font-weight": "600" }, "states": { "hover": { "desktop": { "background-color": "#2563eb" } } } },
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
