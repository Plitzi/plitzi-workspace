import { BUILTIN_GLOBAL_CALLBACKS, BUILTIN_UTILITIES } from '@plitzi/sdk-interactions/authoring';
import { authorSpace as authorSpaceUnchecked } from '@plitzi/sdk-schema/authoring';

import type { AuthorSpaceOptions, AuthoredSpace, SpaceSpec, StepVocabulary } from '@plitzi/sdk-schema/authoring';

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

/**
 * What a step may name in a space authored here.
 *
 * The catalogs are declared beside the code that implements each action, and `@plitzi/sdk-schema` cannot read them:
 * the interaction package depends on the schema package, so the import would close a cycle. This file is the one
 * place that already holds both, which is why the check is composed here rather than there.
 */
const STEP_VOCABULARY: StepVocabulary = {
  globalCallbacks: BUILTIN_GLOBAL_CALLBACKS,
  utilities: BUILTIN_UTILITIES
};

/**
 * `authorSpace`, holding this SDK's own step vocabulary.
 *
 * Deliberately shadows the one re-exported above — an explicit export wins over a star — so that everybody who
 * imports from this entry, or from the `@plitzi/sdk-server/authoring` that re-exports it, gets a flow whose targets
 * are checked. A step naming a callback on the wrong module is refused here; one naming an action no built-in
 * source declares comes back in `warnings`, since a plugin is free to register a module this process cannot see.
 */
export const authorSpace = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): AuthoredSpace =>
  authorSpaceUnchecked(spec, { vocabulary: STEP_VOCABULARY, ...options });
