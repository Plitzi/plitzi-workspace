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
  'Refs accept a semantic idRef ([A-Za-z0-9-], unique, chosen by you) or the raw id — the idRef is ALSO the ' +
  'runtime wiring key, so a provider source is `<type>_<idRef>.<field>`. CSS is kebab-case (shorthands accepted); ' +
  'style vars are var(--name), schema vars are {{name}}. ' +
  'READERS — do not confuse them: MCP *resources* are the browsable catalog (list them, or open one by URI); ' +
  'plitzi_search FINDS refs by label/type/attribute; plitzi_read BATCH-fetches URIs you already hold. Reach for ' +
  'search/read to work; browse resources to discover. ' +
  'Elements also carry applied style variants + visibility (initialState), data bindings and interaction flows: ' +
  'edit them with patchElement (initialState), upsertBinding/patchBinding/deleteBinding, and ' +
  'upsertInteractionFlow/patchInteractionNode/deleteInteraction. An element read shows all three plus ' +
  'availableVariants (which variant each of its classes offers).';

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

The style resources also answer under the \`plitzi://schema/{env}/…\` root as aliases — \`plitzi://schema/{env}/definitions/{ref}\`, \`plitzi://schema/{env}/style-variables/{category}\`, \`plitzi://schema/{env}/schema-variables\` — but prefer the ready-made \`uri\` from search / a write response over hand-building either form.

Data resources return \`{ stateVersion, data }\`. Keep \`stateVersion\` for optimistic concurrency.

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
- \`plitzi_validate\` — check a batch, returns teachable errors/warnings. Writes nothing.
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
- Charset \`[A-Za-z0-9-]\` (e.g. \`"products-api"\`). A \`.\` would split the \`<type>_<idRef>.<field>\` source path and the
  interaction target lookup; a \`_\` would collide with the \`<type>_<idRef>\` separator. **No dots, no underscores** —
  use hyphens.
- **Unique across the space**; creating a ref that is taken is rejected (address the existing element instead).

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
- A definition lives in the **style schema**; an element's \`style.base\` (element schema) is the link that applies
  it. Styling an element = upsertDefinition + upsertElement with that ref in \`style.base\`, in one batch.
- CSS keys are **kebab-case** (\`background-color\`). camelCase is rejected — read \`plitzi://css-properties\`.
- Common **shorthands are accepted** and expanded for you: \`border\`, \`border-{side}\`, \`border-radius\`,
  \`padding\`, \`margin\`, \`inset\`, \`gap\` (they persist as their longhand keys).
- CSS is grouped by breakpoint: \`desktop\`, \`tablet\`, \`mobile\`.
- Reference a style variable in CSS as \`var(--name)\`; a schema variable in a prop as \`{{name}}\`.
- \`element.style.base\` is a list of definition refs; other slots go under \`element.style.slots\`.
- **Three kinds of style live in the style schema — do not confuse them:**
  - **Definitions** = reusable CSS **classes** (\`upsertDefinition\`/\`patchDefinition\`/\`deleteDefinition\`, keyed by a
    class \`ref\`). Attach one to an element via \`style.base\` to style **that** element (and anything else that opts in).
    This is the **default** way to style one element.
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
Discover valid source paths in \`plitzi://data-sources/{env}\`. Example — feed an API list into a list element:
\`{ "type": "upsertBinding", "pageRef": "home", "ref": "myList", "category": "attributes",
  "binding": { "to": "items", "source": "apiContainer_x.data" } }\`.

## Interactions
An interaction **flow** is a **trigger** (an event like \`onClick\`, \`onPageLoad\`) followed by the callbacks/utilities
it runs, in order. You pass the steps **in order** and the stored beforeNode/afterNode/flowId links are computed for
you — never wire them by hand. Each step also has an \`enabled\` flag (see disable vs delete below).

**Node types & \`elementId\`** — a step names which element (or module) provides the callback it runs:
- \`trigger\` — the event; belongs to the host element. \`elementId\` defaults to the host.
- \`callback\` — a callback on a **specific element** (e.g. \`setVisibility\` on another box). \`elementId\` is that
  element's ref; give its ref or raw id and it is normalised to the idRef. Defaults to the host element.
- \`globalCallback\` — a callback provided by a **source module**, NOT by any element: \`addNotification\` (source
  \`space\`), \`setState\`/\`clearState\` (\`state\`), \`navigate\` (\`navigation\`), \`authLogin\`/\`authLogout\`/
  \`authRefreshDetails\` (\`auth\`), \`addCollectionRecord\`/\`updateCollectionRecord\`/\`removeCollectionRecord\`
  (\`collection\`). Its \`elementId\` is the **source module id**, never the host element — a node that stored the host
  idRef here would resolve to nothing at runtime. **Omit \`elementId\`**: the MCP sets the correct source and fills the
  builder's **param defaults** (e.g. \`addNotification\` gets \`autoDismiss:true\`, \`autoDismissTimeout:5000\`,
  \`placement:"top-right"\`, \`appeareance:"success"\`) for any params you leave out. See these under \`globalCallbacks\`
  in \`plitzi://interactions/{env}\`.
- \`utility\` — a built-in utility action (no element).

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

Discover valid actions in \`plitzi://interactions/{env}\` (\`actions\` = observed, \`globalCallbacks\` = built-ins with
their source + defaults). An element read lists its flows as ordered nodes (each with its \`id\` and \`enabled\`), so a
follow-up patch/delete needs no extra read.

## Pages & folders
Pages can be grouped into **folders** (the sidebar tree). A folder is \`{ ref, name, slug, parentId? }\`; its \`ref\`
**is its id** (there is no separate idRef), and that id is what a page and a nested folder reference.
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
- **User provider / auth**: \`userProvider\` (\`auth0\`|\`basic\`|\`custom\`|\`""\` to disable), \`auth0Domain\`,
  \`auth0ClientId\`, \`tokenStorage\`, and the \`loginUrl\`/\`userUrl\`/\`refreshUrl\`/\`logoutUrl\` + \`detailsPath\`/
  \`tokenPath\`/\`expirationTimePath\` mapping. Example — inject a keyframe globally:
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
- **Optimistic concurrency**: pass \`expectedResourceVersions\` (URI → the stateVersion you read). If the live data
  drifted, apply is rejected with a conflict; re-read the reported resources and retry.
`;
