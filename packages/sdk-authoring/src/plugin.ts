/**
 * What a plugin's `declaration.ts` writes itself with, and nothing else — so the file stays data: the pack reads it on
 * Node to write the manifest and the plugin's own bundle carries it, and neither wants the whole authoring surface.
 */
export { definePlugin } from '@plitzi/sdk-shared/authoring/declare';
export type {
  DeclaredCallbacks,
  DeclaredTriggers,
  DefinedPlugin,
  ElementAttributesBrand,
  ElementDeclarationData,
  PluginCallbackSpec,
  PluginDeclaration,
  PluginSpec,
  PluginTriggerSpec
} from '@plitzi/sdk-shared/authoring/declare';
export type { InteractionCallback, InteractionCallbackPreviews } from '@plitzi/sdk-shared';
