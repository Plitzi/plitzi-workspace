import { GLOBAL_SOURCES } from './bindings';
import { slugify } from './ids';
import { authorSpace } from './space';
import { validateSpace } from './validate';

import type { AuthorSpaceOptions, AuthoredTemplate, TemplateSpec } from './types';
import type {
  SchemaValidationError,
  SchemaValidationOptions,
  SchemaValidationResult
} from '@plitzi/sdk-schema/helpers/schemaValidator';
import type { Element, Schema, Style, Template } from '@plitzi/sdk-shared';

/**
 * Authoring a template — the artefact someone publishes when they are not building a space.
 *
 * A template is a subtree, the style rules that dress it and a name, hosted as a JSON someone drags onto a canvas
 * that this file has never seen. That last part is the whole difficulty: a space is validated against itself, and
 * a template is validated against a space it will only meet later. Everything below exists to catch what only
 * shows up over there — a class the template names but does not carry, a binding onto a provider that stayed
 * behind.
 *
 * The subtree is authored as a one-page space and the page is then taken off. Not a shortcut: it is what keeps a
 * template held to exactly the rules a space is held to — the same id derivation, the same class declarations, the
 * same flow vocabulary, the same insertion through `FlatMap` — instead of a second, laxer writer of documents.
 *
 * `FlatMap.flatAsTemplate` is the same artefact from the other direction — the builder cutting a subtree out of a
 * live space — and stays where it is. It answers a question that does not arise here (which of a space's rules and
 * variables belong to this subtree; here it is everything the declaration carries), and it clones through
 * `cloneElements`, which mints fresh ids: authoring the same template twice has to write the same file.
 */

/** The artefact this module produces, re-exported so authoring a template needs one import. */
export type { Template } from '@plitzi/sdk-shared';

const dedupe = (errors: SchemaValidationError[]): SchemaValidationError[] => {
  const seen = new Set<string>();

  return errors.filter(error => {
    const key = `${error.code}:${error.elementId ?? ''}:${error.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
};

/**
 * The base element and everything under it, re-rooted on the base.
 *
 * A template carries no page, so the root of the subtree becomes its own `rootId` and answers to no parent — which
 * is the shape `cloneElements` expects when the template is dropped into someone else's space.
 */
const fragmentOf = (flat: Schema['flat'], baseElementId: string): Schema['flat'] => {
  const fragment: Schema['flat'] = {};

  const walk = (id: string): void => {
    const element = flat[id] as Element | undefined;
    if (!element) {
      return;
    }

    const isBase = id === baseElementId;
    const { parentId, ...definition } = element.definition;

    fragment[id] = {
      ...element,
      definition: {
        ...definition,
        rootId: baseElementId,
        ...(isBase ? {} : { parentId })
      }
    };

    element.definition.items?.forEach(walk);
  };

  walk(baseElementId);

  return fragment;
};

const styleHolds = (style: Style, selector: string): boolean =>
  Object.values(style.platform).some(items => selector in items);

/**
 * A selector minted for one element, as opposed to a class the author named.
 *
 * The distinction cannot be read off a document — both are plain names in `styleSelectors` — but it decides
 * whether a name missing from the style is a problem: a minted selector carries the element's own rules and is
 * simply not written when there are none, while a NAMED class that is missing is a rule the template expected to
 * bring along and did not. Judged by shape, and the cost of judging wrong is a warning nobody gets rather than one
 * that misleads.
 */
const looksMinted = (selector: string, type: string): boolean => new RegExp(`^${type}-[0-9a-f]+$`).test(selector);

/**
 * Classes the template names but does not carry.
 *
 * The failure it removes is invisible to whoever publishes the template and lands on whoever installs it: the
 * element keeps the class, the class resolves to nothing in the space it was dropped into, and it renders
 * unstyled — a document every layer considers perfectly valid.
 *
 * A warning rather than an error, because a name absent from the style has two readings and only the author can
 * tell them apart; deduped by name, so a class named by forty elements is heard once.
 */
const validateSelectors = (schema: Schema, style: Style): SchemaValidationError[] => {
  const missing = new Map<string, string>();

  Object.values(schema.flat).forEach(element => {
    Object.values(element.definition.styleSelectors).forEach(value => {
      value
        .split(/\s+/)
        .filter(Boolean)
        .forEach(selector => {
          // The element-type selector every element of a type carries: it belongs to the SDK, not to the template.
          if (selector.startsWith('plitzi__') || looksMinted(selector, element.definition.type)) {
            return;
          }

          if (!styleHolds(style, selector)) {
            missing.set(selector, element.id);
          }
        });
    });
  });

  return [...missing].map(([selector, elementId]) => ({
    code: 'TEMPLATE_SELECTOR_NOT_CARRIED',
    message: `This template names the class "${selector}", which its own style does not declare. Dropped into another space it renders unstyled unless that space happens to declare the same name.`,
    elementId,
    details: { selector }
  }));
};

/**
 * A binding onto something the template leaves behind.
 *
 * A source names an element by id, and a template is a fragment: bind to a provider that stayed in the space
 * the template was cut from and the binding is dead the moment it is published — the element renders its
 * placeholder, and nothing anywhere reports a missing name. It is the failure a template author cannot see, and
 * the one that survives every other check, since the document is internally consistent about a name that is
 * simply not there.
 */
const validateBindingScope = (schema: Schema): SchemaValidationError[] => {
  const errors: SchemaValidationError[] = [];
  const refs = new Set(Object.keys(schema.flat));

  Object.values(schema.flat).forEach(element => {
    Object.entries(element.definition.bindings ?? {}).forEach(([category, bindings]) => {
      bindings.forEach(binding => {
        const head = binding.source.split('.')[0];
        const separator = head.indexOf('_');
        if (separator === -1) {
          // The globals are registered by the space, so they travel with any of them.
          return;
        }

        const ref = head.slice(separator + 1);
        if (refs.has(ref)) {
          return;
        }

        errors.push({
          code: 'TEMPLATE_BINDING_OUT_OF_SCOPE',
          message: `Element "${element.id}" binds ${category}.${binding.to} to "${binding.source}", but "${ref}" is not part of this template. The element publishing it stays behind, so the binding resolves to nothing wherever the template is dropped — bring the provider into the template, or bind to one of the globals (${GLOBAL_SOURCES.join(', ')}).`,
          elementId: element.id,
          details: { source: binding.source, elementId: ref }
        });
      });
    });
  });

  return errors;
};

/**
 * Whether a template is one a builder can instantiate.
 *
 * Everything `validateSpace` asks of a pair of documents, read as a fragment rather than as a space — orphans are
 * counted from the base element, since there are no pages to count them from — plus the four things only a
 * template can get wrong.
 */
export const validateTemplate = (template: Template, options: SchemaValidationOptions = {}): SchemaValidationResult => {
  const { definition, schema, style } = template;
  const { baseElementId } = definition;
  const errors: SchemaValidationError[] = [];

  const base = schema.flat[baseElementId] as Element | undefined;
  if (!base) {
    errors.push({
      code: 'TEMPLATE_MISSING_BASE',
      message: `This template names "${baseElementId}" as its base element, which is not in its schema. That is the element a builder instantiates, so nothing would be dropped.`,
      details: { baseElementId }
    });
  } else if (base.definition.parentId) {
    errors.push({
      code: 'TEMPLATE_BASE_NOT_ROOT',
      message: `The base element "${baseElementId}" has parentId "${base.definition.parentId}". A template's base element is the root of what travels and answers to no parent.`,
      elementId: baseElementId
    });
  }

  const pages = Object.values(schema.flat).filter(element => element.definition.type === 'page');
  pages.forEach(page =>
    errors.push({
      code: 'TEMPLATE_CONTAINS_PAGE',
      message: `Element "${page.id}" is a page. A template is a subtree dropped onto a canvas — a page inside one has nowhere to go.`,
      elementId: page.id
    })
  );

  const { errors: spaceErrors, warnings } = validateSpace({ schema, style }, { ...options, baseElementId });
  const all = dedupe([...spaceErrors, ...errors, ...validateBindingScope(schema)]);

  return { valid: all.length === 0, errors: all, warnings: dedupe([...warnings, ...validateSelectors(schema, style)]) };
};

