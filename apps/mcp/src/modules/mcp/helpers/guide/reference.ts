/** The guide's start: what to read, the tools, and how an element is addressed, made, moved and deleted. */
export const referenceGuide = `# Plitzi AI MCP — usage guide

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
  \`link\` navigates between pages, \`list\` repeats a template over a data array. \`plugin\` types are the elements
  of the plugins the space installed: added by their type, like a built-in.
- \`plitzi://css-properties\` — valid kebab-case CSS property keys.
- \`plitzi://explain/{name}\` — what a name means: an element type's attributes, triggers and callbacks; a step's
  params and what it publishes; what a trigger hands its flow; a problem code's fix. \`plitzi://explain/steps\` (or
  elements, triggers, codes, transformers) lists every one of a kind.
- \`plitzi://schema/{env}/pages\` — page **summaries** (ref, label, elementCount, folder). No element trees.
- \`plitzi://schema/{env}/layouts\` — the shared **layout shells** (header/sidebar/footer) and the pages rendered
  inside each. Read one like a page. See *Shared layouts* below.
- \`plitzi://schema/{env}/components\` — the space's **components** (reusable subtrees): their props, slots, root and
  how many places render each. Read one like a page. See *Components* below.
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
- \`plitzi://fonts/{env}\` — the font **families the space loads**, with their source and fallback. \`/{family}\` for one.
- \`plitzi://schema-variables/{env}\` — space-level values referenced in props as \`{{name}}\`.
- \`plitzi://flags/{env}\` — the space's **feature flags**, each a default and its rules (see **Feature flags**).
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
- \`plitzi://actions/{env}/tasks\` — the **server tasks this deployment can run**, each with its params: the steps an
  action may be built from.
- \`plitzi://functions/{env}\` — the space's **functions**, its own server code: which files, and the tasks, routes and
  hosts they declare. \`plitzi://functions/{env}/{+path}\` reads one file whole. See *Functions* below.
- \`plitzi://data/{env}\` — the space's **data**: JSON files its server providers read, never served.
  \`plitzi://data/{env}/{+path}\` reads one, parsed. See *Data* below.
- \`plitzi://changes/{env}\` — the space's **change history**, read-only and newest first: who made each change (a
  person in the builder, an agent, the autofix), when, and every element, class, token or font it touched, whole, before
  and after. \`/{id}\` for the history of one of them — how you find what changed an element you are asked about, or
  review what you or another agent just did.
- \`plitzi://render/guide\`, \`plitzi://render/types\` — the manual and the type table for \`plitzi_render\` (offline
  widgets, not this space).

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

## Tools
- \`plitzi_apply\` — validate → apply → persist atomically. Rejects the whole batch on any error or conflict, and
  reports **pre-existing malformations** in any resource the batch touches (see below) and \`suggestions\` (see
  *Suggestions*). Pass \`dryRun: true\` to check and apply in memory only — the same answer, nothing persisted — and
  \`look\` (\`"html"\`, \`"image"\`, \`"accessibility"\` or \`"both"\`, with \`pageRef\` and \`viewport\`) to see the page
  as the batch leaves it in the same call. Check and look with \`dryRun\`, then send the same operations without it.
  \`effects\` is what the batch did, read off the space before and after it — every element, attribute, class and
  setting it changed, one line each: read it, not your batch, for what is now so. \`Nothing changed\` and \`NOT saved\`
  lead the warnings when they are so.
- **By intention**, a few parameters and the element named by its ref alone — the page is found, the operations
  written, the batch checked and saved as \`plitzi_apply\` saves it, and the answer its \`effects\`, whether it was
  \`saved\`, and what was already so:
  \`plitzi_set_attributes { ref, set, unset }\`, \`plitzi_set_classes { ref, add, remove }\` (the classes it wears and
  you do not name stay), \`plitzi_bind_attribute { ref, to, source }\`, \`plitzi_place_component { component, ref, into,
  props }\`, \`plitzi_add_page { ref, slug, layout }\`. One of them when it says the whole change; anything else is one
  batch of \`plitzi_apply\`.
- \`plitzi_describe_operation\` — one operation's schema by its \`type\` (every field, which are required); without a
  type, every operation type there is. Ask for the one you are writing instead of guessing a field: a field an
  operation does not have is refused naming the one meant (\`"prop" (did you mean "props"?)\`), and a type spelt with
  other capitals is read as the catalog spells it and said in \`warnings\`. The same batch refused twice is not run a
  third time (\`REPEATED_BATCH\`) — change what the errors name, or ask the person.
- \`plitzi_search\` — find elements (and pages/definitions) across the space.
- \`plitzi_read\` — read many resource **uris in one batch** (pages, elements, definitions, variables). Pass the
  ready-made uris from search / a write response; each result is \`{ uri, stateVersion, data }\` or a teachable error,
  so one bad uri never fails the batch. Use it instead of N single reads whenever you already hold several refs.
- \`plitzi_look { pageRef, view, viewport }\` — see a saved page. \`view\`: \`"accessibility"\` (default) reads it as a
  screen reader and a browser agent (Claude in Chrome) do — an outline of roles and names, every control and picture
  with no name listed in \`unnamed\`, as text and far cheaper than an image; \`"html"\` its markup; \`"image"\` a PNG,
  the way to SEE overflow and misalignment (desktop, mobile or \`both\`); \`"both"\` image and outline. A change not
  saved yet is seen with \`plitzi_apply\`'s \`dryRun\` and \`look\`, the same views. It needs the SSR render service
  (\`PREVIEW_UNAVAILABLE\` without it); without a browser, an image or an outline falls back to the HTML, said.
- \`plitzi_activity { after, wait }\` — what happened on the space since you last looked: the draft changed (a person
  in the builder, another agent, the autofix — \`seq\` is its place in \`plitzi://changes/{env}\`), a version went
  out, a server action failed or was refused. The first call, without \`after\`, answers the latest and a \`cursor\`;
  pass it back as \`after\` and the call waits up to \`wait\` seconds (45, at most 50) until something happens. Your own
  writes are left out and counted (\`skippedMine\`; \`mine: true\` keeps them). On a space people edit too, call it
  before a write that rests on what you read earlier.
- \`plitzi_render\` — a different job: show the user a self-contained widget built offline. It never touches the space.

## Suggestions — the same page with fewer elements
\`plitzi_apply\` (with or without \`dryRun\`) answers with \`suggestions\`: lines like \`[content-attribute] … (saves 4
elements)\`, each naming a shorter way to what the batch just wrote. Only what THIS batch opened up is said — what the
space already had is not repeated on every batch — and none of them blocks anything: the page renders as written.
- \`repeated-on-pages\` — the same block at the edge of several pages: put it in a **layout** once (a block only some
  pages of a layout carry is a **component** instead). Copies differing only in one link's class are the nav item of the
  page being shown: the \`current\` state marks it (see *Pages & folders*).
- \`repeated-shape\` — one structure written again with other words: a **component** with props
  (\`upsertComponent { fromRef }\` turns one copy into it), or, for sibling rows of data, one \`repeatElement\`/\`list\`.
  A few cards a person rewords by hand can stay cards; siblings that bind different data, keep different state, fill
  from a template of their own or render on the server are controls written alike, and are not offered.
- \`content-attribute\` — a \`button\` or \`link\` whose children are only a \`text\` and/or a \`fontAwesome\`: its words
  are its own \`content\` and the icon its \`icon\`. What the text's class adds (\`white-space: nowrap\`) moves to the
  box's class — never the class itself; the icon's class goes in the \`icon\` slot.
- \`custom-css-class\`, \`custom-css-sdk-default\`, \`custom-css-notifications\` — \`customCss\` that a class's
  \`states\`/\`ancestors\`, the SDK (reduced motion, the theme toggle's icons) or the space's notification look says.
- \`heavy-animation\` — keyframes that animate a size, a position, a blur, a shadow, or a colour in a loop: they stutter
  while the page loads. Lighter, not shorter — see **Motion — good practices**.
- \`unused-class\`, \`unused-token\`, \`unused-component\` — declared and read by nothing: remove it
  (\`deleteDefinition\`, \`deleteStyleVariable\`, \`deleteComponent\`), or use it where it was meant to go. Said
  when a batch leaves one behind.
- \`element-color-inherited\` — the space's \`elements\` giving a type \`color: inherit\` or the page's own colour,
  which every element — a link's words included — takes by itself: remove it, and name the colour once on the page.
- \`literal-colour\` — a class painted from the palette typing out a token's light value: \`var(--token)\` when it
  should follow the scheme; a token of one value when it must stay the same in both.
\`plitzi://explain/<code>\` explains each. Take one unless the copies are about to diverge; one left on purpose is
quieted on an element it names — \`quiet: ["repeated-shape"]\` on \`upsertElement\`/\`patchElement\` (\`null\` removes it)
— and is not offered again, here, in the builder or in authoring. Suggestions' codes only.

## Readers: resources vs plitzi_search vs plitzi_read (do not confuse them)
Three ways to read, each for a different moment — pick by what you have in hand:
- **MCP resources** (the \`plitzi://…\` catalog above) — the **browsable index**. List them to discover what exists, or
  open one by URI when you are exploring. This is the passive catalog, not a tool.
- **\`plitzi_search\`** — you know *what* you want but not its **ref/uri** ("the hero button"). Search finds it by
  label/type/attribute and hands back the uri + stateVersion (and, with \`include:"detail"\`, the full element).
- **\`plitzi_read\`** — you **already hold one or more uris** (from search or a write response) and want their
  content in one batch. It is the tool form of opening resources, for when you have the addresses.
Rule of thumb: **discover → resources**, **find a name → plitzi_search**, **fetch known uris → plitzi_read**. Never
hand-build a URI to guess your way to an element — search for it instead.

Write tools return what **changed** (\`{ uri, stateVersion }\`) plus counts, and the **full detail of every element
they created or updated** — each with its own \`uri\` and \`stateVersion\` (\`elements: [...]\`) so a follow-up edit of
the same element needs **no intermediate read**. Other resources (pages, definitions, variables) still report only
uri+stateVersion — re-read them if you need their new content. The operation shapes are in each tool's input
schema (discriminated by \`type\`).

## Addressing
Every element and page has **one name, and that name is its id**. You choose it, you address it by it, and the
runtime wires by it — there is no second key and nothing to translate. Creating an element with
\`"ref": "products-api"\` stores it under exactly that.

That name is the **wiring key**: a provider registers its data source as \`<type>_<name>\`, so a \`source\` you write
against a name resolves to that element at runtime. Rules for a **new** name (both enforced; a violation fails the
batch):
- Charset \`[A-Za-z0-9_-]\`, **starting with a letter** and not ending in \`-\` (e.g. \`"products-api"\`, \`"food_item"\`). A \`.\` would split
  the \`<type>_<name>.<field>\` source path and the interaction target lookup, so **no dots**. An **underscore is
  allowed**: the FIRST \`_\` separates \`<type>\` from the name and element types are camelCase with none, so
  underscores inside a name are unambiguous (\`list_food_item\` → type \`list\`, name \`food_item\`).
- **Unique across the space**; a name that is taken is rejected (address the existing element instead).

**Never invent a name for something that already exists** — read it. Every read hands you the name back
(\`plitzi_search\`, a page skeleton, a write response), and that is the string every op takes.

**Where an element renders** is its \`runtime\`, settable on \`upsertElement\`/\`patchElement\`: \`"shared"\` (the
default, both sides), \`"client"\` (browser only) or \`"server"\` (SSR only). It matters for one thing above all — an
\`apiContainer\` reads through a **connector** only when it is \`"server"\` (see *Connectors*). An element read
reports it only when it is set. The page server resolves \`"server"\` elements of a page and its layouts only, never
inside a component — one there is refused; put the provider on the page and hand the component its rows as a prop.

**Renaming** (\`patchElement\` with \`rename\`) moves the one key: the parent's child list, every binding source and
every interaction target across the space that named the old one is repointed with it, so nothing comes unwired.
You do not have to rewrite them.

## Elements — create, move, delete
- \`upsertElement\` creates an element (or replaces one by name) under \`parentRef\` — the page root when omitted — and
  builds a whole subtree in one op through nested \`children\`. \`patchElement\` changes an existing one in place.
- \`moveElement { pageRef, ref, toParentRef, position }\` moves or reorders one: \`position\` \`"inside"\` (the default)
  nests it in \`toParentRef\`; \`"before"\`/\`"after"\` make it that element's sibling. Its subtree moves with it.
- \`deleteElement { pageRef, ref }\` removes an element **and everything under it**. A binding or an interaction
  elsewhere that named one of them is left pointing at nothing, and the save reports it — delete them in the same
  batch. Destructive: confirm first.
- \`flag\` on \`upsertElement\` / \`patchElement\` gates an element on a feature flag (\`"newCheckout"\` or
  \`"!newCheckout"\`) — not a visibility: gated off it is not rendered at all. See **Feature flags**.
- **A compound element is written with its parts**, as \`children\` of the same \`upsertElement\`: a \`carousel\` holds a
  \`carouselTrack\` (the slides go in it), a \`tabContainer\` a \`tabContainerHeader\` and a \`tabContainerBody\`, a
  \`dropdown\` a \`dropdownPopup\`. Without its part it shows nothing (\`part-missing\`); a part anywhere else breaks the
  page (\`outside-ancestor\`).

`;
