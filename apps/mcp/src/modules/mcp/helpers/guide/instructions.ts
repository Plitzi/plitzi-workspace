import { GLOBALS } from './values';

// Shown in the MCP initialize result — the first thing an agent sees. Keep it short; the full reference is
// plitzi://guide.
export const serverInstructions =
  'Plitzi AI server: read-then-write editing of a Plitzi space. Reads follow a filesystem model — list cheap, ' +
  'read one item in detail on demand; never fetch a whole tree you do not need. Workflow: (1) read ' +
  'plitzi://primer/{env} once — it bundles a quickstart of the guide, types, css-properties and page/definition/' +
  'variable summaries in a single call; (2) plitzi_search with include:"detail" to jump to elements — each hit then carries ' +
  'its uri, stateVersion AND full style/resolvedStyle, so an edit needs no per-element read; open a page skeleton ' +
  'or element only when you need its tree/detail (the skeleton already lists the style classes of each node, and ' +
  'plitzi_read fetches many uris at once); (3) plitzi_apply with dryRun to preview a batch; (4) plitzi_apply to ' +
  'persist, passing ' +
  'expectedResourceVersions to guard against concurrent edits — apply and search both hand back the versions ' +
  'you need for the next edit. Use patchElement / patchDefinition to change only some props / CSS (the upsert ' +
  'variants replace them all). An element read (and search include:"detail") inlines the CSS of the definitions ' +
  'it attaches under resolvedStyle, so you rarely need a separate definition read. ' +
  'Every element has ONE name and it IS its id ([A-Za-z0-9_-] starting with a letter, unique, chosen by you) — the ' +
  'same name is the runtime wiring key, so a provider source is `<type>_<name>.<field>`, visible to the ' +
  'provider’s DESCENDANTS only ' +
  '(bind inside its subtree). CSS is plain kebab-case — write shorthands freely (`border: 1px solid red`, ' +
  '`padding: 8px 16px`, `font: bold 16px/1.5 Arial`), they are expanded to longhands for you and STORED that way, ' +
  'so read-back shows the longhands; style vars are var(--name), schema vars are {{name}}. ' +
  'READERS — do not confuse them: MCP *resources* are the browsable catalog (list them, or open one by URI); ' +
  'plitzi_search FINDS elements by label/type/attribute and hands you the name to write ops against; ' +
  'plitzi_read BATCH-fetches URIs you already hold. Reach for ' +
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
  'Build pages people can use without sight: screen readers and browser agents (Claude in Chrome) work a page ' +
  'through its accessibility tree, so every control needs words and clicks go on buttons and links — see ' +
  'Accessibility in plitzi://guide, and plitzi_look (its accessibility outline, the default view) to check. ' +
  'On a space people edit too, plitzi_activity says — and waits for — what they changed since you last looked. ' +
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

