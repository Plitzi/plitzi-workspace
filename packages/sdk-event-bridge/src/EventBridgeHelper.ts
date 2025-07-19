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
    'schemaRemoveElement',
    'schemaMoveElement',
    'schemaCloneElement',
    'schemaAddTemplate',

    // Styles
    'styleUpdate',
    'styleAddSelector',
    'styleUpdateSelector',
    'styleRemoveSelector',
    'styleAddVariable',
    'styleUpdateVariable',
    'styleRemoveVariable',
    'styleAddTemplate'
  ],
  builder: ['builderSetBaseContext', 'builderSetSelected', 'builderSetHovered'],
  segment: [],
  template: [],
  interaction: [],
  element: []
};

export { EventBridgeTypesPerModule };
