export const environmentResource = {
  uri: 'plitzi://docs/environment',
  name: 'Plitzi Docs: Environment',
  description: 'Deployment environments in Plitzi — main (working copy), development, staging, and production.',
  mimeType: 'text/markdown',
  content: `# Environment

An **Environment** in Plitzi is a named version of a space's schema, style, and segments. Each environment can be published independently to its own domain.

## Type

\`\`\`typescript
type Environment = 'production' | 'staging' | 'development' | 'main';
\`\`\`

## Environments

| Environment | Purpose |
|---|---|
| \`main\` | The live editing/working copy. Always present. All builder changes apply here. |
| \`development\` | Internal preview environment. Used for QA before staging. |
| \`staging\` | Pre-production review. Shown to stakeholders before going live. |
| \`production\` | The public-facing live site. Published from \`main\` when changes are ready. |

## Key Behaviors

- **All builder operations target \`main\`** unless explicitly scoped to another environment.
- Publishing copies the \`main\` schema/style to the target environment (e.g. \`production\`).
- Each environment can have a different domain and CDN deployment.
- Segments are also versioned per environment.

## In API and Tools

Most MCP tools accept an \`environment\` parameter (defaults to \`main\`) that scopes the read/write operation:

\`\`\`typescript
// Example: get schema for the staging environment
getSchema({ environment: 'staging' })
\`\`\`

## AI Context

The \`AiContext.environment\` field tells the AI agent which environment the current session is operating in. This affects which schema/style data is read and which changes are applied.
`
};
