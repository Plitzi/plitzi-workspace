export const workflowStylesResource = {
  uri: 'plitzi://workflows/styles',
  name: 'Plitzi Workflow: Styles',
  description: 'Step-by-step guide for styling elements, using design tokens, and working across breakpoints.',
  mimeType: 'text/markdown',
  content: `# Workflow: Styling Elements

## Style an element after creating it

Every element has a \`definition.styleSelectors\` map (e.g. \`{ "base": ".el-abc123", "icon": ".el-abc123-icon" }\`).
These are the CSS class strings registered in the space style system.

1. Get the element's \`styleSelectors\` — from the \`create_element\` / \`get_element\` response.
2. Call \`update_style_selector\`:
   \`\`\`json
   {
     "displayMode": "desktop",
     "selector": ".el-abc123",
     "type": "class",
     "style": { "base": { "backgroundColor": "#3b82f6", "padding": "16px" } }
   }
   \`\`\`
3. To style other breakpoints, repeat with \`"displayMode": "tablet"\` or \`"mobile"\`.
4. To style sub-slots (e.g. icon, header, body): use the corresponding selector from \`styleSelectors\` and the slot name as the style key.

## Update a specific CSS property (path parameter)

The \`path\` parameter in \`update_style_selector\` controls the scope of the update:

| path | style value | result |
|------|------------|--------|
| omitted | \`{ base: { color: "#fff" } }\` | Replaces **all** attributes of the selector |
| \`"base.color"\` | \`"#fff"\` | Updates only \`color\` inside the \`base\` slot |
| \`"base.color"\` | \`undefined\` / omitted | **Deletes** the \`color\` property from \`base\` |
| omitted | \`undefined\` / omitted | **Clears** all attributes from the selector |

Example — update only the background color without touching other properties:
\`\`\`json
{
  "displayMode": "desktop",
  "selector": ".el-abc123",
  "type": "class",
  "path": "base.backgroundColor",
  "style": { "base": { "backgroundColor": "#ef4444" } }
}
\`\`\`

## Create a new selector from scratch

Use \`create_style_selector\` when you need a CSS class that isn't tied to a specific element (shared utility class):
\`\`\`json
{
  "displayMode": "desktop",
  "selector": ".hero-banner",
  "type": "class",
  "style": { "base": { "minHeight": "400px" } }
}
\`\`\`

## Use design tokens (CSS variables)

Tokens let you reuse values across many selectors.

1. Create a token with \`create_style_variable\`:
   \`\`\`json
   { "category": "color", "name": "brand", "value": { "light": "#3b82f6", "dark": "#60a5fa", "default": "#3b82f6" } }
   \`\`\`
2. Reference the token by name in any style rule:
   \`\`\`json
   { "base": { "color": "var(--plitzi-brand)" } }
   \`\`\`

## Responsive styles

Apply the same selector at different display modes to override values:
1. Desktop (default): \`update_style_selector\` with \`"displayMode": "desktop"\`.
2. Tablet overrides: \`update_style_selector\` with \`"displayMode": "tablet"\`.
3. Mobile overrides: \`update_style_selector\` with \`"displayMode": "mobile"\`.

Only the overriding properties need to be included in each breakpoint call.

## Preview and inspect current styles

- To see how a saved element currently looks: use \`preview_element\` — it returns its schema+style for display.
- The \`style.platform\` in the response is keyed by displayMode, then by selector, and shows the actual CSS rules applied.
- \`get_schema\` does not include style data — use \`preview_element\` to read an element's live styles.
`
};
