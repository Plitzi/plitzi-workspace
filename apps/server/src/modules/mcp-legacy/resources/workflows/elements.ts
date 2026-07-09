export const workflowElementsResource = {
  uri: 'plitzi://workflows/elements',
  name: 'Plitzi Workflow: Elements',
  description: 'Step-by-step guide for adding, nesting, moving, and removing elements on a page.',
  mimeType: 'text/markdown',
  content: `# Workflow: Working with Elements

## Add an element to a page

1. Get the target page ID:
   - \`get_builder_context\` → \`currentPageId\` (active page in the builder), OR
   - \`get_schema\` → \`pages[]\` (all page IDs)
2. Get valid element types: \`get_builder_context\` → \`elementDefaults\` keys.
3. Call \`create_element\`:
   \`\`\`json
   { "element": { "type": "container", "label": "Hero" }, "parentId": "<pageId>" }
   \`\`\`
4. The response contains the created element with \`definition.styleSelectors\` (e.g. \`{ "base": ".el-abc123" }\`).
5. Use those selectors to style the element → see **plitzi://workflows/styles**.

## Nest elements (container → children)

Repeat \`create_element\` using the container's \`id\` as \`parentId\`:
\`\`\`json
{ "element": { "type": "text", "label": "Heading" }, "parentId": "<containerId>" }
\`\`\`

## Read the current element tree

- \`get_schema\` → \`flat\` — full map of all elements keyed by ID, with \`definition.parentId\` and \`definition.items\`.
- \`list_elements\` — lighter; returns id, label, type, parentId for every element.
- \`get_element\` — full detail for a single element (attributes, bindings, interactions).

## Move an element

\`move_element\` with \`elementId\`, \`toParentId\`, and \`dropPosition\`:
- \`"inside"\` — appends as last child of the target (default).
- \`"top"\` / \`"bottom"\` — inserts before/after the target's siblings.

## Update an element

\`update_element\` — change \`label\`, \`props\` (component attributes), or \`runtime\`.
For style changes use \`update_style_selector\`, not \`props\`.

## Delete an element

\`delete_element\` removes the element and all its descendants. This cannot be undone.
Always confirm with the user before calling this.
`
};
