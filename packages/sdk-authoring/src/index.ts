import { elementSourceTypes } from './elements';
import { BUILTIN_GLOBAL_CALLBACKS, BUILTIN_UTILITIES } from './interactions';
import {
  authorSpace as authorSpaceUnchecked,
  authorTemplate as authorTemplateUnchecked,
  validateSpace as validateSpaceUnchecked,
  validateTemplate as validateTemplateUnchecked
} from './schema';

import type {
  AuthorSpaceOptions,
  AuthoredSpace,
  AuthoredTemplate,
  SpaceDocuments,
  SpaceSpec,
  StepVocabulary,
  Template,
  TemplateSpec
} from './schema';
import type { SchemaValidationOptions, SchemaValidationResult } from '@plitzi/sdk-schema/helpers/schemaValidator';

/**
 * Authoring a space, or a template, in code — and the only place any of it lives.
 *
 * Every part of the surface is here: the CSS vocabulary, the element factories, the interaction catalogs and step
 * builders, the binding transformers, and the assembly and validation that turn specs into documents. It used to
 * be a fragment inside each package that owned the thing it described, composed at the end; that made five places
 * to look for one answer, and the composition was the only file that knew they belonged together.
 *
 * What stayed behind is what a RUNTIME reads: an element's declaration primitive, the adapter that draws a declared
 * param as a control, the callbacks a source registers. Those live in `@plitzi/sdk-shared/authoring` — one folder,
 * so nobody has to hunt for them — and this package reads them like anyone else and re-exports them. The arrow
 * points one way, always, and that is what lets this be a package rather than a folder.
 *
 * It is deliberately free of React and of anything that touches a browser: a seed, a migration, a self-hosted
 * server, a build script and a hosted template are the places a document gets authored, and none of them can load
 * a component. That is enforced by what it holds — data and functions over data, nothing else — and by a build
 * that bundles its four workspace dependencies in and declares none at all.
 */

export * from './elements';
export * from './interactions';
export * from './schema';
export * from './spaces';
export * from './style';
export * from './transformers';

/**
 * The one part of the surface that cannot live here: the vocabulary a RUNTIME reads.
 *
 * An element declares itself with `elementDeclaration` while a page renders, and a source turns its declarations
 * into the builder's controls with `toInteractionCallback` — so both live in `@plitzi/sdk-shared/authoring`, the
 * package everything already depends on, gathered in one folder of their own. Re-exported whole so authoring is
 * still ONE import: an author writing an element's attributes wants `AuthorableAttributes` beside the factory that
 * takes them, and should never learn that this boundary exists.
 */
export * from '@plitzi/sdk-shared/authoring';

/**
 * What a step may name in a document authored here.
 *
 * The catalogs are declared beside the code that implements each action, and the assembly half cannot read them on
 * its own: `@plitzi/sdk-interactions` depends on `@plitzi/sdk-schema`, so the import would close a cycle. This
 * package is the one place that holds both, which is why the check is composed here rather than there.
 */
const STEP_VOCABULARY: StepVocabulary = {
  globalCallbacks: BUILTIN_GLOBAL_CALLBACKS,
  utilities: BUILTIN_UTILITIES
};

/**
 * `authorSpace`, holding this SDK's own vocabularies.
 *
 * Deliberately shadows the one re-exported above — an explicit export wins over a star — so that everybody who
 * imports from this package gets both checks that need to know what this SDK ships.
 *
 * **Flows.** A step naming a callback on the wrong module is refused; one naming an action no built-in source
 * declares comes back in `warnings`, since a plugin is free to register a module this process cannot see.
 *
 * **Bindings.** A source may name the element alone and the prefix it publishes under is filled in — which
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

/**
 * `authorTemplate`, holding the same vocabularies — the artefact you publish when you are not building a space.
 *
 * A template is a subtree hosted as a JSON and dragged onto someone else's canvas, so the checks that matter are
 * the ones about what does NOT travel with it: a class it names but does not carry, a binding onto a provider that
 * stayed behind. Those are the assembly half's; what this adds is the catalog that tells a real source from a typo.
 */
export const authorTemplate = (spec: TemplateSpec, options: AuthorSpaceOptions = {}): AuthoredTemplate =>
  authorTemplateUnchecked(spec, { vocabulary: STEP_VOCABULARY, sourceTypes: elementSourceTypes, ...options });

/** `validateTemplate`, holding this SDK's own source catalog — for a manifest authored elsewhere. */
export const validateTemplate = (template: Template, options: SchemaValidationOptions = {}): SchemaValidationResult =>
  validateTemplateUnchecked(template, { sourceTypes: elementSourceTypes, ...options });
