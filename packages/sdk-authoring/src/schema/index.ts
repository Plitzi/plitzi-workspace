/**
 * Authoring a space: the assembly half, and the only thing in the SDK that writes a schema document.
 *
 * The rest of this package — the CSS vocabulary in `../style`, the element factories in `../elements`, the
 * interaction vocabulary in `../interactions` — produces inert specs. They become a document here, and only after
 * the validator has agreed the result is one a renderer can serve.
 */

export * from './actions';
export * from './bindings';
export * from './codes';
export { authoringCodesTable } from './codesPage';
export { flagGateOf, flagSpecOf } from './flags';
export * from './flows';
export * from './handles';
export * from './ids';
export * from './lint';
export { navOf } from './nav';
export type { NavEntry } from './nav';
export * from './notifications';
export * from './pageFamily';
export * from './refusals';
export { audienceAt, pageAt } from './route';
export type { Audience, PageAtAddress } from './route';
export * from './space';
export * from './advice';
export * from './snippet';
export { closest } from './suggest';
export * from './validate';
export type * from './types';
export type { WrittenPosition } from './writtenAt';
