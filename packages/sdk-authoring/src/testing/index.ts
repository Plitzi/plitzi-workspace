/**
 * What a suite needs from an authored space, beyond the handles `authorSpace` returns.
 *
 * Driver-agnostic like `locate`: `inspectPage` takes anything with an `evaluate`, and the rest is data over specs and
 * handles — so this stays a package that installs nothing and touches no browser until a test hands it one.
 */
export { inspectDocument, inspectPage } from './inspect';
export type { DocumentChecks, InspectOptions, PageEvaluator, PageReport } from './inspect';
export { onScreen } from './onScreen';
export type { OnScreenOptions } from './onScreen';
export type { ProbeFindings, ProbeInput } from './probe';
export { singlePageSpace, withElement } from './variants';
export type { ElementPatch } from './variants';
