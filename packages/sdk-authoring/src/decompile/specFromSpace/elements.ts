import { componentNamed, isInstance } from '@plitzi/sdk-schema';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readBindings, readFlows } from './bindings';
import { classesOf, elementBaseStyle, keepClassList } from './classes';
import { childrenOf, dropField } from './tree';
import {
  ATTRIBUTE_NAMES,
  ATTRIBUTE_VALUE_FIXES,
  DEFINITION_FIELDS,
  LEGACY_ELEMENT_TYPES,
  isEmpty,
  correct
} from './values';
import { defaultAttributes } from '../../elements';
import { isSuggestionCode } from '../../schema/codes';
import { flagSpecOf } from '../../schema/flags';

import type { SpecReader } from './reader';
import type { ElementSpec } from '../../schema';
import type { Element } from '@plitzi/sdk-shared';

const typeOf = (
  reader: SpecReader,
  element: Element
): { type: string; legacy?: (typeof LEGACY_ELEMENT_TYPES)[string] } => {
  const original = element.definition.type;
  const legacy = LEGACY_ELEMENT_TYPES[original] as (typeof LEGACY_ELEMENT_TYPES)[string] | undefined;
  if (legacy) {
    correct(
      reader,
      'legacy-element-type',
      `"${element.id}" was a ${original}, which is a ${legacy.type} today.`,
      element.id
    );

    return { type: legacy.type, legacy };
  }

  if (!Object.hasOwn(ATTRIBUTE_NAMES, original) && !reader.pluginTypes.has(original)) {
    correct(
      reader,
      'unknown-element-type',
      `"${element.id}" is a ${original}, which neither the SDK nor a declared plugin provides; kept as it is.`,
      element.id
    );
  }

  return { type: original };
};

export const readElement = (reader: SpecReader, element: Element): ElementSpec => {
  reader.reachable.add(element.id);
  const definition = element.definition;
  for (const key of Object.keys(definition)) {
    if (!DEFINITION_FIELDS.has(key)) {
      dropField(reader, `"${key}"`);
    }
  }

  const { type, legacy } = typeOf(reader, element);
  // Some documents store an element with no attributes as an empty ARRAY, which reads as an object with none.
  const stored = isRecord(element.attributes) ? element.attributes : {};
  const attributes = readAttributes(
    reader,
    type,
    legacy ? legacy.attributes(stored) : stored,
    placedNames(reader, element)
  );
  const keepId = reader.options.keepIds === true || !reader.derived.has(element.id);

  const { base: baseSelector, ...slotSelectors } = definition.styleSelectors;
  const baseStyle = elementBaseStyle(reader, baseSelector, element.id);
  const style = legacy?.css && !baseStyle.class && !baseStyle.css ? { ...baseStyle, css: legacy.css } : baseStyle;
  const slots = Object.fromEntries(
    Object.entries(slotSelectors).flatMap(([slot, selector]) => {
      const names = selector ? classesOf(selector) : [];
      if (names.length > 1) {
        const kept = keepClassList(reader, names);

        return kept ? [[slot, kept]] : [];
      }

      // A lone selector with no entry holds no rules — the same answer `baseStyle` gives.
      if (!selector || !reader.classBlocks.has(selector)) {
        return [];
      }

      reader.keptClasses.add(selector);

      return [[slot, selector]];
    })
  );

  const { bind, visible } = readBindings(reader, element);
  const variant = readInitialState(reader, element, type);

  return {
    type,
    ...(keepId ? { id: element.id } : {}),
    attributes,
    ...style,
    ...(variant ? { variant } : {}),
    ...(isEmpty(slots) ? {} : { slots }),
    ...(bind ? { bind } : {}),
    ...(visible === undefined ? {} : { visible }),
    ...readFlows(reader, element),
    ...(definition.runtime ? { runtime: definition.runtime } : {}),
    ...(definition.loadStrategy ? { loadStrategy: definition.loadStrategy } : {}),
    ...(definition.anchor ? { anchor: definition.anchor } : {}),
    ...(definition.motion ? { motion: definition.motion } : {}),
    ...(definition.quiet ? { quiet: definition.quiet.filter(isSuggestionCode) } : {}),
    ...(definition.flag ? { flag: flagSpecOf(definition.flag) } : {}),
    meta: { label: definition.label },
    ...childrenSpec(reader, element)
  };
};

/**
 * The attributes the element's component reads, and none of the rest.
 *
 * What a type does not declare is what an older builder left behind — a field that was renamed (`loading`, now
 * `loadMode`) or a control nobody renders any more — and nothing reads it. A type the SDK does not ship keeps all
 * of its attributes, since nothing here knows what its component reads.
 */
