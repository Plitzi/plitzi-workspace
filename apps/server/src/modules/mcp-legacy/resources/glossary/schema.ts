export const schemaResource = {
  uri: 'plitzi://docs/schema',
  name: 'Plitzi Docs: Schema',
  description: 'Core data structure of a Plitzi space — holds all pages, elements, variables, and settings.',
  mimeType: 'text/markdown',
  content: `# Schema

The \`Schema\` is the primary data structure of a Plitzi space. It is a serializable, flat representation of the entire page tree plus global configuration.

## TypeScript Shape

\`\`\`typescript
type Schema = {
  flat: Record<string, Element>;           // All elements keyed by their ID
  definition: {
    name: string;                          // Human-readable space name
    permanentUrl: string;                  // URL slug (e.g. "my-app")
  };
  variables: SchemaVariable[];             // Space-level dynamic variables
  settings: {
    keepState?: boolean;
    stateStorage?: 'localStorage' | 'sessionStorage';
    customCss: string;
    userProvider?: 'auth0' | 'basic' | 'custom' | '';
    auth0Domain?: string;
    auth0ClientId?: string;
    tokenStorage?: 'localStorage' | 'sessionStorage' | '';
    loginUrl?: string;
    userUrl?: string;
    refreshUrl?: string;
    logoutUrl?: string;
    detailsPath?: string;
    tokenPath?: string;
    expirationTimePath?: string;
  };
  rsc?: {
    enabled?: boolean;
    transport?: 'json' | 'stream';
    path?: string;                         // Defaults to '/_rsc'
  };
  pages: string[];                         // Ordered list of root page element IDs
  pageFolders: PageFolder[];               // Hierarchical page organization
};
\`\`\`

## Key Properties

- **\`flat\`** — the entire element tree as a dictionary. Every element (page, container, component) lives here. Children are referenced by IDs stored in \`definition.items\`.
- **\`pages\`** — ordered list of element IDs for the top-level pages. The elements themselves are in \`flat\`.
- **\`pageFolders\`** — hierarchical folder structure for organizing pages in the builder sidebar.
- **\`variables\`** — schema-level variables that can be injected into elements via bindings.
- **\`settings\`** — authentication provider configuration (Auth0, basic, custom token), state persistence, and custom global CSS.
- **\`rsc\`** — optional React Server Components configuration.

## Relationships

- Contains **Element** objects in \`flat\`.
- Contains **SchemaVariable** entries in \`variables\`.
- Paired with a **Style** object that holds all CSS for the same space/environment.
- Each **Segment** also has its own \`schema\` with the same structure but scoped to the segment.

## Environments

Each environment (\`main\`, \`development\`, \`staging\`, \`production\`) can have an independent schema snapshot. The \`main\` environment is the live working copy.
`
};
