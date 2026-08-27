/**
 * Authoring a space: the assembly half, and the only thing in the SDK that writes a schema document.
 *
 * The rest of this package — the CSS vocabulary in `../style`, the element factories in `../elements`, the
 * interaction vocabulary in `../interactions` — produces inert specs. They become a document here, and only after
 * the validator has agreed the result is one a renderer can serve.
 */

export * from './actions';
export * from './bindings';
export * from './flows';
export * from './ids';
export * from './space';
export * from './template';
export * from './validate';
export type * from './types';
