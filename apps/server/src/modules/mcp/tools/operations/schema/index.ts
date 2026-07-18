// The element-schema domain: the read projection (translator) and one file per write operation (each exporting its
// zod schema + handler). operations.ts bundles the op schemas for the tool input union. Reference vocabularies
// (registry, observed) live under modules/mcp/catalogs.

export * from './translator';
export { elementOps } from './operations';
export type { ElementInput } from './shared';

export * from './elements/upsertElement';
export * from './elements/patchElement';
export * from './elements/deleteElement';
export * from './elements/moveElement';
export * from './pages/upsertPage';
export * from './pages/deletePage';
export * from './folders/upsertFolder';
export * from './folders/deleteFolder';
export * from './variables/upsertVariable';
export * from './variables/deleteVariable';
export * from './bindings/upsertBinding';
export * from './bindings/patchBinding';
export * from './bindings/deleteBinding';
export * from './interactions/upsertInteractionFlow';
export * from './interactions/patchInteractionNode';
export * from './interactions/deleteInteraction';
export * from './settings/patchSettings';
