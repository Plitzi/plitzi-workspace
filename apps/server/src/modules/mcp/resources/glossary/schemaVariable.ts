export const schemaVariableResource = {
  uri: 'plitzi://docs/schema-variable',
  name: 'Plitzi Docs: Schema Variable',
  description:
    'A space-level dynamic variable in Plitzi — typed values that can be injected into elements via bindings.',
  mimeType: 'text/markdown',
  content: `# Schema Variable

A **Schema Variable** is a space-level dynamic variable defined in \`schema.variables\`. Variables can be injected into element \`attributes\` or \`style\` via bindings, making them a lightweight way to parameterize behavior and appearance without hardcoding values.

## TypeScript Shape

\`\`\`typescript
type SchemaVariable = {
  name: string;       // Unique identifier used in bindings (e.g. 'primaryColor')
  category: string;   // Grouping label shown in the builder UI
  type:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'select'
    | 'select2'
    | 'checkbox'
    | 'textarea'
    | 'color'
    | 'switch';
  value: string;                                  // Default/current value
  subValues: { when: RuleGroup; value: string }[]; // Conditional overrides
};
\`\`\`

## Key Properties

- **\`name\`** — the variable identifier used when binding to elements. Must be unique within the schema.
- **\`category\`** — organizes variables into logical groups in the builder panel (e.g. \`'Colors'\`, \`'Typography'\`).
- **\`type\`** — determines the editor widget and value format. \`color\` stores a hex/rgba string; \`switch\` stores \`'true'\`/\`'false'\`.
- **\`value\`** — the base value. All values are stored as strings regardless of type.
- **\`subValues\`** — conditional overrides: when a \`RuleGroup\` condition is met, the variable uses that value instead of the default. Enables rule-based theming and personalization.

## Difference from Style Variables

| | Schema Variable | Style Variable |
|---|---|---|
| Stored in | \`schema.variables\` | \`style.variables\` |
| Used for | Element attributes, logic | CSS design tokens |
| Types | text, color, switch, etc. | string, number, theme-aware |
| Scope | Element bindings | CSS properties |

## Common Operations

- \`create_schema_variable\` — define a new variable.
- \`update_schema_variable\` — change the value, category, or conditional rules.
- \`delete_schema_variable\` — remove a variable (breaks any bindings referencing it).

Segment variables use: \`create_segment_variable\`, \`update_segment_variable\`, \`delete_segment_variable\`.
`
};
