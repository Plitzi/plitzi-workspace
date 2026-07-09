export const collectionResource = {
  uri: 'plitzi://docs/collection',
  name: 'Plitzi Docs: Collection',
  description: 'A CMS-style data store in Plitzi — a typed set of records with configurable fields.',
  mimeType: 'text/markdown',
  content: `# Collection

A **Collection** is a CMS-style data store inside a Plitzi space. It has a defined field schema and holds typed records. Collections are used to manage dynamic content (blog posts, product listings, team members, etc.) that elements can bind to via data sources.

## TypeScript Shape

\`\`\`typescript
type Collection = {
  id: string;
  name: string;              // Singular name (e.g. 'Post')
  namePlural: string;        // Plural name (e.g. 'Posts')
  description: string;
  privacy: 'public' | 'private';
  fields: Record<string, CollectionField>;   // Field schema keyed by field ID
  records: CollectionRecord[];
};

type CollectionField = {
  id: string;
  name: string;              // Human-readable label
  machineName: string;       // Programmatic key used in record values
  type:
    | 'text' | 'richText' | 'image' | 'multiImage'
    | 'video' | 'link' | 'email' | 'phone'
    | 'number' | 'date' | 'switch' | 'color'
    | 'option' | 'file';
  params: {
    primary: boolean;        // Whether this is the display/title field
    required: boolean;
  };
};

type CollectionRecord = {
  id: string;
  values: Record<string, string | number | boolean>;  // Keyed by field machineName
  status: 'draft' | 'published' | 'archived';
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
};
\`\`\`

## Key Properties

- **\`fields\`** — the schema of the collection. Each field has a \`machineName\` which is the key used in \`record.values\`.
- **\`CollectionField.type\`** — determines the data type and editor widget. Use \`richText\` for HTML content, \`image\` for single image uploads.
- **\`CollectionField.params.primary\`** — marks the main display field (title/name). Used in lists and pickers.
- **\`CollectionRecord.values\`** — the actual record data, keyed by \`field.machineName\`.
- **\`CollectionRecord.status\`** — content lifecycle. Only \`published\` records are visible in production.

## Relationships

- Elements can bind to collection data via **Bindings** (data source type \`collection\`).
- Collections belong to a **Space** and are available across all environments.

## Common Operations

- \`get_collections\` — list all collections in the space.
- \`get_collection\` — get a collection with its field schema.
- \`create_collection\` — define a new content type.
- \`update_collection\` — rename or modify a collection.
- \`delete_collection\` — remove collection and all records.
- \`get_collection_records\` — fetch records (optionally filtered by status).
- \`create_collection_record\` — add a new record.
- \`update_collection_record\` — edit an existing record.
- \`delete_collection_record\` — remove a record.
`
};
