import { envelope, jsonContents } from './envelope';
import { BUILTIN_COMPONENTS } from '../catalogs';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

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
- Lay containers out with flexbox: \`{ "display": "flex", "flex-direction": "column", "gap": "12px" }\`.
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

## Full worked example — a pricing card

\`\`\`json
{
  "operations": [
    { "type": "upsertDefinition", "ref": "card", "desktop": { "display": "flex", "flex-direction": "column", "gap": "8px", "padding": "24px", "background-color": "#ffffff", "border-radius": "12px", "width": "260px", "text-align": "center", "box-shadow": "0 4px 20px rgba(0,0,0,0.08)" } },
    { "type": "upsertDefinition", "ref": "price", "desktop": { "font-size": "36px", "font-weight": "800", "color": "#3b82f6" } },
    { "type": "upsertDefinition", "ref": "cta", "desktop": { "background-color": "#3b82f6", "color": "#ffffff", "padding": "12px 20px", "border-radius": "8px", "font-weight": "600" }, "states": { "hover": { "desktop": { "background-color": "#2563eb" } } } },
    { "type": "upsertElement", "pageRef": "render", "element": {
        "ref": "card", "type": "container", "style": { "base": ["card"] },
        "children": [
          { "ref": "plan",   "type": "heading",   "subType": "h3", "props": { "content": "Pro" } },
          { "ref": "amount", "type": "text",      "props": { "content": "$29/mo" }, "style": { "base": ["price"] } },
          { "ref": "feat",   "type": "paragraph", "props": { "content": "Unlimited projects" } },
          { "ref": "buy",    "type": "button",    "props": { "content": "Start free trial" }, "style": { "base": ["cta"] } }
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
export const registerRenderResources = (server: McpServer): void => {
  server.registerResource(
    'Render guide',
    RENDER_GUIDE_URI,
    {
      description: 'How to author a plitzi_render widget: operations, element types, styling, examples.',
      mimeType: 'text/markdown'
    },
    () => ({ contents: [{ uri: RENDER_GUIDE_URI, mimeType: 'text/markdown', text: renderGuideText }] })
  );

  server.registerResource(
    'Render element types',
    RENDER_TYPES_URI,
    {
      description: 'Built-in element types a plitzi_render widget can use, with descriptions.',
      mimeType: 'application/json'
    },
    () => jsonContents(RENDER_TYPES_URI, envelope(renderTypes()))
  );
};
