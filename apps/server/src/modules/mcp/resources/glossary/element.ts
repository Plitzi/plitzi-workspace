export const elementResource = {
  uri: 'plitzi://docs/element',
  name: 'Plitzi Docs: Element',
  description: 'A single UI component instance in a Plitzi page — the building block of every schema.',
  mimeType: 'text/markdown',
  content: `# Element

An \`Element\` is a single instance of a UI component in a Plitzi page. Every visual item — pages, containers, text blocks, forms, images — is an element. The entire page tree is stored as a flat dictionary of elements keyed by ID.

## TypeScript Shape

\`\`\`typescript
type Element<TAttributes = Record<string, unknown>> = {
  id: string;
  attributes: TAttributes & { subType?: string };  // Component-specific configuration
  definition: ElementDefinition;
};

type ElementDefinition = {
  rootId: string;            // ID of the page/root element this belongs to
  label: string;             // Human-readable name shown in the builder
  type: string;              // Element type identifier (e.g. 'container', 'text', 'image')
  parentId?: string;         // ID of the parent element (undefined = root)
  items?: string[];          // Ordered array of child element IDs
  styleSelectors: {
    base: string;            // Always present — the primary CSS class
    [key: string]: string;   // Additional sub-selectors (e.g. 'header', 'body', 'icon')
  };
  bindings?: Partial<Record<'attributes' | 'style' | 'initialState', ElementBinding[]>>;
  interactions?: Record<string, ElementInteraction>;
  initialState?: {
    styleVariant?: Record<string, Record<string, string | string[]>>;
    styleSelectors?: ElementDefinition['styleSelectors'];
    visibility?: boolean;
    [key: string]: unknown;
  };
  runtime?: 'server' | 'client' | 'shared';    // RSC render target
  loadStrategy?: 'eager' | 'lazy' | 'visible'; // When to load/render
};
\`\`\`

## Key Properties

- **\`id\`** — unique identifier, used as the key in \`schema.flat\`.
- **\`attributes\`** — component-specific data (text content, URLs, settings). Shape varies by plugin type. \`subType\` selects a variant within the same plugin.
- **\`definition.type\`** — element type identifier that determines which component renders this element. Get valid values from \`get_builder_context\` (\`elementDefaults\` keys) or from the \`type\` field of existing elements in \`get_schema\`. This is NOT the plugin name from \`list_plugins\`.
- **\`definition.parentId\`** — parent element ID. Elements without \`parentId\` are root elements (pages).
- **\`definition.items\`** — ordered child IDs. Walk the tree by following \`items\` recursively.
- **\`definition.styleSelectors\`** — maps named selector slots to actual CSS class strings from the \`Style\`. \`base\` is always present.
- **\`definition.bindings\`** — data bindings that dynamically overwrite \`attributes\`, \`style\`, or \`initialState\` fields at runtime.
- **\`definition.interactions\`** — event handlers (onClick, onChange, etc.) mapping to configured actions.
- **\`definition.rootId\`** — always points to the page element this element belongs to.

## Relationships

- All elements live in \`schema.flat[id]\`.
- Parent–child links: \`definition.parentId\` (up) and \`definition.items\` (down).
- Style data for each element is found in \`style.platform[displayMode][styleSelector]\`.
- **Segment** elements have their own \`schema.flat\` but follow the same structure.

## Page Elements

A page is an element whose type corresponds to a page plugin. Its ID appears in \`schema.pages\`. Pages are the top-level roots; they have no \`parentId\` and their \`rootId\` points to themselves.
`
};
