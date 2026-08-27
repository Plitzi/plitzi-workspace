/**
 * The authoring vocabulary a RUNTIME reads — the only part of authoring that is not in `@plitzi/sdk-authoring`.
 *
 * Everything else about authoring lives in that package, and this is here for one reason: each of these is read
 * while a page renders, in a browser. An element declares itself with `elementDeclaration` (39 declaration files
 * do), a source turns its declarations into the controls the builder draws with `toInteractionCallback`, and
 * `getInteractions` reads the callbacks every element registers. If they lived with the rest of the authoring
 * surface, `@plitzi/sdk-elements` and `@plitzi/sdk-interactions` would have to depend on the package that already
 * depends on them — a cycle the build refuses.
 *
 * So they sit in the package everything already depends on, gathered in one folder rather than scattered through
 * this one, and `@plitzi/sdk-authoring` re-exports every name below: an author still writes one import and never
 * learns this boundary exists. What decides whether something belongs here is not what it is ABOUT but who reads
 * it — a catalog nobody but an author reads (the CSS vocabulary, the element factories, the binding transformers)
 * belongs over there, whatever it describes.
 */

export * from './builder';
export * from './declare';
export * from './elementCallbacks';
export * from './paramSpec';
export * from './spaceCallbacks';
