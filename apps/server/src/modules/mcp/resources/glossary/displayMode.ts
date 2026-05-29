export const displayModeResource = {
  uri: 'plitzi://docs/display-mode',
  name: 'Plitzi Docs: Display Mode',
  description: 'Responsive breakpoints in Plitzi — desktop, tablet, and mobile style layers.',
  mimeType: 'text/markdown',
  content: `# Display Mode

A **Display Mode** represents a responsive breakpoint in the Plitzi style system. Styles are defined per display mode, allowing different visual rules at each screen size.

## Type

\`\`\`typescript
type DisplayMode = 'desktop' | 'tablet' | 'mobile';
\`\`\`

## Structure in Style

The \`Style.platform\` object holds one style layer per display mode:

\`\`\`typescript
style.platform = {
  desktop: Record<string, StyleItem>,   // Base styles (widest breakpoint)
  tablet: Record<string, StyleItem>,    // Overrides for tablet-width screens
  mobile: Record<string, StyleItem>     // Overrides for mobile-width screens
};
\`\`\`

Each mode contains the same set of CSS selectors (keyed by selector string). A selector defined only in \`desktop\` inherits its rules at all sizes unless overridden in \`tablet\` or \`mobile\`.

## Cascade Direction

- **Desktop-first** (default, \`style.mode === 'desktop-first'\`): \`desktop\` is the base. \`tablet\` overrides at medium widths. \`mobile\` overrides at narrow widths.
- **Mobile-first** (\`style.mode === 'mobile-first'\`): \`mobile\` is the base. \`tablet\` and \`desktop\` add styles as the viewport widens.

## In MCP Operations

MCP style tools that modify selectors accept a \`displayMode\` parameter:

\`\`\`typescript
createStyleSelector({ displayMode: 'mobile', selector: '.hero', ... })
updateStyleSelector({ displayMode: 'tablet', selector: '.hero', ... })
deleteStyleSelector({ displayMode: 'desktop', selector: '.hero' })
\`\`\`

Omitting \`displayMode\` typically defaults to \`desktop\`.
`
};
