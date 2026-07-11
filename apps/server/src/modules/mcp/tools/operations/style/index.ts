// The style-schema domain: read projections (translator, cssCatalog) and one file per write operation
// (each exporting its zod schema + handler). operations.ts bundles the op schemas for the tool input union.

export * from './translator';
export * from './cssCatalog';
export { styleOps } from './operations';
export type { DefinitionSlotInput, DefinitionSlotPatch } from './shared';

export * from './upsertDefinition';
export * from './patchDefinition';
export * from './deleteDefinition';
export * from './upsertGlobalStyle';
export * from './patchGlobalStyle';
export * from './deleteGlobalStyle';
export * from './upsertStyleVariable';
export * from './deleteStyleVariable';
