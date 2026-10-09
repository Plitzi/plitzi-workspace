/** What sdk-event-bridge's context holds: its bridge, whose class is that package's own. */
export type EventBridgeContextValue<T> = { eventBridge: T };

export type EventBridgeModule = 'main' | 'builder' | 'snippet' | 'interaction' | 'element';

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
  | 'schemaRenameElement'
  | 'schemaUpdateElements'
  | 'schemaRemoveElement'
  | 'schemaMoveElement'
  | 'schemaCloneElement'
  | 'schemaAddVariable'
  | 'schemaUpdateVariable'
  | 'schemaRemoveVariable'
  | 'schemaSetFlag'
  | 'schemaRemoveFlag'
  | 'schemaAddSnippet'
  | 'schemaAddComponent'
  | 'schemaUpdateComponent'
  | 'schemaRemoveComponent'
  | 'schemaDetachInstance'
  // Style Events
  | 'styleUpdate'
  | 'styleAddSelector'
  | 'styleUpdateSelector'
  | 'styleRemoveSelector'
  | 'styleRemoveSelectors'
  | 'styleAddSelectorVariable'
  | 'styleUpdateSelectorVariable'
  | 'styleRemoveSelectorVariable'
  | 'styleAddVariable'
  | 'styleUpdateVariable'
  | 'styleRemoveVariable'
  | 'styleAddFont'
  | 'styleUpdateFont'
  | 'styleRemoveFont'
  | 'styleAddSnippet'
  | 'styleUpdateSettings'
  // Builder Events
  | 'builderSetBaseContext'
  | 'builderSetSelected'
  | 'builderSetHovered';
