/**
 * Authoring elements offline, from what each element already says about itself.
 *
 * The factories read the element DECLARATIONS (`@plitzi/sdk-elements`), never the components: the components
 * cannot be imported outside a browser — an element and the catalogue reference each other, so the import throws
 * at module init — and a seed or a migration has no use for a React component anyway. The attribute TYPES do come
 * from the components, which costs nothing: a type import is erased before anything runs.
 *
 * A new element becomes authorable the moment it declares itself: there is no table of hand-written factories to
 * fall behind.
 */

export * from './catalog';
export * from './element';
export * from './elements';
export * from './plugins';
export * from './steps';

export type { ElementDeclarationName } from '@plitzi/sdk-elements/elements/declarations';
