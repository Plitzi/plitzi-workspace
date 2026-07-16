// The element-schema domain: read projections (translator, registry) and one file per write operation
// (each exporting its zod schema + handler). operations.ts bundles the op schemas for the tool input union.

export * from './translator';
export * from './registry';
export * from './observed';
export { elementOps } from './operations';
export type { ElementInput } from './shared';

export * from './upsertElement';
export * from './patchElement';
export * from './deleteElement';
export * from './moveElement';
export * from './upsertPage';
export * from './deletePage';
export * from './upsertFolder';
export * from './deleteFolder';
export * from './upsertVariable';
export * from './deleteVariable';
export * from './upsertBinding';
export * from './patchBinding';
export * from './deleteBinding';
export * from './upsertInteractionFlow';
export * from './patchInteractionNode';
export * from './deleteInteraction';
export * from './patchSettings';
