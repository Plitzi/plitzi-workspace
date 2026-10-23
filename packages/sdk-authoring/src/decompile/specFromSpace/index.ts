/**
 * `specFromSpace`: a space's documents read back into the `SpaceSpec` that authors them — one reader (`reader`) over
 * the space's classes, its pages and layouts, its elements and their bindings and flows, each a module.
 */

export type { SpecCorrection, SpecCorrectionCode, SpecFromSpace, SpecFromSpaceOptions } from './types';
export { specFromSpace } from './reader';