**Big spaces:** a primer section may arrive as \`{elided:true, bytes, entries, read}\` instead of its contents —
the space outgrew what one cold-start read can carry. \`read\` is the resource that serves that exact section whole
(\`plitzi://definitions/{env}\`, \`plitzi://interactions/{env}\`, …). Read the ones your task needs; nothing is
missing, it is one round-trip away.

**Workflow:** (1) you already have this primer (guide + types + css + page/style summaries). (2) \`plitzi_search\`
with \`include:"detail"\` to find elements — each hit carries its \`uri\`, \`stateVersion\` and full style, so no
per-element read. (3) \`plitzi_apply\` with \`dryRun:true\` to preview. (4) \`plitzi_apply\` to persist, passing
\`expectedResourceVersions\` (uri → the stateVersion you read) for every resource you change — omitting it lets a
concurrent edit be lost. Use \`patchElement\`/\`patchDefinition\` to change only some props/CSS (upsert replaces all).

**Names & wiring:** an element has ONE name and it is its id (letters, numbers, hyphens and underscores,
**starting with a letter — no dots**). It is also the runtime wiring key: a provider's source is
\`<type>_<name>\`, and interactions target by it. A dot would split that path; an **underscore is fine** — the first
\`_\` separates the type from the name (element types have none), so \`list_food_item\` reads unambiguously as type
\`list\`, name \`food_item\`.

**Styling:** CSS keys are **kebab-case** (\`background-color\`); \`var(--token)\` for style vars, \`{{name}}\` for schema
vars. **Write plain CSS** — shorthands (\`border\`, \`padding\`, \`margin\`, \`gap\`, \`overflow\`, \`flex\`, \`background\`,
\`font\`, \`transition\`, \`animation\`, \`grid\`, \`grid-row\`/\`grid-column\`, \`place-*\`, \`outline\`, \`columns\`,
\`list-style\`, \`text-decoration\`) are expanded to their longhands for you, so \`border: 1px solid red\` is stored as
\`border-top-color\`/\`border-top-width\`/\`border-top-style\`/… That is also how you read them back. Flex layout is
still \`display: flex\` + \`flex-direction\`/\`align-items\`/…, not a \`flex\` value. Mind a type's \`defaultStyle\`
(\`text\` is \`display: inline\`). Global styles (\`button {…}\`) and id styles (\`#id\`) have their own ops.

**Motion:** animate only \`opacity\` and \`transform\` — they stay smooth while the page loads; an animated blur,
shadow, size, \`top\`/\`left\` or \`background-position\` stutters on every visitor's machine. Good practices in
\`plitzi://guide\` (Motion).

**Data bindings** (\`upsertBinding\`, category attributes|style|initialState): connect a \`source\` to a \`to\` field.
A source \`<type>_<name>\` is scoped to the provider's **DESCENDANTS only** — bind inside the provider's subtree
(the global sources ${GLOBALS} are bindable anywhere). \`apiContainer.mockData\` is builder-only; set a
real \`query\` for production. \`transformers: [{action, params}]\` post-process the value — use exact action names
from \`plitzi://data-sources\`; \`twigTemplate\` formats it (the value is \`{{source}}\`, not \`{{value}}\`). \`when\` is
a QueryBuilder RuleGroup gating the binding.

**Fewer elements, same page:** a \`link\` or \`button\` says its words itself — \`content\`, with an icon beside them
as \`icon\` (\`iconPlacement\` before/after, its class on the \`icon\` slot) — never a \`text\` or \`fontAwesome\` child;
a text child also ignores the box's colour and hover. Chrome on several pages is a **layout**; the nav item of the page being shown is marked by the
\`current\` state of its class, not by a copy of the header per page. Sibling rows of data are one \`repeatElement\`; a
block repeated with other words is a **component** (\`upsertComponent { fromRef }\`). \`plitzi_apply\` (with or
without \`dryRun\`) answers with **\`suggestions\`** for what the batch could have written shorter, each with the elements
it saves — never blocking; take them unless the copies are about to diverge.

**Interactions** (\`upsertInteractionFlow\`): a \`trigger\` node first, then callbacks/utilities **in order** (links
computed for you). Node types: \`callback\` (an element's own callback — \`elementId\` is that element), \`globalCallback\`
(a source module — omit \`elementId\`, the MCP sets it), \`utility\` (no element). Element \`setState\`
(category/key/value/revertOnFinish) ≠ global \`setState\` (source \`state\`, key/type/value). To turn a step off use
\`patchInteractionNode {enabled:false}\` — \`deleteInteraction\` removes it (destructive; confirm first). Any param
**value** can be a binding token \`{{ source }}\` (e.g. notification \`content: "{{ list_<name>.item.name }}"\`).
Steps read the page as it is when they run; a refiring trigger is ignored unless \`whileRunning: "queue"\` (or
\`"latest"\`: the newest firing stops the running one); keyboard
shortcuts are the \`onKey\` trigger (\`keys: "shift+f, escape"\`).

**CMS / API integrations** (\`upsertConnector\`): a **connector** is a manifest declaring a provider's base URL,
endpoints, auth template and filter operators, executed by the **server** — so integrating Strapi, WordPress,
Contentful or any REST API is configuration, not code. Read \`plitzi://connector-presets\` (working manifests + every
template token) and \`plitzi://connectors/{env}\` (this space's). **You never create or see credentials** — write the
manifest with \`{{credential.token}}\` and no \`connection.credential\`; it saves, and the space owner attaches the
secret in the builder. To consume one, an \`apiContainer\` needs **\`runtime: "server"\`** plus \`connector\`,
\`resource\`, optional \`endpoint\`/\`filters\`/\`limit\`/\`singleRecord\`/\`pagination\`; it then publishes
\`apiContainer_<name>.records\` (or \`.record\`) \`.pageInfo .isEmpty .hasError\` to its **descendants**. Full worked
flow — list page, detail page, paging, writes — in \`plitzi://guide\`.

**Pages & navigation:** \`upsertPage\` — always set a **relative** \`slug\` (no leading \`/\`; the runtime and folder
slugs prepend the path). A \`:name\` segment (\`"posts/:postId"\`) is a route param, readable as \`{{name}}\` and as the
source \`navigation.routeParams.name\` → build dynamic pages this way. To move between pages **prefer the \`Link\`
element** (\`mode\` "page"/"internal"/"external"; its words are its \`content\`, and it can wrap any children too) over
a \`navigate\` interaction.

**Feature flags:** what a person switches on (a beta, a rollout) is \`upsertFlag\` plus \`flag: "x"\` / \`"!x"\` on the
element or page — not \`visible\`. Read anywhere as \`{{ flags.x }}\`.

**Accessible by default:** screen readers and browser agents (Claude in Chrome) read the accessibility tree, so every
button/link needs words (an icon-only button a \`title\`), every field a \`label\` (\`hideLabel: true\` hides it), every
image an \`alt\` or \`decorative: true\`; clicks go on a \`button\`/\`link\`, never a container; headings step down one
level at a time. \`plitzi_look\` shows the tree and what has no name.

**Everything the space holds is public.** Its pages, variables, attributes, flow params and mock data ship to every
visitor's browser, and a file on a public bucket of its CDN is served to anyone who has its address. A key, a token or
data only some visitors may read never goes in any of them: a secret is a credential the owner attaches (a connector, an
action or a function names it, never carries it), and data for some visitors only comes from a \`runtime: "server"\`
provider or an action that checks who is asking.

**Touched elements must be malformation-free.** Editing an element also checks its CURRENT stored content and BLOCKS
the save on any \`Pre-existing malformation in element …\` error (a broken transformer, a malformed step, an attribute
it never reads) — even parts you did not touch. These are NOT from your change (the message says so); fix them in the
SAME batch and re-apply (the check runs on the result, so the fix unblocks it). \`Pre-existing issue\` warnings advise
but do not block. A broken tree your batch leaves ANYWHERE (an element orphaned by a delete) blocks it too. Each
problem leads with its \`[code]\`, and its hint says what to write instead.

Read \`plitzi://guide\` before anything above is unclear.
`;
