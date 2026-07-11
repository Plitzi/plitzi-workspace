// Shown in the MCP initialize result — the first thing an agent sees. Keep it short; the full reference is
// plitzi://guide.
export const serverInstructions =
  'Plitzi AI server: read-then-write editing of a Plitzi space. Reads follow a filesystem model — list cheap, ' +
  'read one item in detail on demand; never fetch a whole tree you do not need. Workflow: (1) read ' +
  'plitzi://primer/{env} once — it bundles the guide, types, css-properties and page/definition/variable ' +
  'summaries in a single call; (2) plitzi_search to jump to elements (each hit already carries its uri + ' +
  'stateVersion, so no follow-up read is needed to edit); open a page skeleton or element only when you need ' +
  'its tree/detail; (3) plitzi_apply with dryRun to preview a batch; (4) plitzi_apply to persist, passing ' +
  'expectedResourceVersions to guard against concurrent edits — apply and search both hand back the versions ' +
  'you need for the next edit. Use patchElement / patchDefinition to change only some props / CSS (the upsert ' +
  'variants replace them all). An element read (and search include:"detail") inlines the CSS of the definitions ' +
  'it attaches under resolvedStyle, so you rarely need a separate definition read. ' +
  'Refs accept a semantic aiRef or the raw id. CSS is kebab-case (shorthands like border/padding are accepted); ' +
  'style vars are var(--name), schema vars are {{name}}.';

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
- \`plitzi://types\` — element types **observed in this space** (ground truth): props, slots, subTypes.
- \`plitzi://css-properties\` — valid kebab-case CSS property keys.
- \`plitzi://schema/{env}/pages\` — page **summaries** (ref, label, elementCount). No element trees.
- \`plitzi://schema/{env}/pages/{ref}\` — one page as a **skeleton tree** (ref/type/label/children), no props/style.
- \`plitzi://schema/{env}/elements/{ref}\` — one element in **full detail** (props, style, parentRef, childRefs).
  Its \`resolvedStyle\` inlines the **CSS of every definition** the element attaches (keyed by class ref), so you
  can see and edit its style without a separate definition read. Its \`globalStyles\` lists the **global element
  selectors** that also affect it (the CSS equivalent of \`button { … }\`, keyed by the type they target) — every
  element of that type inherits them. Edit a global only through the global-style tools (never per element).
- \`plitzi://definitions/{env}\` — the **names** of every style definition.
- \`plitzi://definitions/{env}/{ref}\` — one definition's CSS.
- \`plitzi://global-styles/{env}\` — element **types** that have a site-wide global style. \`/{componentType}\` for one.
- \`plitzi://style-variables/{env}\` — design tokens by category. \`/{category}\` for one.
- \`plitzi://schema-variables/{env}\` — space-level values referenced in props as \`{{name}}\`.

The style resources also answer under the \`plitzi://schema/{env}/…\` root as aliases — \`plitzi://schema/{env}/definitions/{ref}\`, \`plitzi://schema/{env}/style-variables/{category}\`, \`plitzi://schema/{env}/schema-variables\` — but prefer the ready-made \`uri\` from search / a write response over hand-building either form.

Data resources return \`{ stateVersion, data }\`. Keep \`stateVersion\` for optimistic concurrency.

## Navigating (files analogy)
Pages and containers are folders; elements are files. To find something: list pages → open a page skeleton →
read the specific element. Or use \`plitzi_search\` to jump straight to elements by label/type/attribute — each hit
already carries the element's \`uri\`, \`stateVersion\`, \`pageUri\`, \`parentRef\` and tree \`path\`, so you can edit it
(with optimistic concurrency) **without a follow-up read**. Pass \`include: "detail"\` to also inline each hit's
props/style **and** its \`resolvedStyle\` (the CSS behind its classes). Search also returns any **style definitions**
whose name matches the query, with their full CSS, under \`definitions\` — so finding a class by name needs no read.

## Tools (write)
- \`plitzi_validate\` — check a batch, returns teachable errors/warnings. Writes nothing.
- \`plitzi_apply\` — validate → apply → persist atomically. Rejects the whole batch on any error or conflict. Pass
  \`dryRun: true\` to apply in memory only and get the same result back (changed versions + full element detail)
  without persisting — inspect it, then re-run without \`dryRun\` to commit.
- \`plitzi_search\` — find elements across pages.

Write tools return what **changed** (\`{ uri, stateVersion }\`) plus counts, and the **full detail of every element
they created or updated** — each with its own \`uri\` and \`stateVersion\` (\`elements: [...]\`) so a follow-up edit of
the same element needs **no intermediate read**. Other resources (pages, definitions, variables) still report only
uri+stateVersion — re-read them if you need their new content. The operation shapes are in each tool's input
schema (discriminated by \`type\`).

## Addressing
Refs are a semantic \`aiRef\` you choose (e.g. \`"hero.cta"\`) or the element's **raw id**. Both always resolve, so
schemas predating aiRef keep working through ids. Creating an element stores its \`ref\` as the aiRef.

## Styling (crosses both schemas)
- A definition lives in the **style schema**; an element's \`style.base\` (element schema) is the link that applies
  it. Styling an element = upsertDefinition + upsertElement with that ref in \`style.base\`, in one batch.
- CSS keys are **kebab-case** (\`background-color\`). camelCase is rejected — read \`plitzi://css-properties\`.
- Common **shorthands are accepted** and expanded for you: \`border\`, \`border-{side}\`, \`border-radius\`,
  \`padding\`, \`margin\`, \`inset\`, \`gap\` (they persist as their longhand keys).
- CSS is grouped by breakpoint: \`desktop\`, \`tablet\`, \`mobile\`.
- Reference a style variable in CSS as \`var(--name)\`; a schema variable in a prop as \`{{name}}\`.
- \`element.style.base\` is a list of definition refs; other slots go under \`element.style.slots\`.
- **Two kinds of style live in the style schema — do not confuse them:**
  - **Definitions** = reusable CSS **classes** (\`upsertDefinition\`/\`patchDefinition\`/\`deleteDefinition\`, keyed by a
    class \`ref\`). Attach one to an element via \`style.base\` to style **that** element (and anything else that opts in).
  - **Global styles** = the CSS equivalent of a bare element selector like \`button { … }\`
    (\`upsertGlobalStyle\`/\`patchGlobalStyle\`/\`deleteGlobalStyle\`, keyed by \`componentType\`). They style **every**
    element of that type at once. Use these for site-wide intent — e.g. "all buttons rounded":
    \`{ "type": "upsertGlobalStyle", "componentType": "button", "desktop": { "border-radius": "9999px" } }\`.
  - The two share one name space, so a class op refuses a name held by a global and vice-versa (guards against a
    typo silently rewriting every element of a type). If refused, you targeted the wrong kind — switch tools or
    rename. To style one element only, never reach for a global.

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
