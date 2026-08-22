/**
 * Authoring a space: the assembly half, and the only thing in the SDK that writes a schema document.
 *
 * The other authoring fragments — the CSS vocabulary in `@plitzi/sdk-style/authoring`, the element factories in
 * `@plitzi/sdk-elements/authoring`, the interaction vocabulary in `@plitzi/sdk-interactions/authoring` — all
 * produce inert specs. They become a document here, and only after this package has agreed the result is one a
 * renderer can serve.
 */

export * from './bindings';
export * from './flows';
export * from './ids';
export * from './space';
export * from './validate';
export type * from './types';
