export const spaceResource = {
  uri: 'plitzi://docs/space',
  name: 'Plitzi Docs: Space',
  description: 'A Plitzi project workspace — the top-level container for schema, style, plugins, segments, collections, and deployments.',
  mimeType: 'text/markdown',
  content: `# Space

A **Space** is the top-level container of a Plitzi project. It holds everything: the page structure (schema), styling (style), plugins, segments, collections, CDN resources, and deployment configurations.

## TypeScript Shape (partial)

\`\`\`typescript
type Space = {
  id: number;
  name: string;
  permanentUrl: string;           // URL slug identifying the space
  verified: boolean;              // Whether the custom domain is verified
};

type SpaceDeployment = {
  id: number;
  environment: Environment;       // 'production' | 'staging' | 'development' | 'main'
  revision: number | null;
  domain: string;
  isVerified: boolean;
  default: boolean;
  credential: SpaceCredential | null;  // Cloud storage credential for deployment
  createdAt: number;
  updatedAt: number;
};

type SpaceCredential = {
  identifier: string;
  name: string;
  provider: 's3' | 'r2' | 'ssr';
  inUse: boolean;
  usedIn: { usedFrom: string; name: string }[];
  createdAt: number;
  updatedAt: number;
};
\`\`\`

## Key Concepts

- **\`permanentUrl\`** — a stable URL slug (e.g. \`my-app\`) that identifies the space. Also stored in \`schema.definition.permanentUrl\`.
- **Environments** — each space has up to 4 environments: \`main\` (working copy), \`development\`, \`staging\`, \`production\`. Each has its own schema, style, and deployment.
- **\`SpaceDeployment\`** — maps an environment to a public domain and cloud storage credential for publishing.
- **\`SpaceCredential\`** — AWS S3 or Cloudflare R2 credentials used to store published assets.

## Relationships

- A space has one **Schema** and one **Style** per environment.
- A space owns all **Segments**, **Collections**, and **Resources** (CDN files).
- A space has installed **Plugins**.
- The \`main\` environment is always the live editing copy; publishing copies it to \`production\` (or another target environment).

## Settings

Space-level settings live in \`schema.settings\` and control:
- Authentication provider (Auth0, basic JWT, custom token endpoint)
- State persistence (localStorage vs. sessionStorage)
- Custom global CSS

## Common Operations

- \`list_spaces\` — list all accessible spaces.
- \`publish_space\` — publish \`main\` environment to a target environment.
- \`update_space_settings\` — modify \`schema.settings\` fields.
`
};
