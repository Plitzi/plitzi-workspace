export const workflowDataResource = {
  uri: 'plitzi://workflows/data',
  name: 'Plitzi Workflow: Data',
  description: 'Step-by-step guide for schema variables, collection records, and data bindings.',
  mimeType: 'text/markdown',
  content: `# Workflow: Data — Variables, Collections, Bindings

## Schema variables (space-level named values)

Variables are typed, named values that elements can bind to.

1. Create a variable with \`create_variable\`:
   \`\`\`json
   { "variable": { "name": "heroTitle", "type": "text", "value": "Welcome", "category": "Content" } }
   \`\`\`
2. Update it with \`update_variable\` (identified by name).
3. Delete with \`delete_variable\` — any element bindings referencing it will break.

## Collection records (CMS data)

1. List collections: \`get_collections\` → pick the target \`id\`.
2. Inspect the collection's field definitions: \`get_collection\` → \`fields\`.
3. Create a record with \`create_collection_record\`:
   \`\`\`json
   { "collectionId": "<id>", "values": { "title": "My Product", "price": 99 }, "status": "published" }
   \`\`\`
4. Update a record with \`update_collection_record\` (by \`recordId\`).
5. List records with \`get_collection_records\` — supports optional \`filter\` and \`limit\`.

## Bindings (connecting data to elements)

A binding maps a data source (variable or collection field) to an element's attribute or style at runtime.
Read \`plitzi://docs/binding\` for the full binding structure before working with bindings.

General flow:
1. Ensure the variable or collection exists.
2. Get the target element via \`get_element\` to inspect its current \`definition.bindings\`.
3. Use \`update_element\` with the updated \`props\` that include the binding reference.

## Reading the current state

- \`get_schema\` → \`variables\` — all space-level variables with types and values.
- \`get_collections\` — all collections in the space.
- \`get_collection_records\` — records from a specific collection.
`
};
