const EventBridgeModuleTypes = {
  INTERACTION: 'interaction',
  ELEMENT: 'element'
};

const EventBridgeTypes = {
  // Root Schema
  SCHEMA_ADD_PAGE: 'schemaAddPage',
  SCHEMA_HOME_PAGE: 'schemaHomePage',
  SCHEMA_UPDATE_PAGE: 'schemaUpdatePage',
  SCHEMA_REMOVE_PAGE: 'schemaRemovePage',
  SCHEMA_ADD_PAGE_FOLDER: 'schemaAddPageFolder',
  SCHEMA_UPDATE_PAGE_FOLDER: 'schemaUpdatePageFolder',
  SCHEMA_REMOVE_PAGE_FOLDER: 'schemaRemovePageFolder',
  SCHEMA_UPDATE_SETTINGS: 'schemaUpdateSettings',

  // Schema (can be root as well)
  SCHEMA_UPDATE: 'schemaUpdate',
  SCHEMA_ADD_ELEMENT: 'schemaAddElement',
  SCHEMA_UPDATE_ELEMENT: 'schemaUpdateElement',
  SCHEMA_REMOVE_ELEMENT: 'schemaRemoveElement',
  SCHEMA_MOVE_ELEMENT: 'schemaMoveElement',
  SCHEMA_CLONE_ELEMENT: 'schemaCloneElement',
  SCHEMA_ADD_TEMPLATE: 'schemaAddTemplate',

  // Styles
  STYLE_UPDATE: 'styleUpdate',
  STYLE_ADD_SELECTOR: 'styleAddSelector',
  STYLE_UPDATE_SELECTOR: 'styleUpdateSelector',
  STYLE_REMOVE_SELECTOR: 'styleRemoveSelector',
  STYLE_ADD_TEMPLATE: 'styleAddTemplate',

  // Builder
  BUILDER_SET_BASE_CONTEXT: 'builderSetBaseContext',
  BUILDER_SET_SELECTED: 'builderSetSelected',
  BUILDER_SET_HOVERED: 'builderSetHovered'
};

const EventBridgeTypesPerModule = {
  [EventBridgeModuleTypes.MAIN]: [
    EventBridgeTypes.SCHEMA_ADD_PAGE,
    EventBridgeTypes.SCHEMA_HOME_PAGE,
    EventBridgeTypes.SCHEMA_UPDATE_PAGE,
    EventBridgeTypes.SCHEMA_REMOVE_PAGE,
    EventBridgeTypes.SCHEMA_ADD_PAGE_FOLDER,
    EventBridgeTypes.SCHEMA_UPDATE_PAGE_FOLDER,
    EventBridgeTypes.SCHEMA_REMOVE_PAGE_FOLDER,
    EventBridgeTypes.SCHEMA_UPDATE_SETTINGS,
    EventBridgeTypes.SCHEMA_UPDATE,
    EventBridgeTypes.SCHEMA_ADD_ELEMENT,
    EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
    EventBridgeTypes.SCHEMA_REMOVE_ELEMENT,
    EventBridgeTypes.SCHEMA_MOVE_ELEMENT,
    EventBridgeTypes.SCHEMA_CLONE_ELEMENT,
    EventBridgeTypes.SCHEMA_ADD_TEMPLATE,
    EventBridgeTypes.STYLE_UPDATE,
    EventBridgeTypes.STYLE_ADD_SELECTOR,
    EventBridgeTypes.STYLE_UPDATE_SELECTOR,
    EventBridgeTypes.STYLE_REMOVE_SELECTOR,
    EventBridgeTypes.STYLE_ADD_TEMPLATE
  ],
  [EventBridgeModuleTypes.BUILDER]: [
    EventBridgeTypes.BUILDER_SET_BASE_CONTEXT,
    EventBridgeTypes.BUILDER_SET_SELECTED,
    EventBridgeTypes.BUILDER_SET_HOVERED
  ]
};

export { EventBridgeModuleTypes, EventBridgeTypes, EventBridgeTypesPerModule };
