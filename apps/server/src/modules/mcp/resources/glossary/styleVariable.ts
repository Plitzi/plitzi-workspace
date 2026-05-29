export const styleVariableResource = {
  uri: 'plitzi://docs/style-variable',
  name: 'Plitzi Docs: Style Variable',
  description: 'Design tokens in the Plitzi style system — reusable values for colors, spacing, shadows, and custom properties.',
  mimeType: 'text/markdown',
  content: `# Style Variable

**Style variables** are design tokens stored in the \`Style\` object. They define reusable values (colors, spacing units, shadows, custom properties) that can be referenced across all CSS rules in the space.

## TypeScript Shape

\`\`\`typescript
enum StyleVariableCategory {
  COLOR = 'color',
  SPACING = 'spacing',
  SHADOW = 'shadow',
  CUSTOM = 'custom'
}

type StyleVariables = Record<StyleVariableCategory, StyleVariableGroup>;
type StyleVariableGroup = Record<string, StyleVariableValue>;

// Value can be a plain string/number or theme-aware (different per light/dark)
type StyleVariableValue =
  | string
  | number
  | {
      light?: string;
      dark?: string;
      default?: string;
    };
\`\`\`

## Categories

- **\`color\`** — color tokens (e.g. \`primary\`, \`background\`, \`text-muted\`). Values can be theme-aware (different for light vs. dark).
- **\`spacing\`** — spacing units (e.g. \`sm\`, \`md\`, \`lg\`). Plain numbers or CSS values.
- **\`shadow\`** — box-shadow definitions (e.g. \`card\`, \`modal\`).
- **\`custom\`** — any other token (border radius, font size, z-index, etc.).

## Theme-Aware Values

When a design system supports multiple themes, a variable value can vary:

\`\`\`typescript
{ light: '#ffffff', dark: '#1a1a1a', default: '#ffffff' }
\`\`\`

The \`default\` key is used when no theme preference is detected.

## Scope

Variables can be scoped at two levels:

1. **Style-level** (\`style.variables\`) — global tokens available everywhere in the space.
2. **Selector-level** (\`styleItem.variables\`) — tokens scoped to one CSS selector (override global for that component).

## Common Operations

- \`create_style_variable\` — add a new token with a category and name.
- \`update_style_variable\` — change a token's value.
- \`delete_style_variable\` — remove a token.

## Relationships

- Referenced by **Style Selectors** via CSS variable syntax or direct value interpolation.
- **Schema Variables** are different — they are schema-level data variables, not CSS design tokens.
`
};
