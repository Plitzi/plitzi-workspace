import { BUILTIN_ELEMENT_CALLBACKS } from '@plitzi/sdk-shared/authoring/elementCallbacks';

import {
  elementAncestorTypes,
  elementAttributeNames,
  elementAttributeValues,
  elementCallbacks,
  elementDefaultAttributes,
  elementLeafTypes,
  elementSlots,
  elementSourceTypes,
  elementTriggers
} from './elements';
import { BUILTIN_GLOBAL_CALLBACKS, BUILTIN_UTILITIES } from './interactions';
import {
  authorSpace as authorSpaceUnchecked,
  authorTemplate as authorTemplateUnchecked,
  lintSpace as lintSpaceUnchecked,
  validateSpace as validateSpaceUnchecked,
  validateTemplate as validateTemplateUnchecked
} from './schema';
import { BUILTIN_TRANSFORMERS } from './transformers';

import type {
  AuthorSpaceOptions,
  AuthoredSpace,
  AuthoredTemplate,
  LintCatalogs,
  LintResult,
  SpaceDocuments,
  SpaceValidationOptions,
  SpaceSpec,
  StepVocabulary,
  Template,
  TemplateSpec
} from './schema';
import type { SchemaValidationResult } from '@plitzi/sdk-schema/helpers/schemaValidator';

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

export * from './decompile';
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
  utilities: BUILTIN_UTILITIES,
  triggers: elementTriggers,
  callbacks: elementCallbacks,
  sharedCallbacks: BUILTIN_ELEMENT_CALLBACKS
};

/** Everything the composed surface knows about the built-in elements that the assembly half cannot import. */
const ELEMENT_CATALOGS: AuthorSpaceOptions = {
  vocabulary: STEP_VOCABULARY,
  sourceTypes: elementSourceTypes,
  ancestorTypes: elementAncestorTypes,
  slotNames: elementSlots,
  attributeNames: elementAttributeNames,
  leafTypes: elementLeafTypes,
  defaultAttributes: elementDefaultAttributes,
  attributeValues: elementAttributeValues,
  transformers: BUILTIN_TRANSFORMERS
};

/**
 * `authorSpace`, holding this SDK's own vocabularies.
 *
 * Deliberately shadows the one re-exported above — an explicit export wins over a star — so that everybody who
 * imports from this package gets both checks that need to know what this SDK ships.
 *
 * **Flows.** A step naming a callback on the wrong module is refused, and so is a flow starting on a trigger its
 * built-in element never fires, or an element callback aimed at a built-in element that does not answer to it; one
 * naming an action no built-in source declares comes back in `warnings`, since a plugin is free to register a
 * module this process cannot see.
 *
 * **Bindings.** A source may name the element alone and the prefix it publishes under is filled in — which
 * is the half an author cannot see, and is not always the element's own type.
 */
export const authorSpace = (spec: SpaceSpec, options: AuthorSpaceOptions = {}): AuthoredSpace =>
  authorSpaceUnchecked(spec, { ...ELEMENT_CATALOGS, ...options });

/**
 * `validateSpace`, holding this SDK's own catalogs — the same gate `authorSpace` puts its output through, for documents
 * written anywhere else: the builder saving through the API, an import, an agent's edit, a JSON edited by hand.
 */
export const validateSpace = (space: SpaceDocuments, options: SpaceValidationOptions = {}): SchemaValidationResult =>
  validateSpaceUnchecked(space, { ...ELEMENT_CATALOGS, ...options });

/**
 * `lintSpace`, holding this SDK's own catalogs: what a space's documents MEAN, read the way the runtime will read
 * them — every template, flow, binding, attribute and link. For a caller that already knows the structure holds and
 * wants the problems to show — a panel of them, beside the element each one names.
 */
export const lintSpace = (space: SpaceDocuments, options: LintCatalogs = {}): LintResult =>
  lintSpaceUnchecked(space, { ...ELEMENT_CATALOGS, ...options });

/**
 * `authorTemplate`, holding the same vocabularies — the artefact you publish when you are not building a space.
 *
 * A template is a subtree hosted as a JSON and dragged onto someone else's canvas, so the checks that matter are
 * the ones about what does NOT travel with it: a class it names but does not carry, a binding onto a provider that
 * stayed behind. Those are the assembly half's; what this adds is the catalog that tells a real source from a typo.
 */
export const authorTemplate = (spec: TemplateSpec, options: AuthorSpaceOptions = {}): AuthoredTemplate =>
  authorTemplateUnchecked(spec, { ...ELEMENT_CATALOGS, ...options });

/** `validateTemplate`, holding this SDK's own catalogs — for a manifest authored elsewhere. */
export const validateTemplate = (template: Template, options: SpaceValidationOptions = {}): SchemaValidationResult =>
  validateTemplateUnchecked(template, { ...ELEMENT_CATALOGS, ...options });
