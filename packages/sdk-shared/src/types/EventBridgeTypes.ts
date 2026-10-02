/* eslint-disable @typescript-eslint/no-explicit-any */

export type EventBridgeContextValue<T = any> = { eventBridge: T };

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
