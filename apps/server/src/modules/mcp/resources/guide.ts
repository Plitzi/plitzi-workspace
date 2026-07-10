// Shown in the MCP initialize result — the first thing an agent sees. Keep it short; the full reference is
// plitzi://guide.
export const serverInstructions =
  'Plitzi AI server: read-then-write editing of a Plitzi space. Reads follow a filesystem model — list cheap, ' +
  'read one item in detail on demand; never fetch a whole tree you do not need. Workflow: (1) skim plitzi://guide ' +
  'and plitzi://types; (2) list plitzi://schema/{env}/pages, open one page skeleton, then read individual ' +
  'elements/definitions as needed, keeping their stateVersion; (3) plitzi_apply with dryRun to see what a batch ' +
  'changes without committing; (4) plitzi_apply to persist, passing expectedResourceVersions to guard against ' +
  'concurrent edits. ' +
  'Element and page refs accept a semantic aiRef or the raw id. CSS is kebab-case; style vars are var(--name), ' +
  'schema vars are {{name}}.';

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
- \`plitzi://guide\` — this guide.
- \`plitzi://types\` — element types **observed in this space** (ground truth): props, slots, subTypes.
- \`plitzi://css-properties\` — valid kebab-case CSS property keys.
- \`plitzi://schema/{env}/pages\` — page **summaries** (ref, label, elementCount). No element trees.
- \`plitzi://schema/{env}/pages/{ref}\` — one page as a **skeleton tree** (ref/type/label/children), no props/style.
- \`plitzi://schema/{env}/elements/{ref}\` — one element in **full detail** (props, style, parentRef, childRefs).
- \`plitzi://definitions/{env}\` — the **names** of every style definition.
- \`plitzi://definitions/{env}/{ref}\` — one definition's CSS.
- \`plitzi://style-variables/{env}\` — design tokens by category. \`/{category}\` for one.
- \`plitzi://schema-variables/{env}\` — space-level values referenced in props as \`{{name}}\`.

Data resources return \`{ stateVersion, data }\`. Keep \`stateVersion\` for optimistic concurrency.

## Navigating (files analogy)
Pages and containers are folders; elements are files. To find something: list pages → open a page skeleton →
read the specific element. Or use \`plitzi_search\` to jump straight to elements by label/type/attribute.

## Tools (write)
- \`plitzi_validate\` — check a batch, returns teachable errors/warnings. Writes nothing.
- \`plitzi_apply\` — validate → apply → persist atomically. Rejects the whole batch on any error or conflict. Pass
  \`dryRun: true\` to apply in memory only and get the same result back (changed versions + full element detail)
  without persisting — inspect it, then re-run without \`dryRun\` to commit.
- \`plitzi_search\` — find elements across pages.

Write tools return what **changed** (\`{ uri, stateVersion }\`) plus counts, and the **full detail of every element
they created or updated** (\`elements: [...]\`) so you have the applied result without a follow-up read. Other
resources (pages, definitions, variables) still report only uri+stateVersion — re-read them if you need their new
content. The operation shapes are in each tool's input schema (discriminated by \`type\`).

## Addressing
Refs are a semantic \`aiRef\` you choose (e.g. \`"hero.cta"\`) or the element's **raw id**. Both always resolve, so
schemas predating aiRef keep working through ids. Creating an element stores its \`ref\` as the aiRef.

## Styling (crosses both schemas)
- A definition lives in the **style schema**; an element's \`style.base\` (element schema) is the link that applies
  it. Styling an element = upsertDefinition + upsertElement with that ref in \`style.base\`, in one batch.
- CSS keys are **kebab-case** (\`background-color\`). camelCase is rejected — read \`plitzi://css-properties\`.
- CSS is grouped by breakpoint: \`desktop\`, \`tablet\`, \`mobile\`.
- Reference a style variable in CSS as \`var(--name)\`; a schema variable in a prop as \`{{name}}\`.
- \`element.style.base\` is a list of definition refs; other slots go under \`element.style.slots\`.

## Semantics
- **props are fully replaced** on \`upsertElement\`: send every prop you want to keep.
- **Atomic batches**: if any operation fails, \`plitzi_apply\` persists nothing.
- **Optimistic concurrency**: pass \`expectedResourceVersions\` (URI → the stateVersion you read). If the live data
  drifted, apply is rejected with a conflict; re-read the reported resources and retry.
`;
