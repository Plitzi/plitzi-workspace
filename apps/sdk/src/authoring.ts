/**
 * Authoring a space in code — the whole surface, from one import.
 *
 * Every piece of this is declared by the package that owns the thing it describes: the CSS vocabulary by the style
 * engine, the element factories by the elements, the interaction vocabulary by the sources that implement the
 * actions, and the assembly and validation by the schema. What this file adds is that a person authoring a space
 * should not have to know any of that — they want `heading`, `css`, `onClick` and `authorSpace`, from one place.
 *
 * It is deliberately free of React and of anything that touches a browser: a seed, a migration, a self-hosted
 * server and a build script are the places a space gets authored, and none of them can load a component. That is
 * enforced by what it re-exports — data and functions over data, nothing else — and by the build that ships it as
 * its own entry rather than as part of the SDK bundle.
 */

export * from '@plitzi/sdk-elements/authoring';
export * from '@plitzi/sdk-interactions/authoring';
export * from '@plitzi/sdk-schema/authoring';
export * from '@plitzi/sdk-shared/authoring';
export * from '@plitzi/sdk-style/authoring';
