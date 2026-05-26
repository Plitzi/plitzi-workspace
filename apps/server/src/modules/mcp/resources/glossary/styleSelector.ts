export const styleSelectorResource = {
  uri: 'plitzi://docs/style-selector',
  name: 'Plitzi Docs: Style Selector',
  description: 'A CSS selector entry in the Plitzi style system — holds all visual rules for one selector across states and variants.',
  mimeType: 'text/markdown',
  content: `# Style Selector (StyleItem)

A **style selector** is a single entry in \`style.platform[displayMode]\`. It represents one CSS selector (class, element, or ID) and stores all its CSS rules organized by sub-selector, state, and variant.

## TypeScript Shape

\`\`\`typescript
type StyleItem = {
  name: string;                        // The CSS selector (e.g. '.hero-section')
  type: 'class' | 'element' | 'id';
  variables?: Partial<StyleVariables>; // Design tokens scoped to this selector
  attributes: Record<string, StyleBlock>;  // CSS per sub-selector slot
  cache: string;                       // Pre-compiled CSS (auto-managed)
  componentType?: string;              // Plugin type that created this selector
};

type StyleBlock = {
  default?: StyleObject;                            // Normal state CSS
  states?: Partial<Record<StyleState, StyleObject>>;// Pseudo-class overrides
  variants?: Record<string, Omit<StyleBlock, 'variants'>>;  // Named variants
};

type StyleState = 'hover' | 'active' | 'focus' | 'disabled' | 'checked' | 'visited';
type StyleObject = Partial<Record<StyleCategory, string | number>>;
\`\`\`

## Sub-selector Slots

The \`attributes\` object is keyed by **slot names**, not raw CSS selectors. Each slot maps to a structural part of the component:

- \`base\` — always present; targets the root DOM element of the component.
- Other slots (e.g. \`header\`, \`body\`, \`icon\`, \`label\`) target internal parts defined by the plugin.

The mapping from slot name → CSS selector is managed by the plugin renderer.

## Variants

Variants allow a single selector to have multiple named visual appearances (e.g. \`primary\`, \`danger\`, \`sm\`, \`lg\`). An element activates a variant through \`definition.initialState.styleVariant\`:

\`\`\`typescript
// element.definition.initialState.styleVariant
{
  base: { base: 'primary' }        // Apply 'primary' variant on the 'base' slot
}
\`\`\`

## Relationship to Elements

Elements reference style selectors via \`definition.styleSelectors\`:

\`\`\`typescript
// element.definition.styleSelectors
{
  base: '.hero-section',    // Points to style.platform.desktop['.hero-section']
  title: '.hero-title'      // Points to style.platform.desktop['.hero-title']
}
\`\`\`

## Display Modes

A style selector can exist in multiple display modes (\`desktop\`, \`tablet\`, \`mobile\`). Rules in \`tablet\` and \`mobile\` override the desktop base at their respective breakpoints.

## Common Operations

- \`create_style_selector\` — add a new StyleItem to a display mode.
- \`update_style_selector\` — modify \`attributes\` for an existing selector.
- \`delete_style_selector\` — remove a selector from a display mode.
`
};
