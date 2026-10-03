import type { EventBridgeEvent, EventBridgeModule } from '@plitzi/sdk-shared';

const EventBridgeTypesPerModule: Record<EventBridgeModule, EventBridgeEvent[]> = {
  main: [
    // Root Schema
    'schemaAddPage',
    'schemaHomePage',
    'schemaUpdatePage',
    'schemaRemovePage',
    'schemaAddPageFolder',
    'schemaUpdatePageFolder',
    'schemaRemovePageFolder',
    'schemaUpdateSettings',

    // Schema (can be root as well)
    'schemaUpdate',
    'schemaAddElement',
    'schemaUpdateElement',
    'schemaRenameElement',
    'schemaUpdateElements',
    'schemaRemoveElement',
    'schemaMoveElement',
    'schemaCloneElement',
    'schemaAddVariable',
    'schemaUpdateVariable',
    'schemaRemoveVariable',
    'schemaSetFlag',
    'schemaRemoveFlag',
    'schemaAddSnippet',
    'schemaAddComponent',
    'schemaUpdateComponent',
    'schemaRemoveComponent',
    'schemaDetachInstance',

    // Styles
    'styleUpdate',
    'styleAddSelector',
    'styleUpdateSelector',
    'styleRemoveSelector',
    'styleRemoveSelectors',
    'styleAddSelectorVariable',
    'styleUpdateSelectorVariable',
    'styleRemoveSelectorVariable',
    'styleAddVariable',
    'styleUpdateVariable',
    'styleRemoveVariable',
    'styleAddSnippet',
    'styleUpdateSettings'
  ],
  builder: ['builderSetBaseContext', 'builderSetSelected', 'builderSetHovered'],
  snippet: [],
  interaction: [],
  element: []
};

export { EventBridgeTypesPerModule };
