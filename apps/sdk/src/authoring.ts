import { elementSourceTypes } from '@plitzi/sdk-elements/authoring';
import { BUILTIN_GLOBAL_CALLBACKS, BUILTIN_UTILITIES } from '@plitzi/sdk-interactions/authoring';
import {
  authorSpace as authorSpaceUnchecked,
  validateSpace as validateSpaceUnchecked
} from '@plitzi/sdk-schema/authoring';

import type {
  AuthorSpaceOptions,
  AuthoredSpace,
  SpaceDocuments,
  SpaceSpec,
  StepVocabulary
} from '@plitzi/sdk-schema/authoring';
import type { SchemaValidationOptions, SchemaValidationResult } from '@plitzi/sdk-schema/helpers/schemaValidator';

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
 * `authorSpace`, holding this SDK's own vocabularies.
 *
 * Deliberately shadows the one re-exported above — an explicit export wins over a star — so that everybody who
 * imports from this entry, or from the `@plitzi/sdk-server/authoring` that re-exports it, gets both checks that
 * need to know what this SDK ships.
 *
 * **Flows.** A step naming a callback on the wrong module is refused; one naming an action no built-in source
 * declares comes back in `warnings`, since a plugin is free to register a module this process cannot see.
 *
 * **Bindings.** A source may name the idRef alone and the prefix the element publishes under is filled in — which
 * is the half an author cannot see, and is not always the element's own type.
 */
export const authorSpace = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): AuthoredSpace =>
  authorSpaceUnchecked(spec, { vocabulary: STEP_VOCABULARY, sourceTypes: elementSourceTypes, ...options });

/**
 * `validateSpace`, holding this SDK's own source catalog — the same gate, for documents authored elsewhere.
 *
 * Which is where it matters most: a JSON edited by hand, or an export whose bindings were retyped. Without the
 * catalog a source can only be half-checked, and the half it cannot see is the one nobody gets right.
 */
export const validateSpace = (space: SpaceDocuments, options: SchemaValidationOptions = {}): SchemaValidationResult =>
  validateSpaceUnchecked(space, { sourceTypes: elementSourceTypes, ...options });
