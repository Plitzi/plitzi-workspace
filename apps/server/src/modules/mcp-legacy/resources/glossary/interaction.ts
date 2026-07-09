export const interactionResource = {
  uri: 'plitzi://docs/interaction',
  name: 'Plitzi Docs: Interaction',
  description:
    'Event-driven action handlers in Plitzi — connect user events (click, change, submit) to platform actions.',
  mimeType: 'text/markdown',
  content: `# Interaction

An **Interaction** is an event handler attached to an element. When a user triggers an event (click, change, form submit, etc.), the interaction executes a configured action — navigation, state mutation, data operation, animation, etc.

## TypeScript Shape

\`\`\`typescript
type ElementInteraction = {
  id: string;
  title: string;                        // Human-readable name
  type: InteractionCallbackType;        // Event type (e.g. 'onClick', 'onChange')
  action: string;                       // Action identifier (e.g. 'navigate', 'setVariable')
  params: InteractionCallbackParamValues;  // Action-specific parameters
  preview: Record<string, unknown>;     // Preview data for the builder
  elementId: string;                    // Element this interaction belongs to
  beforeNode: string;                   // Flow order: ID of preceding step
  afterNode: string;                    // Flow order: ID of following step
  flowId: string;                       // Groups interactions in the same flow
  enabled: boolean;
  when?: RuleGroup;                     // Conditional: only fire when rule matches
};
\`\`\`

## Key Properties

- **\`type\`** — the DOM or lifecycle event to listen on (e.g. \`onClick\`, \`onChange\`, \`onSubmit\`, \`onLoad\`).
- **\`action\`** — the platform action to execute. Common actions: \`navigate\`, \`setSchemaVariable\`, \`toggleVisibility\`, \`submitForm\`, \`openModal\`.
- **\`params\`** — action-specific configuration object. Shape depends on \`action\`.
- **\`flowId\` + \`beforeNode\` / \`afterNode\`** — interactions can be chained into a sequential flow. Multiple interactions sharing a \`flowId\` form an ordered chain.
- **\`when\`** — a \`RuleGroup\` condition; the interaction only fires when the condition is true.

## Where Interactions Are Stored

Interactions are stored in \`element.definition.interactions\` as a record keyed by interaction ID:

\`\`\`typescript
element.definition.interactions = {
  'inter-abc': {
    id: 'inter-abc',
    type: 'onClick',
    action: 'navigate',
    params: { url: '/dashboard' },
    ...
  }
}
\`\`\`

## Relationships

- Interactions belong to **Elements**.
- **Bindings** handle passive data-driven updates; interactions handle active user-triggered events.
- Interactions can mutate **Schema Variables** (via \`setSchemaVariable\` action), which then propagate through bindings.
`
};
