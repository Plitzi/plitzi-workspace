import { invalidParams, missingRequiredParams } from '@plitzi/sdk-shared/authoring/paramSpec';

import { didYouMean } from './suggest';

import type {
  BindingSpec,
  ElementSpec,
  ElementStyleSpec,
  LayoutSpec,
  PageFolderSpec,
  PageSpec,
  SpaceSpec,
  StepSpec
} from './types';
import type { ParamSpec } from '@plitzi/sdk-shared/authoring/paramSpec';

/**
 * The shape checks that stand between a declaration and the document.
 *
 * TypeScript says all of this to an author who has it — and not to one writing JavaScript, generating JSON, or
 * reaching for a cast. Those still reach `authorSpace`, and a key it does not know or a value outside a list is
 * written into the document, where nothing reads it and nothing reports it. So every field is held here to the same
 * vocabulary the types declare, and a refusal names what was meant.
 */

/** Every field each spec takes. `guard.test.ts` holds each list to its type, so a new field cannot be forgotten here. */
export const SPACE_SPEC_KEYS = [
  'name',
  'permanentUrl',
  'variables',
  'classes',
  'elements',
  'schemaVariables',
  'customCss',
  'notifications',
  'computed',
  'settings',
  'rsc',
  'mode',
  'theme',
  'fonts',
  'pageFolders',
  'layouts',
  'pages'
] as const satisfies readonly (keyof SpaceSpec)[];

export const PAGE_SPEC_KEYS = [
  'name',
  'id',
  'slug',
  'isDefault',
  'seoTitle',
  'seoDescription',
  'accessLevel',
  'unauthorizedRedirect',
  'folder',
  'layout',
  'keepState',
  'stateStorage',
  'css',
  'selector',
  'class',
  'flows',
  'body'
] as const satisfies readonly (keyof PageSpec)[];

export const LAYOUT_SPEC_KEYS = [
  'id',
  'label',
  'folder',
  'layout',
  'attributes',
  'css',
  'states',
  'selector',
  'class',
  'bind',
  'flows',
  'body'
] as const satisfies readonly (keyof LayoutSpec)[];

export const ELEMENT_SPEC_KEYS = [
  'type',
  'id',
  'attributes',
  'variant',
  'css',
  'selector',
  'states',
  'class',
  'slots',
  'bind',
  'visible',
  'flows',
  'runtime',
  'loadStrategy',
  'children',
  'meta'
] as const satisfies readonly (keyof ElementSpec)[];

export const BINDING_SPEC_KEYS = [
  'to',
  'source',
  'category',
  'transformers',
  'when',
  'enabled'
] as const satisfies readonly (keyof BindingSpec)[];

export const STEP_SPEC_KEYS = [
  'id',
  'type',
  'action',
  'title',
  'params',
  'preview',
  'on',
  'when',
  'enabled'
] as const satisfies readonly (keyof StepSpec)[];

export const PAGE_FOLDER_SPEC_KEYS = [
  'id',
  'name',
  'slug',
  'parent'
] as const satisfies readonly (keyof PageFolderSpec)[];

export const ELEMENT_STYLE_SPEC_KEYS = [
  'base',
  'states',
  'variants',
  'ancestors',
  'slots'
] as const satisfies readonly (keyof ElementStyleSpec)[];

export const RUNTIMES = ['server', 'client', 'shared'] as const;
export const LOAD_STRATEGIES = ['eager', 'lazy', 'visible'] as const;
export const BINDING_CATEGORIES = ['attributes', 'style', 'initialState'] as const;
export const ACCESS_LEVELS = ['public', 'authenticated'] as const;
export const STEP_TYPES = ['trigger', 'globalCallback', 'callback', 'utility'] as const;

