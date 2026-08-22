/**
 * Authoring elements offline, from what each element already says about itself.
 *
 * `@plitzi/sdk-schema` assembles a space out of specs but knows nothing about element types, and it must not: a
 * table of hand-written factories over there is duplicated knowledge that falls behind every time an element is
 * added. So the factories live here, with the elements, and read their own declarations — a new element becomes
 * authorable the moment it declares itself.
 *
 * They read declarations rather than components on purpose. The components cannot be imported outside a browser
 * (an element and the catalogue reference each other, so the import throws at module init), and a seed or a
 * migration has no use for a React component anyway. The attribute TYPES do come from the components, which costs
 * nothing: a type import is erased before anything runs.
 */

export * from './catalog';
export * from './declare';
export * from './element';
export * from './elements';
export * from './elementCallbacks';
export * from './plugins';
export * from './steps';

export type { ElementDeclarationName } from '../elements/declarations';
