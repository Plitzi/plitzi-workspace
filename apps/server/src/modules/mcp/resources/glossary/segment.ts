export const segmentResource = {
  uri: 'plitzi://docs/segment',
  name: 'Plitzi Docs: Segment',
  description: 'A reusable UI template in Plitzi — a named, versioned component group with its own schema and style.',
  mimeType: 'text/markdown',
  content: `# Segment

A **Segment** is a reusable UI template. It encapsulates a sub-tree of elements with its own isolated schema and style. Segments can be embedded inside pages and reused across the space. Think of them as design-system components built visually.

## TypeScript Shape

\`\`\`typescript
type Segment = {
  id: string;
  identifier: string;           // Unique string key (e.g. 'hero-banner')
  definition: {
    name: string;               // Human-readable display name
    description: string;
    baseElementId: string;      // Root element ID within segment.schema.flat
  };
  environment: Environment;     // 'main' | 'development' | 'staging' | 'production'
  schema: Schema;               // The segment's own element tree
  style: Style;                 // The segment's own CSS definitions
};
\`\`\`

## Key Properties

- **\`identifier\`** — the stable string ID used to reference this segment when embedding it in pages.
- **\`definition.baseElementId\`** — the ID of the root element inside \`segment.schema.flat\`. This is the entry point when the segment is rendered.
- **\`schema\`** — a full \`Schema\` object scoped to the segment. Contains the element sub-tree in \`flat\`.
- **\`style\`** — a full \`Style\` object scoped to the segment. CSS is isolated from the space style.
- **\`environment\`** — each environment has an independent version of the segment.

## Isolation

Segment schema and style are completely isolated from the space schema/style. This means:
- Style selectors in a segment do not conflict with space-level selectors.
- Variables inside a segment are scoped to the segment.
- When a segment is updated and published, all pages using it pick up the new version.

## Relationships

- A **Segment** contains a **Schema** and a **Style** just like a space.
- Elements inside the segment follow the same **Element** structure.
- Segments reference **Environment** for versioning.

## Common Operations

- \`create_segment\` — create a new segment definition.
- \`update_segment\` — rename or update description.
- \`delete_segment\` — remove a segment.
- \`create_segment_element\` / \`update_segment_element\` / \`delete_segment_element\` — manage elements inside.
- \`create_segment_variable\` / \`update_segment_variable\` / \`delete_segment_variable\` — manage schema variables inside.
`
};