/**
 * The attributes an element has because of where it is: an instance carries the props its component declares, and
 * a child of an instance names the slot it fills.
 */
const placedNames = (reader: SpecReader, element: Element): string[] => {
  const { referenceId } = element.attributes;
  const component =
    isInstance(element) && typeof referenceId === 'string'
      ? componentNamed(reader.documents.schema, referenceId)
      : undefined;
  const parentId = element.definition.parentId;
  const parent = parentId && Object.hasOwn(reader.flat, parentId) ? reader.flat[parentId] : undefined;

  return [...Object.keys(component?.props ?? {}), ...(parent && isInstance(parent) ? ['slot'] : [])];
};

const readAttributes = (
  reader: SpecReader,
  type: string,
  attributes: Record<string, unknown>,
  placed: readonly string[] = []
): Record<string, unknown> => {
  const declared = Object.hasOwn(ATTRIBUTE_NAMES, type) ? ATTRIBUTE_NAMES[type] : undefined;
  if (!declared) {
    return attributes;
  }

  const names = [...declared, ...placed];

  const defaults = defaultAttributes(type);
  const fixes = Object.hasOwn(ATTRIBUTE_VALUE_FIXES, type) ? ATTRIBUTE_VALUE_FIXES[type] : undefined;
  const kept: [string, unknown][] = [];
  for (const [name, value] of Object.entries(attributes)) {
    if (!names.includes(name)) {
      const key = `${type}.${name}`;
      reader.droppedAttributes.set(key, (reader.droppedAttributes.get(key) ?? 0) + 1);
      continue;
    }

    // "Not set", in the two spellings an older builder used: `null`, and an empty list where the element keeps
    // a record. Left out, the factory writes the element's own default, which is what the component falls back to.
    const emptyList = Array.isArray(value) && value.length === 0 && isRecord(defaults[name]);
    if (value === null || emptyList) {
      continue;
    }

    if (typeof value === 'string' && fixes && Object.hasOwn(fixes, name) && Object.hasOwn(fixes[name], value)) {
      const fixed = fixes[name][value];
      correct(reader, 'fixed-attribute', `A ${type} ${name} of "${value}" is "${fixed}" today.`);
      kept.push([name, fixed]);
      continue;
    }

    kept.push([name, value]);
  }

  const read = Object.fromEntries(kept);
  // A link in `page` mode names a page, and a full URL there rendered as a path inside the space: `/https://…`.
  if (type === 'link' && (read.mode ?? defaults.mode) === 'page' && typeof read.href === 'string') {
    if (/^https?:\/\//.test(read.href)) {
      correct(reader, 'fixed-attribute', `A link to "${read.href}" in page mode is \`mode: 'external'\` today.`);

      return { ...read, mode: 'external' };
    }
  }

  return read;
};

const childrenSpec = (reader: SpecReader, element: Element): { children?: ElementSpec[] } => {
  // No list, an empty one and a leaf are one answer: authoring writes `items: []` on every element it inserts.
  const children = childrenOf(reader, element);

  return children.length > 0 ? { children: children.map(child => readElement(reader, child)) } : {};
};

const readInitialState = (reader: SpecReader, element: Element, type: string): string | undefined => {
  const initialState = element.definition.initialState ?? {};
  for (const key of Object.keys(initialState)) {
    if (key !== 'visibility' && key !== 'styleVariant') {
      correct(
        reader,
        'dropped-initial-state',
        `"${element.id}" started with ${key} set, which nothing authored can declare.`,
        element.id
      );
    }
  }

  const styleVariant = initialState.styleVariant;

  if (!styleVariant) {
    return undefined;
  }

  // A variant keyed by a class the element wears is that class's — authoring keys it so when the class declares
  // the variant and the type does not, and reads the same `variant` back into the same key.
  const worn = element.definition.styleSelectors.base
    .split(/\s+/)
    .filter(name => name !== '' && styleVariant[name] !== undefined);
  const ownKeys = [element.definition.type, type, ...worn];
  const own =
    styleVariant[element.definition.type] ?? styleVariant[type] ?? (worn[0] ? styleVariant[worn[0]] : undefined);
  const others = Object.keys(styleVariant).filter(key => !ownKeys.includes(key));
  if (others.length > 0 || (own && Object.keys(own).some(selector => selector !== 'base'))) {
    correct(
      reader,
      'dropped-initial-state',
      `"${element.id}" started in a style variant of ${[...others, 'its parts'].join(', ')}, which only an element's base can declare.`,
      element.id
    );
  }

  const base = own?.base;

  return typeof base === 'string' && base ? base : undefined;
};
