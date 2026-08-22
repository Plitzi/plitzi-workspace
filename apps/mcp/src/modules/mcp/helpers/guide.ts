// Shown in the MCP initialize result — the first thing an agent sees. Keep it short; the full reference is
// plitzi://guide.
export const serverInstructions =
  'Plitzi AI server: read-then-write editing of a Plitzi space. Reads follow a filesystem model — list cheap, ' +
  'read one item in detail on demand; never fetch a whole tree you do not need. Workflow: (1) read ' +
  'plitzi://primer/{env} once — it bundles the guide, types, css-properties and page/definition/variable ' +
  'summaries in a single call; (2) plitzi_search with include:"detail" to jump to elements — each hit then carries ' +
  'its uri, stateVersion AND full style/resolvedStyle, so an edit needs no per-element read; open a page skeleton ' +
  'or element only when you need its tree/detail (the skeleton already lists the style classes of each node, and ' +
  'plitzi_read fetches many uris at once); (3) plitzi_apply with dryRun to preview a batch; (4) plitzi_apply to ' +
  'persist, passing ' +
  'expectedResourceVersions to guard against concurrent edits — apply and search both hand back the versions ' +
  'you need for the next edit. Use patchElement / patchDefinition to change only some props / CSS (the upsert ' +
  'variants replace them all). An element read (and search include:"detail") inlines the CSS of the definitions ' +
  'it attaches under resolvedStyle, so you rarely need a separate definition read. ' +
  'Refs accept a semantic idRef ([A-Za-z0-9_-] starting with a letter, unique, chosen by you) or the raw id — the ' +
  'idRef is ALSO the ' +
  'runtime wiring key, so a provider source is `<type>_<idRef>.<field>`, visible to the provider’s DESCENDANTS only ' +
  '(bind inside its subtree). CSS is plain kebab-case — write shorthands freely (`border: 1px solid red`, ' +
  '`padding: 8px 16px`, `font: bold 16px/1.5 Arial`), they are expanded to longhands for you and STORED that way, ' +
  'so read-back shows the longhands; style vars are var(--name), schema vars are {{name}}. ' +
  'READERS — do not confuse them: MCP *resources* are the browsable catalog (list them, or open one by URI); ' +
  'plitzi_search FINDS refs by label/type/attribute; plitzi_read BATCH-fetches URIs you already hold. Reach for ' +
  'search/read to work; browse resources to discover. ' +
  'CMS / API integrations (Strapi, WordPress, Contentful, any REST service) go through a CONNECTOR: a manifest ' +
  'you author declaring the base URL, endpoints and auth template, which the SERVER executes — read ' +
  'plitzi://connector-presets for working ones and plitzi://connectors/{env} for this space’s. You never see or ' +
  'create the credential; the space owner attaches it, and the connector saves without one. An apiContainer reads ' +
  'through it only with runtime:"server". ' +
  'Elements also carry applied style variants + visibility (initialState), data bindings and interaction flows: ' +
  'edit them with patchElement (initialState), upsertBinding/patchBinding/deleteBinding, and ' +
  'upsertInteractionFlow/patchInteractionNode/deleteInteraction. An element read shows all three plus ' +
  'availableVariants (which variant each of its classes offers). ' +
  'Separately, to SHOW the user a small self-contained widget (offline, no space or backend) instead of editing ' +
  'the space — a card, hero, pricing table, a visual answer — use plitzi_render; read plitzi://render/guide for it.';

// The same first thing an agent sees, on a connection that carries NO space (a guest connection, or a
// widgets-only grant). The editing instructions above would describe a server this connection cannot reach, so it
// is told what it actually holds — one offline tool and its docs — and how the user gets the rest. Kept in the
// handshake, not left for a failed call to explain, so the agent never spends a turn discovering it.
export const widgetsOnlyInstructions =
  'Plitzi widget server (widgets-only connection). This connection carries NO Plitzi space: nothing can be read ' +
  'or edited in one, and the space tools are not offered here — do not look for them. What it does do is build ' +
  'self-contained UI widgets fully offline, with no backend, account or setup: call plitzi_render to SHOW the ' +
  'user a real rendered layout (card, hero, pricing table, checklist, form, gallery) instead of describing one. ' +
  'Read plitzi://render/guide first — the element/prop table, the style model and a worked example; ' +
  'plitzi://render/types lists every element type you can author (plitzi_read fetches both). To change a widget ' +
  'you already rendered, call plitzi_render again with patch:true and its renderId. ' +
  'If the user wants to edit their real Plitzi space from here, that is a reconnection they make: the ' +
  'integration must be re-authorized and granted a space (the consent screen lists theirs) — you cannot do it ' +
  'from this connection, and no retry will change it.';

