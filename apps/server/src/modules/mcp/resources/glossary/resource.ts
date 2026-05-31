export const resourceResource = {
  uri: 'plitzi://docs/resource',
  name: 'Plitzi Docs: Resource',
  description:
    'A CDN-stored file in a Plitzi space — images, videos, documents, plugins, and templates uploaded to cloud storage.',
  mimeType: 'text/markdown',
  content: `# Resource

A **Resource** is a file stored on a CDN (AWS S3 or Cloudflare R2) and associated with a Plitzi space. Resources include images, videos, documents, application files, plugin bundles, and page templates.

## TypeScript Shape

\`\`\`typescript
type ResourceType = 'image' | 'video' | 'document' | 'application' | 'plugin' | 'template';

type Resource = {
  id: string;              // Storage key (S3/R2 object path)
  cdnIdentifier: string;   // Which CDN configuration to use
  name: string;            // Display filename
  path: string;            // Full public CDN URL
  type: ResourceType;
  size: number;            // File size in bytes
  metadata?: PluginManifest;  // Present when type === 'plugin' or 'template'
};

type Cdn = {
  identifier: string;
  name: string;
  domain: string;
  provider: 's3' | 'r2';
  region: string;
  endpoint?: string;       // Custom endpoint for R2 / S3-compatible storage
  bucketName: string;
  prefix: string;
  credential?: SpaceCredential;
  createdAt: number;
  updatedAt: number;
};
\`\`\`

## Resource Types

| Type | Description |
|---|---|
| \`image\` | PNG, JPEG, GIF, WebP, SVG |
| \`video\` | MP4, WebM, OGG |
| \`document\` | PDF, Word, Excel, etc. |
| \`application\` | Generic binary files |
| \`plugin\` | Plugin JS bundles — \`metadata\` contains \`PluginManifest\` |
| \`template\` | Page template presets — \`metadata\` contains \`PluginManifest\` |

## Key Properties

- **\`id\`** — the storage object path (e.g. \`images/hero.jpg\`). Used together with \`cdnIdentifier\` to address the file.
- **\`cdnIdentifier\`** — references a configured CDN (the space can have multiple CDNs).
- **\`path\`** — the full public URL to use in \`<img src>\`, CSS \`url()\`, etc.
- **\`metadata\`** — only present for \`plugin\` and \`template\` types; contains the \`PluginManifest\`.

## Relationships

- Resources are managed at the **Space** level and shared across all environments.
- **Plugin** resources (type \`plugin\`) power the component library.
- Elements reference image/video resources via \`attributes\` (e.g. \`element.attributes.src\`).

## Common Operations

- \`get_resources\` — list all resources, optionally filtered by type or CDN.
- \`get_resource\` — fetch a single resource by \`id\` and \`cdnIdentifier\`.
- \`add_resource\` — upload a file from a URL to the CDN.
- \`move_resource\` — relocate a resource to a different CDN prefix/folder.
- \`remove_resource\` — delete a resource from the CDN.
`
};
