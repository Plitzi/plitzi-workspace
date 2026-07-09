export const workflowSegmentsResource = {
  uri: 'plitzi://workflows/segments',
  name: 'Plitzi Workflow: Segments',
  description: 'Step-by-step guide for creating and populating reusable segment templates.',
  mimeType: 'text/markdown',
  content: `# Workflow: Working with Segments

A segment is a reusable UI template with its own isolated schema and style.
It is NOT placed on a page directly — it is defined once and referenced by elements across the space.

## Create a segment and populate it

1. Call \`create_segment\`:
   \`\`\`json
   { "name": "Product Card", "description": "Reusable card for product listings" }
   \`\`\`
   The response contains:
   - \`id\` — segment ID (used by all subsequent segment calls)
   - \`definition.baseElementId\` — the root element ID inside the segment

2. Add elements to the segment root using \`create_segment_element\`:
   \`\`\`json
   { "segmentId": "<id>", "element": { "type": "container", "label": "Card" }, "parentId": "<baseElementId>" }
   \`\`\`

3. Nest elements inside by using the returned element \`id\` as the next \`parentId\`:
   \`\`\`json
   { "segmentId": "<id>", "element": { "type": "text", "label": "Title" }, "parentId": "<cardId>" }
   \`\`\`

4. Style segment elements the same way as page elements:
   - Get the element's \`definition.styleSelectors\` from the \`create_segment_element\` response.
   - Call \`update_style_selector\` with the selector and CSS rules.

5. For segment-scoped design tokens (not shared with the space), use \`create_segment_style_variable\`.

## Update segment metadata

\`update_segment\` — rename the segment or update its description.

## Delete a segment

\`delete_segment\` removes the segment, its entire schema, and its style. Cannot be undone.
Always confirm with the user before calling this.

## Segment variables

Segments can have their own typed variables (scoped to the segment):
- \`create_segment_variable\` — add a variable to the segment.
- \`update_segment_variable\` / \`delete_segment_variable\` — manage existing ones.
`
};