/** The throwing flavour. Returns what was survivable so a caller can decide what to do about it. */
export const assertTemplateValid = (
  template: Template,
  context: string,
  options: SchemaValidationOptions = {}
): SchemaValidationError[] => {
  const { valid, errors, warnings } = validateTemplate(template, options);
  if (!valid) {
    throw new Error(
      `Invalid template (${context}):\n${errors.map(error => `  - [${error.code}] ${error.message}`).join('\n')}`
    );
  }

  return warnings;
};

/**
 * Build a template's manifest from a declaration. Throws if the result would not be one a builder can instantiate.
 *
 * The manifest is handed back on its own so it can be written out as it stands — `JSON.stringify(template)` is the
 * file a builder fetches — with the warnings beside it rather than inside it.
 */
export const authorTemplate = (spec: TemplateSpec, options: AuthorSpaceOptions = {}): AuthoredTemplate => {
  const { name, description, root } = spec;
  const { schema, style, warnings } = authorSpace(
    {
      name,
      permanentUrl: spec.key ?? slugify(name, 'template'),
      classes: spec.classes,
      elements: spec.elements,
      variables: spec.variables,
      schemaVariables: spec.schemaVariables,
      mode: spec.mode,
      theme: spec.theme,
      pages: [{ name, slug: '', body: [root] }]
    },
    options
  );

  const page = schema.flat[schema.pages[0]];
  const [baseElementId] = page.definition.items ?? [];

  const template: Template = {
    definition: { name, description, baseElementId },
    schema: { ...schema, flat: fragmentOf(schema.flat, baseElementId), pages: [] },
    style
  };

  // The space it was authored as and the fragment that ships are two readings of the same document, so a structural
  // warning is raised by both; the step warnings only the space pass can produce.
  const templateWarnings = assertTemplateValid(template, `authored template "${name}"`, {
    sourceTypes: options.sourceTypes
  });

  return { template, warnings: dedupe([...warnings, ...templateWarnings]) };
};
