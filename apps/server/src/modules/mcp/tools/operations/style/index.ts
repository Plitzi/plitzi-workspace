// The style-schema domain: the read projection (translator) and one file per write operation (each exporting its
// zod schema + handler). operations.ts bundles the op schemas for the tool input union. The CSS property catalog
// lives under modules/mcp/catalogs.

export * from './translator';
export { styleOps } from './operations';
export type { DefinitionSlotInput, DefinitionSlotPatch } from './shared';

export * from './definitions/upsertDefinition';
export * from './definitions/patchDefinition';
export * from './definitions/deleteDefinition';
export * from './globalStyles/upsertGlobalStyle';
export * from './globalStyles/patchGlobalStyle';
export * from './globalStyles/deleteGlobalStyle';
export * from './idStyles/upsertIdStyle';
export * from './idStyles/patchIdStyle';
export * from './idStyles/deleteIdStyle';
export * from './variables/upsertStyleVariable';
export * from './variables/deleteStyleVariable';
