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
    'schemaUpdateElements',
    'schemaRemoveElement',
    'schemaMoveElement',
    'schemaCloneElement',
    'schemaAddVariable',
    'schemaUpdateVariable',
    'schemaRemoveVariable',
    'schemaAddTemplate',

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
    'styleAddTemplate',
    'styleUpdateSettings'
  ],
  builder: ['builderSetBaseContext', 'builderSetSelected', 'builderSetHovered'],
  segment: [],
  template: [],
  interaction: [],
  element: []
};

export { EventBridgeTypesPerModule };