// The condensed guide the PRIMER carries — the essentials and the highest-frequency gotchas, kept short so the
// cold-start bundle stays cheap. The full reference (every resource, op shape, and worked example) is guideText,
// served on demand at plitzi://guide; this quickstart links there for anything it does not cover.
export const guideQuickstart = `# Plitzi AI MCP — quickstart
This is the condensed guide; read \`plitzi://guide\` for the full reference (every resource, op and example).

A space is **two schemas you edit together in one atomic \`plitzi_apply\` batch**: the **element schema** (tree of
pages/elements) and the **style schema** (definitions = CSS classes, tokens, theme). To style an element: write a
**definition** and attach it via the element's \`style.base\` in the same batch.

**Workflow:** (1) you already have this primer (guide + types + css + page/style summaries). (2) \`plitzi_search\`
with \`include:"detail"\` to find elements — each hit carries its \`uri\`, \`stateVersion\` and full style, so no
per-element read. (3) \`plitzi_apply\` with \`dryRun:true\` to preview. (4) \`plitzi_apply\` to persist, passing
\`expectedResourceVersions\` (uri → the stateVersion you read) for every resource you change — omitting it lets a
concurrent edit be lost. Use \`patchElement\`/\`patchDefinition\` to change only some props/CSS (upsert replaces all).

**Refs & wiring:** a ref is the semantic \`idRef\` (letters, numbers, hyphens and underscores, **starting with a
letter — no dots**) or the raw id. The idRef is the runtime wiring key: a provider's source is \`<type>_<idRef>\`, and
interactions target by it. A dot would split that path; an **underscore is fine** — the first \`_\` separates the type
from the idRef (element types have none), so \`list_food_item\` reads unambiguously as type \`list\`, idRef \`food_item\`.

**Styling:** CSS keys are **kebab-case** (\`background-color\`); \`var(--token)\` for style vars, \`{{name}}\` for schema
vars. **Write plain CSS** — shorthands (\`border\`, \`padding\`, \`margin\`, \`gap\`, \`overflow\`, \`flex\`, \`background\`,
\`font\`, \`transition\`, \`animation\`, \`grid\`, \`grid-row\`/\`grid-column\`, \`place-*\`, \`outline\`, \`columns\`,
\`list-style\`, \`text-decoration\`) are expanded to their longhands for you, so \`border: 1px solid red\` is stored as
\`border-top-color\`/\`border-top-width\`/\`border-top-style\`/… That is also how you read them back. Flex layout is
still \`display: flex\` + \`flex-direction\`/\`align-items\`/…, not a \`flex\` value. Mind a type's \`defaultStyle\`
(\`text\` is \`display: inline\`). Global styles (\`button {…}\`) and id styles (\`#id\`) have their own ops.

**Data bindings** (\`upsertBinding\`, category attributes|style|initialState): connect a \`source\` to a \`to\` field.
A source \`<type>_<idRef>\` is scoped to the provider's **DESCENDANTS only** — bind inside the provider's subtree
(module sources state/space/navigation/auth/collection are global). \`apiContainer.mockData\` is builder-only; set a
real \`query\` for production. \`transformers: [{action, params}]\` post-process the value — use exact action names
from \`plitzi://data-sources\`; \`twigTemplate\` formats it (the value is \`{{source}}\`, not \`{{value}}\`). \`when\` is
a QueryBuilder RuleGroup gating the binding.

**Interactions** (\`upsertInteractionFlow\`): a \`trigger\` node first, then callbacks/utilities **in order** (links
computed for you). Node types: \`callback\` (an element's own callback — \`elementId\` is that element), \`globalCallback\`
(a source module — omit \`elementId\`, the MCP sets it), \`utility\` (no element). Element \`setState\`
(category/key/value/revertOnFinish) ≠ global \`setState\` (source \`state\`, key/type/value). To turn a step off use
\`patchInteractionNode {enabled:false}\` — \`deleteInteraction\` removes it (destructive; confirm first). Any param
**value** can be a binding token \`{{ source }}\` (e.g. notification \`content: "{{ list_<idRef>.item.name }}"\`).

**CMS / API integrations** (\`upsertConnector\`): a **connector** is a manifest declaring a provider's base URL,
endpoints, auth template and filter operators, executed by the **server** — so integrating Strapi, WordPress,
Contentful or any REST API is configuration, not code. Read \`plitzi://connector-presets\` (working manifests + every
template token) and \`plitzi://connectors/{env}\` (this space's). **You never create or see credentials** — write the
manifest with \`{{credential.token}}\` and no \`connection.credential\`; it saves, and the space owner attaches the
secret in the builder. To consume one, an \`apiContainer\` needs **\`runtime: "server"\`** plus \`connector\`,
\`resource\`, optional \`endpoint\`/\`filters\`/\`limit\`/\`singleRecord\`/\`pagination\`; it then publishes
\`apiContainer_<idRef>.records\` (or \`.record\`) \`.pageInfo .isEmpty .hasError\` to its **descendants**. Full worked
flow — list page, detail page, paging, writes — in \`plitzi://guide\`.

**Pages & navigation:** \`upsertPage\` — always set a **relative** \`slug\` (no leading \`/\`; the runtime and folder
slugs prepend the path). A \`:name\` segment (\`"posts/:postId"\`) is a route param, readable as \`{{name}}\` and as the
source \`navigation.routeParams.name\` → build dynamic pages this way. To move between pages **prefer the \`Link\`
element** (a container: \`mode\` "page"/"internal"/"external") over a \`navigate\` interaction.

**Touched resources must be malformation-free.** Editing an element/definition also checks its CURRENT stored content
and BLOCKS the save on any \`Pre-existing malformation in <resource>\` error (a broken transformer, malformed node,
invalid CSS) — even parts you did not touch. These are NOT from your change (the message says so); fix them in the
SAME batch and re-apply (the check runs on the result, so the fix unblocks it). \`Pre-existing issue\` warnings advise
but do not block.

Read \`plitzi://guide\` before anything above is unclear.
`;

