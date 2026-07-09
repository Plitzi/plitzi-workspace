export const pageResource = {
  uri: 'plitzi://docs/page',
  name: 'Plitzi Docs: Page',
  description: 'A top-level page in a Plitzi space — a root element whose ID appears in schema.pages.',
  mimeType: 'text/markdown',
  content: `# Page

A **Page** in Plitzi is a root-level element. It is stored in \`schema.flat\` like any other element, but its ID is listed in \`schema.pages\` to identify it as a navigable page. Pages are the containers that hold all other elements.

## Structure

Pages are regular \`Element\` objects:

\`\`\`typescript
// A page element in schema.flat
{
  id: 'page-abc123',
  attributes: { title: 'Home', slug: '/' },  // Page-specific attributes
  definition: {
    rootId: 'page-abc123',    // Points to itself — pages are their own root
    label: 'Home',
    type: 'page',             // Type matches the page plugin identifier
    items: ['section-1', 'section-2'],  // Top-level child elements
    styleSelectors: { base: '.page-home' }
    // No parentId — pages have no parent
  }
}

// Referenced in schema.pages
schema.pages = ['page-abc123', 'page-def456', ...]
\`\`\`

## Key Properties

- **\`schema.pages\`** — ordered array of page element IDs. The order controls navigation/sidebar ordering.
- **\`definition.rootId === id\`** — a page's \`rootId\` always points to itself.
- **\`definition.parentId\`** — absent (undefined) for pages; they are top-level.
- **\`attributes.slug\`** — the URL path segment for this page (e.g. \`/about\`).

## Page Folders

Pages can be organized into **page folders** (\`schema.pageFolders\`):

\`\`\`typescript
type PageFolder = {
  id: string;
  name: string;
  slug: string;
  parentId?: string;  // Nested folders supported
};
\`\`\`

Folders only affect visual organization in the builder sidebar — they do not affect routing.

## Relationships

- Pages are a special-case of **Element** — same structure, just listed in \`schema.pages\`.
- All child elements are regular elements in \`schema.flat\`, linked via \`definition.parentId\` / \`definition.items\`.

## Common Operations

- \`create_page\` — add a new page element.
- \`update_page\` — rename or modify a page.
- \`delete_page\` — remove a page and all its children.
- \`create_page_folder\` / \`update_page_folder\` / \`delete_page_folder\` — manage page folder hierarchy.
`
};
