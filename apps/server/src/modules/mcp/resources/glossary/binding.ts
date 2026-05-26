export const bindingResource = {
  uri: 'plitzi://docs/binding',
  name: 'Plitzi Docs: Binding',
  description: 'Data bindings in Plitzi — connections that dynamically drive element attributes, style, or state from data sources.',
  mimeType: 'text/markdown',
  content: `# Binding

A **Binding** connects a data source to an element property. At runtime, the bound value replaces the element's static attribute, style, or initial state. Bindings enable dynamic content — data from collections, variables, navigation params, or other elements can drive what is displayed or how it looks.

## TypeScript Shape

\`\`\`typescript
type BindingCategory = 'attributes' | 'style' | 'initialState';

type ElementBinding = {
  id: string;
  source: string;                   // Data source ID / reference
  fromPath?: string;                // Path within the source data (e.g. 'user.name')
  transformers?: BindingTransformer[];  // Optional value transforms
  when?: RuleGroup;                 // Conditional activation rule
  enabled?: boolean;
  toPath: string;                   // Target attribute/style/state path to overwrite
};

type BindingTransformer = {
  type: 'utility' | 'unknown';
  action: string;                   // Transform function name
  params: { valueType: string; value: string };
};
\`\`\`

## Binding Categories

Bindings are grouped by what they target inside an element:

| Category | What it overwrites |
|---|---|
| \`attributes\` | Fields in \`element.attributes\` (e.g. \`text\`, \`src\`, \`href\`) |
| \`style\` | Style-related data (e.g. active style variant) |
| \`initialState\` | Initial runtime state values |

## Key Properties

- **\`source\`** — identifies the data source (a collection ID, a schema variable name, a navigation param key, etc.).
- **\`fromPath\`** — dot-notation path into the source data to extract the bound value (e.g. \`'record.title'\`).
- **\`toPath\`** — dot-notation path of the target property to set on the element (e.g. \`'text'\`, \`'src'\`).
- **\`transformers\`** — optional chain of value transforms applied before writing to \`toPath\`.
- **\`when\`** — a \`RuleGroup\` condition; the binding only applies when the condition evaluates to true.

## Where Bindings Are Stored

Bindings live inside \`element.definition.bindings\`:

\`\`\`typescript
element.definition.bindings = {
  attributes: [
    { id: '...', source: 'collection-posts', fromPath: 'title', toPath: 'text', ... }
  ],
  style: [...],
  initialState: [...]
}
\`\`\`

## Relationships

- Bindings reference **Schema Variables** (source by variable name) or external data sources.
- Bindings are part of **Element** definitions.
- **Interactions** complement bindings by handling user-triggered events (click, change).
`
};