export const guideText = `# Plitzi AI MCP — usage guide

A Plitzi space is **two separate schemas** you edit together:
- **Element schema** — the tree of pages and elements (their type, label, props, and which style classes they use).
- **Style schema** — reusable **definitions** (CSS classes), design tokens (variables), theme.

They are stored and persisted independently, but a single \`plitzi_apply\` batch may touch **both atomically**.
To style a specific element you do two things in one batch: write a **definition** (style schema) and **attach**
it via the element's \`style.base\` (element schema). Example — "rename button X to PEPE and make it red":
\`\`\`json
{ "operations": [
  { "type": "upsertDefinition", "ref": "btn-x", "desktop": { "color": "red" } },
  { "type": "upsertElement", "pageRef": "home",
    "element": { "ref": "X", "type": "button", "label": "PEPE", "style": { "base": ["btn-x"] } } }
] }
\`\`\`

Reads are cheap by design — treat them like a filesystem: **list** to navigate, **read one item** for detail.
Never download a whole tree you do not need.

## Resources (read)
- \`plitzi://primer/{env}\` — **cold-start bundle**: guide + types + css-properties + page/definition/variable
  **summaries** in one read. Fetch this first instead of the individual resources below. Summaries only — open a
  page skeleton or element for its tree/detail.
- \`plitzi://guide\` — this guide.
- \`plitzi://types\` — element types **observed in this space** (ground truth): props, slots, subTypes, plus each
  type's \`label\`, \`description\` (what it is FOR) and \`category\`, and a \`source\` (\`builtin\` | \`plugin\` | \`unknown\`).
  Read the descriptions to pick the right type — e.g. \`apiContainer\` fetches backend data into the frontend,
  \`link\` navigates between pages, \`list\` repeats a template over a data array. \`plugin\` types are custom elements.
- \`plitzi://css-properties\` — valid kebab-case CSS property keys.
- \`plitzi://schema/{env}/pages\` — page **summaries** (ref, label, elementCount, folder). No element trees.
- \`plitzi://folders/{env}\` — page **folders** (the sidebar tree): ref, name, slug, parentId. \`/{ref}\` for one.
- \`plitzi://schema/{env}/pages/{ref}\` — one page as a **skeleton tree**: each node is \`ref/type/label\` **plus the
  style classes it attaches** (\`base\`, and \`slots\` for non-base slots) — names only, no CSS. So you can map every
  element to its class in a single page read, without opening each element just to learn which class it uses.
- \`plitzi://schema/{env}/pages/{ref}/styles\` — **every style the page uses in one read**: the class definitions its
  elements attach (deduplicated, **with full CSS**) plus the global styles affecting any element type on the page.
  Reach for this to recolor/restyle a whole page — it needs no shared class-name prefix and no per-element reads.
- \`plitzi://schema/{env}/elements/{ref}\` — one element in **full detail** (props, style, parentRef, childRefs).
  Its \`resolvedStyle\` inlines the **CSS of every definition** the element attaches (keyed by class ref), so you
  can see and edit its style without a separate definition read. Its \`globalStyles\` lists the **global element
  selectors** that also affect it (the CSS equivalent of \`button { … }\`, keyed by the type they target) — every
  element of that type inherits them. Edit a global only through the global-style tools (never per element). If the
  element carries a DOM \`id\` that an id rule matches, its \`idStyle\` (\`#id\`) is inlined too.
- \`plitzi://definitions/{env}\` — the **names** of every style definition.
- \`plitzi://definitions/{env}/{ref}\` — one definition's CSS.
- \`plitzi://global-styles/{env}\` — element **types** that have a site-wide global style. \`/{componentType}\` for one.
- \`plitzi://id-styles/{env}\` — DOM **ids** that have an id rule (\`#id\`) targeting a single element. \`/{targetId}\` for one.
- \`plitzi://style-variables/{env}\` — design tokens by category. \`/{category}\` for one.
- \`plitzi://schema-variables/{env}\` — space-level values referenced in props as \`{{name}}\`.
- \`plitzi://settings/{env}\` — space-level settings: the global \`customCss\` and the state/auth (user-provider) config.
- \`plitzi://interactions/{env}\` — interaction **actions** observed in this space (grouped by node type): the
  vocabulary for interaction flows.
- \`plitzi://data-sources/{env}\` — data-source **paths** and binding targets observed in this space: the
  vocabulary for data bindings.
- \`plitzi://connector-presets\` — working starting **manifests** (Strapi, WordPress, Directus, Contentful, plain
  REST) with the credential keys each provider needs, plus every **template token** the connector engine binds.
  Space-independent. Read it before writing a connector by hand.
- \`plitzi://connectors/{env}\` — the **connectors this space has**: for each, its read/write endpoint names, its
  filter operators and its published fields. \`/{ref}\` opens one manifest in full. See *Connectors* below.
- \`plitzi://actions/{env}\` — the **server actions this space has**: what starts each one, who may run it, and the
  input/output contract a caller is held to. \`/{ref}\` opens one flow in full. See *Server actions* below.

The style resources also answer under the \`plitzi://schema/{env}/…\` root as aliases — \`plitzi://schema/{env}/definitions/{ref}\`, \`plitzi://schema/{env}/style-variables/{category}\`, \`plitzi://schema/{env}/schema-variables\` — but prefer the ready-made \`uri\` from search / a write response over hand-building either form.

Data resources return \`{ stateVersion, data }\`. Keep \`stateVersion\` for optimistic concurrency.

**Reuse what you already know — don't re-scan an unchanged page.** A page read (\`plitzi://schema/{env}/pages/{ref}\`)
returns a \`stateVersion\` that is an **aggregate of the whole page**: it changes if and only if some element on the
page changed. Its skeleton \`tree\` also carries a \`stateVersion\` **per node**, identical to the one a direct element
read or search hit returns for that element. So when you come back to a page you already inspected:
1. Re-read just the page skeleton and compare its top-level \`stateVersion\` to the one you held. **Same → nothing
   changed since your read; skip re-reading and re-searching the tree** and act on what you already know.
2. If it differs, diff the per-node \`stateVersion\`s against the ones you cached and \`plitzi_read\` **only the nodes
   that changed** — never re-search or re-read the whole tree.

This is a **read-time** shortcut, not a safety guarantee. **Other agents/sub-agents may edit the same space
concurrently**, so a version you cached can go stale between your read and your write. Never skip the write-time
check below on the strength of a cached hash — the guarantee that no concurrent edit is lost comes only from
\`expectedResourceVersions\` on \`plitzi_apply\`, which re-validates against the live data at write time.

## Navigating (files analogy)
Pages and containers are folders; elements are files. **Prefer \`plitzi_search\` (especially with \`include: "detail"\`)
over reading elements one by one** — it jumps straight to elements by label/type/attribute and each hit already
carries the element's \`uri\`, \`stateVersion\`, \`pageUri\`, \`parentRef\` and tree \`path\`, so you can edit it (with
optimistic concurrency) **without a follow-up read**. \`include: "detail"\` additionally inlines each hit's props/style
**and** its \`resolvedStyle\` (the CSS behind its classes) — so a search-then-edit is the efficient path and a manual
element read is the exception. Search also matches **pages** by name/slug (returned under \`pages\`, each with its uri +
stateVersion) and returns any **style definitions** whose name matches the query, with full CSS, under \`definitions\`.
When you do hold several refs to open (e.g. from a skeleton), read them together with \`plitzi_read\` rather than one at a time.

## Tools (write)
- \`plitzi_validate\` — check a batch, returns teachable errors/warnings. Writes nothing. Also reports **pre-existing
  malformations** in any resource the batch touches (see below).
- \`plitzi_apply\` — validate → apply → persist atomically. Rejects the whole batch on any error or conflict. Pass
  \`dryRun: true\` to apply in memory only and get the same result back (changed versions + full element detail)
  without persisting — inspect it, then re-run without \`dryRun\` to commit.
- \`plitzi_search\` — find elements (and pages/definitions) across the space.
- \`plitzi_read\` — read many resource **uris in one batch** (pages, elements, definitions, variables). Pass the
  ready-made uris from search / a write response; each result is \`{ uri, stateVersion, data }\` or a teachable error,
  so one bad uri never fails the batch. Use it instead of N single reads whenever you already hold several refs.

## Readers: resources vs plitzi_search vs plitzi_read (do not confuse them)
Three ways to read, each for a different moment — pick by what you have in hand:
- **MCP resources** (the \`plitzi://…\` catalog above) — the **browsable index**. List them to discover what exists, or
  open one by URI when you are exploring. This is the passive catalog, not a tool.
- **\`plitzi_search\`** — you know *what* you want but not its **ref/uri** ("the hero button"). Search finds it by
  label/type/attribute and hands back the uri + stateVersion (and, with \`include:"detail"\`, the full element).
- **\`plitzi_read\`** — you **already hold one or more uris** (from search or a write response) and want their
  content in one batch. It is the tool form of opening resources, for when you have the addresses.
Rule of thumb: **discover → resources**, **find a ref → plitzi_search**, **fetch known uris → plitzi_read**. Never
hand-build a URI to guess your way to an element — search for it instead.

Write tools return what **changed** (\`{ uri, stateVersion }\`) plus counts, and the **full detail of every element
they created or updated** — each with its own \`uri\` and \`stateVersion\` (\`elements: [...]\`) so a follow-up edit of
the same element needs **no intermediate read**. Other resources (pages, definitions, variables) still report only
uri+stateVersion — re-read them if you need their new content. The operation shapes are in each tool's input
schema (discriminated by \`type\`).

## Addressing
Refs are the semantic \`idRef\` (e.g. \`"hero-cta"\`) or the element's **raw id** — both resolve. Creating an element
stores the \`ref\` you chose as its **idRef**.

The idRef is not just an alias — it is the **wiring key the runtime uses**. A provider registers its data source as
\`<type>_<idRef>\`, so a \`source\` you write against a ref resolves to that element at runtime with no id translation.
Rules for a **new** ref (both are enforced; a violation fails the batch):
- Charset \`[A-Za-z0-9_-]\`, **starting with a letter** (e.g. \`"products-api"\`, \`"food_item"\`). A \`.\` would split the
  \`<type>_<idRef>.<field>\` source path and the interaction target lookup, so **no dots**. An **underscore is
  allowed**: the FIRST \`_\` separates \`<type>\` from \`<idRef>\` and element types are camelCase with none, so
  underscores inside the idRef are unambiguous (\`list_food_item\` → type \`list\`, idRef \`food_item\`).
- **Unique across the space**; creating a ref that is taken is rejected (address the existing element instead).

**Where an element renders** is its \`runtime\`, settable on \`upsertElement\`/\`patchElement\`: \`"shared"\` (the
default, both sides), \`"client"\` (browser only) or \`"server"\` (SSR only). It matters for one thing above all — an
\`apiContainer\` reads through a **connector** only when it is \`"server"\` (see *Connectors*). An element read
reports it only when it is set.

An idRef is **optional** on an element — one built in the builder may not have it. The consequence is specific: an
element without an idRef **publishes no data source** and **holds no interactions**, because the runtime keys
everything by idRef and the raw id is never a fallback. You do not have to fix this by hand: writing an
interaction **mints an idRef for you** — the element that hosts the flow, and any element a node targets, is given
a free \`<type>-<n>\` ref if it lacks one, and the flow is wired to it. A node target you write may be a raw id; it
is normalised to that element's idRef. (To make an element a data-source **provider** to bind against, give it an
idRef explicitly with \`patchElement\`, or create it with the \`ref\` you want — a created element stores its ref as
its idRef.)

**Renaming** an idRef moves the wiring key: every binding source and interaction target across the space that
pointed at the old name is repointed with it, so the element stays wired. You do not have to rewrite them.

## Styling (crosses both schemas)
- **Mind the type's intrinsic default style.** A type renders with a base CSS *before* any class is attached — read
  it from \`defaultStyle\` on the type in \`plitzi://types\` (the primer includes it). Do not assume \`display: block\`:
  \`text\`, for one, defaults to \`display: inline\`, so margins/width/vertical padding behave differently. If you need
  block/flex layout on such an element, set \`display\` explicitly in your definition rather than relying on a default.
- **Images: preserve aspect ratio.** Setting only \`width\` and \`height\` (or forcing both) distorts an image. Change
  one dimension and let the other be \`auto\`, or set \`aspect-ratio\` with \`object-fit: cover\`/\`contain\`, so the
  image scales without stretching.
- **Font size and line height move together.** When you change \`font-size\`, set \`line-height\` in the same edit
  (prefer a unitless ratio like \`1.5\`, which tracks the font size). Changing one without the other leaves cramped or
  loosely-spaced text — they are a joint change, not two separate ones.
- A definition lives in the **style schema**; an element's \`style.base\` (element schema) is the link that applies
  it. Styling an element = upsertDefinitions + upsertElement with that ref in \`style.base\`, in one batch.
- **Repeating siblings**: when a set of siblings shares a shape and differs only in data (a list, cards, rows,
  steps), use \`repeatElement\` — the template once with \`{{item.field}}\` placeholders plus \`items\`, which
  creates the wrapper and numbers each row's refs (\`step-1\`, \`step-2\`…). A list inside each row is the same op:
  the wrapping node carries \`repeat: { items: "{{item.<list>}}", template: … }\` and its refs number both levels
  (\`blk-2-3\`). Copy-pasting the subtree N times costs N times the tokens and drifts.
- CSS keys are **kebab-case** (\`background-color\`). camelCase is rejected — read \`plitzi://css-properties\`.
- **Write normal CSS — shorthands are accepted and expanded for you.** \`border\`, \`border-{side}\`,
  \`border-width\`/\`-color\`/\`-style\`, \`border-radius\`, \`padding\`, \`margin\`, \`inset\`, \`gap\`, \`overflow\`,
  \`flex\`, \`flex-flow\`, \`background\`, \`font\`, \`transition\`, \`animation\`, \`grid\`, \`grid-template\`,
  \`grid-area\`, \`grid-row\`, \`grid-column\`, \`place-content\`, \`place-items\`, \`place-self\`, \`outline\`,
  \`columns\`, \`list-style\`, \`text-decoration\` — the full list is in \`plitzi://css-properties\` under
  \`shorthands\`. They **persist as longhand keys** (that is what a read gives back), so a breakpoint/state/variant
  can still override one property at a time.
  - \`border: 1px solid red\` → \`border-top-width: 1px\`, \`border-top-style: solid\`, \`border-top-color: red\`, …
    for all four sides. A shorthand also RESETS what it omits, so \`border: none\` clears a width a previous
    definition set.
  - Comma-separated layers are kept per longhand: \`transition: opacity 200ms, transform 300ms\` →
    \`transition-property: opacity, transform\` + \`transition-duration: 200ms, 300ms\`.
  - In a **patch**, a shorthand replaces the longhands it controls (\`padding: 8px\` overwrites a previous
    \`padding-left\`), and \`"border": null\` removes all twelve border longhands.
- **Flex layout is not a \`flex\` value**: set \`display: flex\` **plus** \`flex-direction\`, \`align-items\`,
  \`justify-content\` as separate properties.
- CSS is grouped by breakpoint: \`desktop\`, \`tablet\`, \`mobile\`.
- Reference a style variable in CSS as \`var(--name)\`; a schema variable in a prop as \`{{name}}\`.
- \`element.style.base\` is a **list** of definition refs; other slots go under \`element.style.slots\`.
- **An element can attach SEVERAL classes at once, and they all apply.** \`style.base\` holds a list, and each
  non-base slot holds its own — every attached definition contributes CSS, and they **cascade** (a later class, then a
  global/id rule, overrides an earlier one on the same property). So when a style looks wrong, the culprit may be
  ANY attached class, not the one you just edited: read the element's \`resolvedStyle\` (it inlines the CSS of every
  class it attaches, keyed by ref) together with its \`globalStyles\`/\`idStyle\` and the type's \`defaultStyle\`, and
  fix the class that actually sets the property — do not just pile another class on top.
- **Three kinds of style live in the style schema — do not confuse them:**
  - **Definitions** = reusable CSS **classes** (\`upsertDefinition\`/\`patchDefinition\`/\`deleteDefinition\`, keyed by a
    class \`ref\`). Attach one to an element via \`style.base\` to style **that** element (and anything else that opts in).
    This is the **default** way to style one element. Declaring MORE than one class in a batch? Use
    \`upsertDefinitions\` — one op carrying \`{ "<class>": { desktop: … }, … }\`, same result as the run of
    \`upsertDefinition\` it replaces, without repeating the envelope once per class.
  - **Global styles** = the CSS equivalent of a bare element selector like \`button { … }\`
    (\`upsertGlobalStyle\`/\`patchGlobalStyle\`/\`deleteGlobalStyle\`, keyed by \`componentType\`). They style **every**
    element of that type at once. Use these for site-wide intent — e.g. "all buttons rounded":
    \`{ "type": "upsertGlobalStyle", "componentType": "button", "desktop": { "border-radius": "9999px" } }\`.
  - **Id styles** = the CSS equivalent of an id selector like \`#hero { … }\`
    (\`upsertIdStyle\`/\`patchIdStyle\`/\`deleteIdStyle\`, keyed by \`targetId\`). They style the **single** element whose
    DOM \`id\` attribute equals \`targetId\` — so the element must carry that \`id\` (set it in its props). Prefer a
    **definition** for one element; reach for an id style only when a specific, uniquely-identified node must be
    targeted by id: \`{ "type": "upsertIdStyle", "targetId": "hero", "desktop": { "min-height": "100vh" } }\`.
  - The three share one name space, so an op refuses a name held by another kind (guards against a typo silently
    rewriting every element of a type, or converting a class into an id rule). If refused, you targeted the wrong
    kind — switch tools or rename.

## Style variants & element state
A **variant** is a named CSS override on a definition (e.g. a button class with a \`primary\` variant). It takes two
steps across the two schemas:
- **Declare** the variant CSS on the class (style schema): \`upsertDefinition\`/\`patchDefinition\` with
  \`variants: { "primary": { "desktop": { "background-color": "#111" } } }\` (per slot under \`slots.<slot>.variants\`).
- **Apply** it to an element (element schema): \`initialState.styleVariant\` =
  \`{ "<class-ref>": { "base": "primary" } }\` — a slot name instead of \`base\` targets that slot; an array applies
  several. Set it via \`upsertElement\`/\`patchElement\`.
An element read reports \`availableVariants\` (which variant each attached class offers) and the element's current
\`initialState\`, so you can see a button **has** a \`primary\` variant and whether it uses it. If the user asks for a
variant that does not exist yet, **create it (upsertDefinition variants) and apply it in the same batch**.
- \`initialState.visibility\` (boolean) sets whether the element starts shown or hidden.

## Data bindings
Connect a data **source** to an element field. A binding is \`{ to, source, transformers?, when?, enabled? }\` grouped
by **category**: \`attributes\` (a prop), \`style\` (a style value), \`initialState\` (an initial-state key).
- \`upsertBinding\` adds one, or replaces the binding already feeding the same \`to\` (or \`id\`).
- \`patchBinding\` edits an existing one (matched by \`to\`/\`id\`); \`deleteBinding\` removes it.
Discover valid source paths **and the transformer catalog** in \`plitzi://data-sources/{env}\`. Example — feed an API
list into a list element:
\`{ "type": "upsertBinding", "pageRef": "home", "ref": "myList", "category": "attributes",
  "binding": { "to": "items", "source": "apiContainer_x.data" } }\`.

**Source scope — a source is visible to the provider's DESCENDANTS only.** An element source named
\`<type>_<idRef>\` (e.g. \`apiContainer_products\`, \`list_food-list\`) is published by that element into the scope of
its **subtree**, so **only elements INSIDE the provider can bind to it**. Binding a sibling or an unrelated element
to it resolves to nothing at runtime. So to consume \`apiContainer_products.data\`, the bound element must live under
that apiContainer; inside a \`list\`, the repeated \`listItem\` and its children read the per-row source
(\`list_<idRef>.item.<field>\`). Module sources (no \`<type>_<idRef>\` head — \`state\`, \`space\`, \`navigation\`,
\`auth\`, \`collection\`) are global and bindable anywhere. Binding an element to an element source outside its
provider's subtree is schema-valid but **broken at runtime** (the source is not in scope), so
\`plitzi_validate\`/\`plitzi_apply\` treat it as an **error and reject the batch** — move the element under the
provider, or bind a source that is in scope.

**mockData is builder-only.** An \`apiContainer\`'s \`mockData\` prop feeds sample data **while editing in the
builder**; the published runtime fetches real data instead. Never rely on mockData as the production source — give
the provider a real source: a **connector** with \`runtime: "server"\` (see *Connectors*, the right answer whenever
the API needs a token or the content should be in the HTML), or a browser-side \`query\`/\`method\` for a public URL.

**\`transformers\` — post-process the value before it reaches the field** (\`source → t₁ → t₂ → field\`). An array of
\`{ action, params }\`; the runtime runs them in order and resolves each by its \`action\` alone, so an **unknown
action is silently skipped** and the raw value passes through. Use the **exact** action names from
\`plitzi://data-sources\` (\`transformers\`). The most common is **\`twigTemplate\`** to format a value — the incoming
value is the **\`{{source}}\`** token (NOT \`{{value}}\`); \`{{sourceTo}}\` is the field's previous value. Example —
show a number with units:
\`{ "type": "upsertBinding", "pageRef": "home", "ref": "food-item-time", "category": "attributes",
  "binding": { "to": "content", "source": "list_food-list.item.cookTimeMinutes",
    "transformers": [ { "action": "twigTemplate", "params": { "template": "{{source}} min de cocción" } } ] } }\`.
Other transformers: \`dateConverter\` (format a date/timestamp), \`capitalize\`, \`stringToArray\` (split on a
separator), \`arrayMap\` (remap the keys of each object in an array), \`staticValue\`. Transformer \`params\` values are
strings. Each transformer also takes an optional \`enabled\` flag: set \`"enabled": false\` to keep it in the chain but
skip it at runtime (defaults to true) — the value passes through untouched, and a disabled transformer is not
validated.

**\`when\` — gate the binding** with a QueryBuilder RuleGroup: the binding only applies when the guard passes against
the data source. Shape: \`{ "combinator": "and", "rules": [ { "field": "<path>", "operator": "=", "value": "x" } ] }\`
(operators: \`=\`, \`!=\`, \`<\`, \`>\`, \`contains\`, \`beginsWith\`, \`empty\`, \`in\`, \`between\`, …; nest RuleGroups for
and/or). The guard is validated structurally. Example — only bind when a flag is set:
\`"when": { "combinator": "and", "rules": [ { "field": "status", "operator": "=", "value": "published" } ] }\`.

## Interactions
An interaction **flow** is a **trigger** (an event like \`onClick\`, \`onPageLoad\`) followed by the callbacks/utilities
it runs, in order. You pass the steps **in order** and the stored beforeNode/afterNode/flowId links are computed for
you — never wire them by hand. Each step also has an \`enabled\` flag (see disable vs delete below).

**Node types & \`elementId\`** — a step names which element (or module) provides the callback it runs. Picking the
**wrong node type for an action** makes the runtime resolve it against nothing, so the step **silently does nothing**:
- \`trigger\` — the event; belongs to the host element. \`elementId\` defaults to the host.
- \`callback\` — a callback provided by a **specific element**. \`elementId\` is that element's ref (the flow host by
  default, or another element to act on); give its ref or raw id and it is normalised to the idRef. Every element
  registers a built-in **\`setState\`** callback that changes **its own attribute or state**: params
  \`category\` (\`"attribute"\` — set a prop like \`content\`/\`disabled\` — or \`"state"\` — \`visibility\` or a style
  selector), \`key\`, \`value\` (a **scalar** whose type follows the target attribute — a real boolean \`true\`/\`false\`
  for a boolean attribute, a number for a numeric one, otherwise a string), and **\`revertOnFinish\`**. Set
  \`revertOnFinish: true\` for a **temporary** change (a "loading…" label, disabling a button while it works): it is
  **undone automatically when the flow finishes**, so you do **NOT** add manual restore steps at the end. This element
  \`setState\` has **no** \`type\` param (that belongs to the global one below). An element type may also register its
  own extra callbacks.
- \`globalCallback\` — a callback provided by a **source module**, NOT by any element: \`addNotification\` (source
  \`space\`), \`setState\`/\`clearState\` (\`state\`), \`navigate\` (\`navigation\`), \`login\`/\`logout\`/
  \`refreshDetails\` (\`auth\`), \`addCollectionRecord\`/\`updateCollectionRecord\`/\`removeCollectionRecord\`
  (\`collection\`). Its \`elementId\` is the **source module id**, never the host element — a node that stored the host
  idRef here would resolve to nothing at runtime. **Omit \`elementId\`**: the MCP sets the correct source and fills the
  builder's **param defaults** (e.g. \`addNotification\` gets \`autoDismiss:true\`, \`autoDismissTimeout:5000\`,
  \`placement:"top-right"\`, \`appeareance:"success"\`) for any params you leave out. Use **only** the params each
  callback declares (exact spelling) — for \`addNotification\` the visible text goes in \`content\`; there is **no**
  \`title\`/\`message\`/\`type\` param, and any unknown key is dropped. See the full param schema for each callback under
  \`globalCallbacks\` in \`plitzi://interactions/{env}\`.
- **Two \`setState\`s — do not mix them:** the **element** \`setState\` (nodeType \`callback\`, on an element,
  category/key/value/revertOnFinish) changes THAT element's attribute/state and is what you want to change a button's
  label or disabled flag. The **global** \`setState\` (nodeType \`globalCallback\`, source \`state\`, key/type/value)
  writes \`runtime.state.<key>\`. They share a name but have different node types AND different params.
- \`utility\` — a built-in utility action (no element/source module); nodeType \`utility\`. Use the **exact** param
  names: \`delayTime\` waits \`time\` milliseconds (**not** \`delay\`), \`twigTemplate\` (\`returnMode\`, \`template\`),
  \`webHook\` (\`url\`, \`method\`, …). See \`utilities\` in \`plitzi://interactions/{env}\`.

**A param value can be a data binding.** Any interaction param may hold a \`{{ source }}\` token instead of a literal —
it resolves at runtime exactly like a prop binding, using the same source grammar (\`<type>_<idRef>.<path>\`, or a
module source like \`navigation\`/\`state\`). This is how a step reacts to *the data in context*: inside a \`listItem\`,
a click on a row can show \`addNotification\` with \`content: "{{ list_<idRef>.item.name }}"\` — the clicked row's field.
The value follows the source's type, so a token is valid even where a param expects a boolean/number. Copy/paste of an
element repoints these tokens to the new idRefs automatically, along with the element's bindings.

**Navigating between pages — prefer the \`Link\` element over an interaction.** For a plain "go to page X" the right
tool is a \`link\` element (a container, see *Pages & folders*), not a \`navigate\` interaction step. Use the
\`navigate\` globalCallback only when the navigation is one step of a larger flow (e.g. submit a form, then go).

Tools:
- \`upsertInteractionFlow\` — create or replace one flow. The FIRST node must be a \`trigger\`. Pass \`flowId\` (the
  trigger's node id) to replace an existing flow. Example (elementId omitted — the MCP wires it to \`space\` and fills
  the notification defaults):
  \`{ "type": "upsertInteractionFlow", "pageRef": "home", "ref": "cta", "nodes": [
    { "nodeType": "trigger", "action": "onClick", "title": "Click" },
    { "nodeType": "globalCallback", "action": "addNotification", "title": "Notify",
      "params": { "content": "Saved!" } } ] }\`.
- \`patchInteractionNode\` — change one step in place (by \`nodeId\`); \`params\` merge onto the node.

**Disable vs delete a step — do not confuse them (three different intents):**
- **Disable / deactivate / turn off a step** (keep it in the flow, just stop it running): \`patchInteractionNode\`
  with \`{ "enabled": false }\`. Re-enable with \`{ "enabled": true }\`. This is NOT a deletion — the step stays.
- **Remove one step** from a flow: \`deleteInteraction\` with \`nodeId\` (its neighbors are re-linked).
- **Remove the whole flow**: \`deleteInteraction\` with \`flowId\` (the trigger node id).

So "deactivate the addNotification step" means \`patchInteractionNode { enabled: false }\` — never delete the step, and
never delete the flow. \`deleteInteraction\` is **destructive and not undoable**: only use it when the user asked to
*remove* something, and **confirm with the user before deleting** a step or a flow.

Discover valid actions in \`plitzi://interactions/{env}\`: \`actions\` = observed, \`globalCallbacks\` /
\`elementCallbacks\` / \`utilities\` = the built-in vocabularies with their full param schema, so you know the exact
node type and valid params per action. An element read lists its flows as ordered nodes (each with its \`id\` and
\`enabled\`), so a follow-up patch/delete needs no extra read.

## Connectors — CMS and API integrations
A **connector** is how a space reads real content from Strapi, WordPress, Contentful, Directus or any REST service.
It is **a manifest, not code**: you declare the base URL, the endpoints, the auth template and the filter operators,
and the **server** executes it during the render. Integrating a new CMS never means shipping an adapter — it means
writing one document, which you can do here with \`upsertConnector\`.

Why the server and not the browser: the request (and the token behind it) never reaches the visitor, and the content
is in the HTML search engines see. That is also the one hard rule below — a provider element that is not
server-rendered ignores its connector entirely.

**Read these two first:**
- \`plitzi://connector-presets\` — **working manifests** for Strapi v5, WordPress, Directus, Contentful and a plain
  REST API, each with the \`credentialKeys\` that provider needs, **plus every template token** the engine binds.
  Start from the preset for the user's provider and edit it; do not invent a shape from memory.
- \`plitzi://connectors/{env}\` — the connectors **this space already has**, each with its read/write endpoint names,
  its filter operators and its published fields. \`plitzi://connectors/{env}/{ref}\` opens one manifest in full.

### Server actions
Work a page cannot do in the browser — charge a card, send mail, read a system only the server reaches. An action
is a stored flow the SERVER runs; a page names it and never learns what it does. Write one with
\`upsertAction\` / \`patchAction\`, then call it from a page flow with the \`runServerAction\` step (mode
\`await\` to use the result, \`detached\` to fire and carry on).

Four rules worth knowing before you write:

- **Steps are server tasks.** \`plitzi://actions/{env}/tasks\` lists what this deployment can run — a browser step
  (\`setState\`, \`navigate\`) has nothing to act on here, and the reverse is true too: a task cannot run in a page
  flow.
- **The contracts.** \`input\` is coerced and anything undeclared is DROPPED. The OUTPUT is whatever the final
  \`flow.output\` step names — there is no separate list to keep in step with it — and that step must be LAST,
  since only the last one that runs is answered. Everything else a step produced stays on the server.
- **Whether it runs lives on its TRIGGERS.** Each trigger step carries \`enabled\`, and the action is on when any
  way into it is — there is no switch beside the flow. So "pause this action" means disabling its trigger step(s),
  never deleting them.
- **A step names the credential it uses**, and sees no other. \`credentials\` on the document says which ones the
  action may ask for at all; the secret itself is never yours to see, exactly as with a connector.

### Credentials are NOT yours to write
You never create, see or transmit a secret. Author the manifest with the token in place
(\`"value": "Bearer {{credential.token}}"\`) and **leave \`connection.credential\` unset** unless the user hands you an
identifier. The connector **saves fine that way** — validation reports it as a *warning*, not an error — and its
requests go unauthenticated until the space owner creates the credential in the builder and attaches it. Say that to
the user as the last step of any integration you build, naming the keys the preset lists (e.g. Strapi needs \`token\`).

### The manifest
Every string is a template the server renders per request. \`{{resource}}\` is the collection the element asked for;
\`{{limit}}\`/\`{{offset}}\`/\`{{page}}\`/\`{{cursor}}\` the window; \`{{routeParams.x}}\`/\`{{queryParams.x}}\` the
visitor's URL; \`{{credential.x}}\` the secret; \`{{field}}\`/\`{{value}}\` inside an operator; \`{{id}}\`/\`{{values}}\`
inside a write. The op splits it in two, exactly as the engine does:
- **\`connection\`** — what applies to every call: \`credential\`, \`auth\`, \`headers\`, \`pagination\`, \`operators\`,
  \`mediaBaseUrl\`, \`fields\`, \`projection\`.
- **\`endpoints\`** — the individual calls: \`read\` (named; **\`list\` is the one an element addresses when it names
  none**) and \`write\` (named; **omit for read-only** — an undeclared write can never be executed).

A read endpoint says where things live in *that* provider's response: \`itemsPath\` (the array), \`totalPath\` (the
count), \`idPath\` (the record's id), \`valuesPath\` (its fields). Strapi's \`data\` + \`meta.pagination.total\` and
Contentful's \`items\` + \`fields\` are the same manifest with different paths.

Two traps the validator will catch for you, both silent at runtime otherwise:
- An **operator template must render a whole \`key=value\` entry** (\`"eq": "filters[{{field}}][$eq]={{value}}"\`). A
  filter naming an operator the manifest does not declare is **dropped** — the query then returns *unfiltered*
  records, not none.
- **Paging must appear in the request.** Declaring \`pagination: "page"\` without \`{{page}}\` in the query makes every
  page resolve to the first one.

Example — Strapi, from the preset:
\`\`\`json
{ "type": "upsertConnector", "ref": "strapi-blog", "name": "Blog CMS",
  "baseUrl": "https://cms.example.com",
  "connection": {
    "auth": { "in": "header", "name": "Authorization", "value": "Bearer {{credential.token}}" },
    "pagination": "offset",
    "operators": { "eq": "filters[{{field}}][$eq]={{value}}", "contains": "filters[{{field}}][$containsi]={{value}}" },
    "mediaBaseUrl": "https://cms.example.com" },
  "endpoints": { "read": { "list": {
    "path": "/api/{{resource}}",
    "query": { "pagination[start]": "{{offset}}", "pagination[limit]": "{{limit}}", "populate": "*" },
    "itemsPath": "data", "totalPath": "meta.pagination.total", "idPath": "documentId" } } } }
\`\`\`
\`patchConnector\` changes part of one (endpoints merge **by name**; \`null\` removes one) — that is how you add a
\`detail\` read to a large manifest without resending it. \`deleteConnector\` is destructive: every element pointing
at it stops resolving, so confirm first.

### Using a connector on a page
The provider element is \`apiContainer\`, and it needs **both halves**:
1. \`runtime: "server"\` — set it on \`upsertElement\`/\`patchElement\`. **Without it the connector is ignored** and the
   element falls back to fetching its own \`query\` URL from the browser. This is the single most common mistake; the
   validator warns when it sees one half without the other.
2. props: \`connector\` (the ref), \`resource\` (the collection → \`{{resource}}\`), and optionally \`endpoint\` (a read
   other than \`list\`), \`filters\`, \`limit\`, \`singleRecord\`, \`pagination\`, \`pageParam\`.

It then publishes one source **to its descendants only** (like any provider — bind *inside* its subtree):
\`apiContainer_<idRef>.records\` (an array), \`.pageInfo\` (\`page\`, \`pageCount\`, \`total\`, \`hasNextPage\`…),
\`.isEmpty\`, \`.hasError\`, \`.errorMessage\`, \`.isLoading\`. With \`singleRecord: true\` it publishes \`.record\`
instead of \`.records\` — that is what a **detail page** uses. Bind an empty-state block's visibility to \`.isEmpty\`
and an error block's to \`.hasError\`; they are ordinary bindings, no special mechanism.

**A list page** — provider, then a \`list\` inside it bound to the records, then the row template reading the item:
\`\`\`json
{ "operations": [
  { "type": "upsertElement", "pageRef": "blog", "element": {
      "ref": "posts-api", "type": "apiContainer", "runtime": "server",
      "props": { "connector": "strapi-blog", "resource": "articles", "limit": "9", "pagination": "url" },
      "children": [ { "ref": "posts", "type": "list", "children": [
        { "ref": "post-row", "type": "listItem", "children": [
          { "ref": "post-title", "type": "text" } ] } ] } ] } },
  { "type": "upsertBinding", "pageRef": "blog", "ref": "posts", "category": "attributes",
    "binding": { "to": "items", "source": "apiContainer_posts-api.records" } },
  { "type": "upsertBinding", "pageRef": "blog", "ref": "post-title", "category": "attributes",
    "binding": { "to": "content", "source": "list_posts.item.title" } } ] }
\`\`\`

**A detail page** is the same provider with \`singleRecord\` and a filter resolved from the URL. Create the page with a
route param (\`"slug": "blog/:postSlug"\`), then filter on it — the filter \`value\` is a template the server resolves:
\`\`\`json
{ "type": "upsertElement", "pageRef": "post-detail", "element": {
    "ref": "post-api", "type": "apiContainer", "runtime": "server",
    "props": { "connector": "strapi-blog", "resource": "articles", "singleRecord": true,
      "filters": [ { "field": "slug", "operator": "eq", "value": "{{routeParams.postSlug}}" } ] } } }
\`\`\`
Its children then bind to \`apiContainer_post-api.record.<field>\`. A filter whose template resolves to nothing
returns **no records** rather than the whole collection — a URL that addressed one post never renders a different one.

**Paging** is the \`pagination\` prop: \`"none"\`, \`"url"\` (the page number rides the query string, so pages are
shareable and indexable — prefer it) or \`"append"\` (a "load more" list). Give each list on a page its own
\`pageParam\` so two lists page independently. The provider also offers the \`loadMore\` and \`goToPage\` callbacks to
interaction flows, and \`performQuery\` to refetch.

**Writing back** (a form, a "delete" button): declare the endpoint under \`endpoints.write\`, then call the provider's
**\`writeRecord\`** callback from an interaction flow — nodeType \`callback\`, \`elementId\` the apiContainer's ref,
params \`action\` (the write endpoint's name) and \`recordId\`. The write goes through the server, which owns the
credential and refuses any action the manifest does not declare. Writes exist **only** on a server-rendered provider.

**Connectors need a server.** A space published without server rendering has nowhere to resolve one: it works in the
builder and renders empty when published. If the user has no SSR deployment, say so rather than leaving them to
discover it — the alternative is a browser-side \`query\`, which cannot keep a secret.

## Pages & folders
- **Always set a \`slug\` when creating a page** (\`upsertPage\`) — it is the page's URL path and good practice for a
  clean, stable route (e.g. \`"pricing"\` or \`"posts/:postId"\`). Omit it and the page ref is used as the slug,
  and \`plitzi_validate\`/\`plitzi_apply\` warn so you remember to set a meaningful one.
- **A page slug is RELATIVE — do NOT start it with \`/\`.** The runtime prepends the leading slash (and any folder
  path) itself, so a leading slash doubles it. Write \`"pricing"\`, not \`"/pricing"\`. (upsertPage strips a leading
  slash for you, but write it relative.)
- **Dynamic pages — route params.** A slug segment written \`:name\` (e.g. \`"posts/:postId"\`) is a **route param**,
  exactly like React Router. On that page it is readable **two ways**: as \`{{name}}\` inside a prop, and as the
  data-binding source **\`navigation.routeParams.name\`** (the \`navigation\` module source, global — bindable
  anywhere). So a blog is a \`"posts"\` list page plus a \`"posts/:postId"\` detail page whose \`apiContainer\` query
  binds \`navigation.routeParams.postId\` to fetch that one post. (\`navigation.queryParams.<name>\` exposes \`?query=\`
  string params the same way.)
- **Navigate with the \`Link\` element, not an interaction.** \`link\` is a **container** — it wraps any children and
  navigates on click, so it is the default way to move between pages. Its \`mode\`: \`"page"\` links to another space
  page (set \`href\` to the target page, folder path resolved for you); \`"internal"\` takes a path inside the space and
  resolves \`{{token}}\` templates in it, so a row's "view" link is \`mode:"internal", href:"posts/{{postId}}"\`;
  \`"external"\` is a full URL. \`target\` is \`self\`/\`blank\`/\`parent\`/\`top\`. Reach for the \`navigate\` globalCallback
  only when navigation must be **one step inside a larger interaction flow** (e.g. save, then go) — for a plain link,
  use \`link\`.

Pages can be grouped into **folders** (the sidebar tree). A folder is \`{ ref, name, slug, parentId? }\`; its \`ref\`
**is its id** (there is no separate idRef), and that id is what a page and a nested folder reference.
- **Folder slugs PREPEND to the page URL — this is how nested URLs are built.** The full path is each ancestor
  folder's slug plus the page slug, joined by \`/\`: a page at slug \`"1-1-1"\` inside \`folder-1\` > \`folder-1-1\`
  resolves to \`/folder-1/folder-1-1/1-1-1\`. So a folder slug is part of the route; keep folder slugs relative too.
- Create/rename/move a folder with \`upsertFolder\` (the \`ref\` you pass on create becomes its id — pick a stable one
  like \`"blog"\`). Nest it under another with \`parentId\` (a folder ref); \`parentId: null\` moves it back to the root.
- Put a page in a folder with \`upsertPage\`'s \`folder\` (a folder ref). A page's \`folder\` is always either **empty
  (root)** or an **existing folder id**: \`folder: null\` or \`folder: ""\` moves it to the root, and any other value
  must resolve to a folder that already exists or is created earlier in the same batch — an unknown folder is
  rejected, never stored.
- \`deleteFolder\` removes a folder and **promotes its contents up one level** — its child folders and its pages move
  to its parent (or the root). A folder cannot be nested under itself or one of its descendants.
- **Disable a page** with \`upsertPage\`'s \`enabled: false\`; \`enabled: true\` re-enables it (defaults to enabled, and
  a page read reports its current \`enabled\`). Disabling only affects the **published SDK runtime** — the page stops
  being routable/accessible to end users. It stays fully **editable here**: you can still read it and apply any op to
  a disabled page. This does not delete it — \`deletePage\` does.

## Settings
Space-level configuration lives in \`plitzi://settings/{env}\` and is edited with a single **\`patchSettings\`** op
(merge — only the fields you pass change):
- \`customCss\` — **raw global CSS** injected for the whole space. Use it only for genuinely site-wide rules
  (\`@keyframes\`, \`@font-face\`, resets). To style an element, write a **definition** and attach it — never customCss.
- \`keepState\` / \`stateStorage\` — persist element state across reloads (\`localStorage\`/\`sessionStorage\`).
- **User provider / auth**: \`userProvider\` — \`basic\` for any HTTP+JSON backend, the name of a provider registered
  in the page, or \`""\` to disable auth — plus \`tokenStorage\`, the \`loginUrl\`/\`userUrl\`/\`refreshUrl\`/\`logoutUrl\`
  endpoints and the \`detailsPath\`/\`tokenPath\`/\`refreshTokenPath\`/\`expirationTimePath\` mapping that says where the
  values sit in their responses. \`sessionHintCookie\` is worth setting whenever the backend can: it names a readable
  cookie carrying only expiries, which is what lets a page answer "nobody is signed in" without a request.
  Example — inject a keyframe globally:
  \`{ "type": "patchSettings", "customCss": "@keyframes spin { to { transform: rotate(360deg); } }" }\`.

## Semantics
- **props are fully replaced** on \`upsertElement\`: send every prop you want to keep. To change only some props,
  use **\`patchElement\`** — it merges \`props\`/\`style\` onto the existing element (listed keys change, \`null\` unsets
  a key, everything else is preserved) and never creates. Combined with \`plitzi_search\` (which returns the ref +
  stateVersion), a targeted edit is two calls with no read.
- **definition CSS is fully replaced** on \`upsertDefinition\`: send every property you want to keep. To change only
  some declarations, use **\`patchDefinition\`** — it merges CSS per breakpoint/state/variant/slot onto the existing
  definition (listed keys change, \`null\` removes a property, everything else is preserved) and never creates.
  Example — recolor one definition without resending it: \`{ "type": "patchDefinition", "ref": "btn-x",
  "desktop": { "background-color": "#111" } }\`.
- **Atomic batches**: if any operation fails, \`plitzi_apply\` persists nothing.
- **Every resource you touch must be malformation-free — pre-existing errors block the save.** When your batch edits
  an element (or a definition/global/id style), the validator also checks the resource's **current stored content**
  for malformations — a broken transformer action, a malformed interaction node, invalid CSS — even in parts your
  edit does not touch. Such a finding is reported as a \`Pre-existing malformation in <resource>: …\` **error**, and
  \`plitzi_apply\` rejects the batch until it is fixed. These are **not caused by your change** (the message says so)
  — do not be confused; fix them **in the same batch** and re-apply. Because the check runs on the resulting state,
  including the fix in your batch is exactly what unblocks the save. (Advisory issues — an unobserved source/action
  name that may still be a valid plugin, a binding target a plugin manifest does not list — come back as
  \`Pre-existing issue …\` **warnings** and do not block.)
- **Optimistic concurrency — read before you write, and prove your read is current.** Editing a resource means you
  read it first, so you hold its \`stateVersion\`. **Always pass \`expectedResourceVersions\`** (URI → the stateVersion
  you read) for every resource your batch changes. If another agent edited it in the meantime, the live version no
  longer matches and apply is **rejected with a conflict** — nothing persists. Then re-read the reported resources
  (their new content + version) and retry on top of the fresh state. This is exactly how a file editor forces a
  re-read after a stale write: it is what keeps concurrent agents from silently overwriting each other's changes, so
  never omit it "to save a call".
`;