/** An element id, as the builder and a template can both name it: a letter, then letters, digits, `-` and `_`. */
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Refuses a field the spec does not take, naming the one it probably meant. */
export function assertKnownKeys(
  value: unknown,
  keys: readonly string[],
  where: string,
  hint = ''
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${where} is ${value === null ? 'null' : typeof value}, not an object.`);
  }

  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      throw new Error(
        `${where} has "${key}", which it does not take${didYouMean(key, keys) || '.'} It takes ${keys.join(', ')}.${hint}`
      );
    }
  }
}

/** Refuses a value outside its list — a `runtime`, a `loadStrategy`, a binding's `category`. */
export const assertOneOf = (value: unknown, allowed: readonly string[], where: string, field: string): void => {
  if (value === undefined || (typeof value === 'string' && allowed.includes(value))) {
    return;
  }

  throw new Error(
    `${where}: \`${field}\` is ${JSON.stringify(value)}${(typeof value === 'string' && didYouMean(value, allowed)) || '.'} It is one of ${allowed.map(item => `'${item}'`).join(', ')}.`
  );
};

/** Refuses an id nothing can name: empty, or with characters a template or a selector cannot carry. */
export const assertId = (id: unknown, where: string): void => {
  if (id === undefined) {
    return;
  }

  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error(
      `${where}: the id ${JSON.stringify(id)} is not one a binding, a template or a test can name. Use a letter first, then letters, digits, "-" and "_" — like "hero-title".`
    );
  }
};

/**
 * A binding's own shape: the two fields it cannot work without, a category that exists, and no field it ignores.
 *
 * The map form (`{ content: 'posts.title' }`) writes attributes, so `visibility` there is an attribute nobody reads —
 * the element stays on screen. That one is refused with the field that does it.
 */
export const assertBindingShape = (binding: unknown, where: string): void => {
  assertKnownKeys(binding, BINDING_SPEC_KEYS, `${where}: a binding`);
  const { to, source, category } = binding;
  if (typeof to !== 'string' || to.trim() === '') {
    throw new Error(`${where}: a binding has no \`to\` — the attribute, style property or state key it writes.`);
  }

  if (typeof source !== 'string' || source.trim() === '') {
    throw new Error(`${where}: the binding of "${to}" has no \`source\` — where its value comes from ('posts.title').`);
  }

  assertOneOf(category, BINDING_CATEGORIES, `${where}: the binding of "${to}"`, 'category');
  if (to === 'visibility' && (category ?? 'attributes') === 'attributes') {
    throw new Error(
      `${where} binds "visibility" as an attribute, which no element reads — it would stay on screen. Write \`visible: '${source}'\` on the element (or \`visible: { source: '${source}', template }\`).`
    );
  }
};

/**
 * A step's or a transformer's params against the catalog that declares them: an unknown key when the set is closed,
 * a value of the wrong type or outside its options, a required one left out.
 */
export const assertParams = (
  params: Record<string, unknown> | undefined,
  spec: { strictParams?: boolean; params?: ParamSpec },
  where: string
): void => {
  const declared = spec.params ?? {};
  const provided = params ?? {};
  const names = Object.keys(declared);
  if (spec.strictParams) {
    for (const key of Object.keys(provided)) {
      if (!names.includes(key)) {
        throw new Error(
          `${where} has the param "${key}", which it does not take${didYouMean(key, names) || '.'} It takes ${names.length > 0 ? names.join(', ') : 'none'}.`
        );
      }
    }
  }

  const invalid = invalidParams(provided, provided, declared).at(0);
  if (invalid) {
    const value = JSON.stringify(provided[invalid.key]);
    throw new Error(
      invalid.options
        ? `${where}: "${invalid.key}" is ${value}${(typeof provided[invalid.key] === 'string' && didYouMean(String(provided[invalid.key]), invalid.options)) || '.'} It is one of ${invalid.options.map(option => `'${option}'`).join(', ')}.`
        : `${where}: "${invalid.key}" is ${value} (${invalid.got}), and it takes a ${invalid.expected}.`
    );
  }

  const missing = missingRequiredParams(provided, provided, declared).at(0);
  if (missing) {
    throw new Error(`${where} needs "${missing}": ${declared[missing].description}`);
  }
};
