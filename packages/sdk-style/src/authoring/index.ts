/**
 * Authoring CSS: the style half of building a space without the builder.
 *
 * This fragment owns the CSS vocabulary and nothing else — what a property is called, which shorthands expand into
 * what, and whether a rule set is writable at all. It produces plain rule objects; turning them into a document is
 * `@plitzi/sdk-schema`'s job, and it is the only thing that writes one.
 */

export * from './css';
export * from './layout';
export * from './properties';
export * from './shorthand';
export type * from './types';
