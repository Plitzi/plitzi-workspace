// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventBridgeContextValue<T = any> = { eventBridge: T };

export type EventBridgeModule = 'main' | 'builder' | 'segment' | 'template' | 'interaction' | 'element';

export type EventBridgeEvent =
  // Root Schema Events
  | 'schemaAddPage'
  | 'schemaHomePage'
  | 'schemaUpdatePage'
  | 'schemaRemovePage'
  | 'schemaAddPageFolder'
  | 'schemaUpdatePageFolder'
  | 'schemaRemovePageFolder'
  | 'schemaUpdateSettings'
  // Schema Events (can be root as well)
  | 'schemaUpdate'
  | 'schemaAddElement'
  | 'schemaUpdateElement'
  | 'schemaRemoveElement'
  | 'schemaMoveElement'
  | 'schemaCloneElement'
  | 'schemaAddTemplate'
  // Style Events
  | 'styleUpdate'
  | 'styleAddSelector'
  | 'styleUpdateSelector'
  | 'styleRemoveSelector'
  | 'styleAddVariable'
  | 'styleUpdateVariable'
  | 'styleRemoveVariable'
  | 'styleAddTemplate'
  // Builder Events
  | 'builderSetBaseContext'
  | 'builderSetSelected'
  | 'builderSetHovered';
