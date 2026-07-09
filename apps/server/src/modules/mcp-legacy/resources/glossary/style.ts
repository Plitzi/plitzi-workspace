export const styleResource = {
  uri: 'plitzi://docs/style',
  name: 'Plitzi Docs: Style',
  description: 'The styling system of a Plitzi space — CSS definitions organized by display mode, selector, and theme.',
  mimeType: 'text/markdown',
  content: `# Style

The \`Style\` object holds all CSS definitions for a Plitzi space. It is paired one-to-one with a \`Schema\` per environment. Styles are organized by display mode (responsive breakpoints), CSS selector, and optionally by theme (light/dark).

## TypeScript Shape

\`\`\`typescript
type Style = {
  platform: Record<DisplayMode, Record<string, StyleItem>>;
  mode?: 'mobile-first' | 'desktop-first';
  theme: {
    default: StyleThemeMode;      // 'system' | 'light' | 'dark'
    schemes: StyleThemeMode[];    // Enabled theme schemes
  };
  variables: Partial<StyleVariables>;
};

type DisplayMode = 'desktop' | 'tablet' | 'mobile';
type StyleThemeMode = 'system' | 'light' | 'dark';

type StyleItem = {
  name: string;                    // The CSS selector string
  type: 'class' | 'element' | 'id';
  variables?: Partial<StyleVariables>;
  attributes: StyleAttributes;     // CSS properties per sub-selector
  cache: string;                   // Pre-compiled CSS string (read-only)
  componentType?: string;          // Plugin type that owns this selector
};

type StyleAttributes = Record<string, StyleBlock>;  // key = sub-selector name (e.g. 'base', 'header')

type StyleBlock = {
  default?: StyleObject;                        // Base CSS properties
  states?: Partial<Record<StyleState, StyleObject>>;   // Pseudo-classes
  variants?: Record<string, Omit<StyleBlock, 'variants'>>;  // Custom variants
};

type StyleState = 'hover' | 'active' | 'focus' | 'disabled' | 'checked' | 'visited';
type StyleObject = Partial<Record<StyleCategory, StyleValue>>;
type StyleValue = number | string;

// StyleVariableValue can be theme-aware
type StyleVariableValue = string | number | {
  light?: string;
  dark?: string;
  default?: string;
};
\`\`\`

## Key Properties

- **\`platform\`** — top-level split by \`DisplayMode\`. Each mode holds a dictionary of selector → \`StyleItem\`. Desktop is the base; tablet and mobile override via breakpoints.
- **\`StyleItem.name\`** — the raw CSS selector (e.g. \`.btn-primary\`, \`#hero\`, \`button\`).
- **\`StyleItem.type\`** — whether the selector is a class, element tag, or ID.
- **\`StyleItem.attributes\`** — the CSS data, keyed by sub-selector slot names. The \`base\` slot always corresponds to the element itself. Other slots (e.g. \`header\`, \`icon\`) target internal parts of a component.
- **\`StyleBlock.default\`** — normal-state CSS properties.
- **\`StyleBlock.states\`** — CSS overrides for pseudo-classes (hover, focus, disabled, etc.).
- **\`StyleBlock.variants\`** — named visual variants applied via \`element.definition.initialState.styleVariant\`.
- **\`StyleItem.cache\`** — compiled CSS string. Recomputed automatically; do not modify directly.
- **\`variables\`** — design tokens (colors, spacing, shadows, custom) at the style or item level.

## Relationships

- Each \`Element\` references its style entries via \`definition.styleSelectors\`, mapping slot names to selector strings in \`style.platform[mode]\`.
- **Style variables** (\`StyleVariable\`) are design tokens shared across the style system.
- A **Segment** has its own isolated \`Style\` object, separate from the space style.

## Display Mode Behavior

- Styles are applied from most-specific breakpoint down to \`desktop\`.
- In \`mobile-first\` mode, \`desktop\` styles are the widest override; in \`desktop-first\` (default), \`mobile\` overrides narrow screens.
`
};
