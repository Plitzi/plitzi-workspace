import { BUILTIN_COMPONENTS } from './builtinComponents';
import { cssProperties } from './cssCatalog';

import type { ComponentCatalog, Schema } from '@plitzi/sdk-shared';

export interface TypePropInfo {
  valueTypes: string[];
  examples: unknown[];
}

/** Where a type's semantics came from: a Plitzi 'builtin' (curated), a 'plugin' (custom element, from the
 *  getComponentCatalog adapter), or 'unknown' (observed in the schema but neither knows it — label only). */
export type TypeSource = 'builtin' | 'plugin' | 'unknown';

export interface TypeInfo {
  count: number;
  /** Human name of the type (e.g. "Api Container"). */
  label?: string;
  /** What the type is FOR — so an agent picks the right one. */
  description?: string;
  /** Grouping (provider, structure, media, form, advanced…). */
  category?: string;
  source: TypeSource;
  subTypes: string[];
  slots: string[];
  props: Record<string, TypePropInfo>;
}

export interface TypeRegistry {
  note: string;
  cssProperties: string[];
  styleVariableCategories: string[];
  templateSyntax: { schemaVariable: string; styleVariable: string };
  types: Record<string, TypeInfo>;
}

// Layer semantic + machine-readable metadata onto a type. The per-space component catalog (default sdk-elements
// types ∪ this space's plugin types) is authoritative and takes precedence: it carries the type's FULL attribute
// set and style selectors — so a type is known even with zero instances placed, and `source` follows the catalog's
// `custom` flag. The hand-curated BUILTIN_COMPONENTS is only a fallback for the no-adapter MCP role. Mutates in
// place.
const enrichType = (typeName: string, info: TypeInfo, catalog: ComponentCatalog | undefined): void => {
  const entry = catalog?.[typeName];
  if (entry) {
    info.label = entry.label ?? info.label;
    if (entry.description !== undefined) {
      info.description = entry.description;
    }

    if (entry.category !== undefined) {
      info.category = entry.category;
    }

    info.source = entry.custom ? 'plugin' : 'builtin';
    for (const attr of entry.attributes ?? []) {
      info.props[attr] ??= { valueTypes: [], examples: [] };
    }

    for (const slot of entry.styleSelectors ?? []) {
      if (!info.slots.includes(slot)) {
        info.slots.push(slot);
      }
    }

    return;
  }

  const builtin = BUILTIN_COMPONENTS[typeName];
  if (builtin) {
    info.label = builtin.label;
    info.description = builtin.description;
    info.category = builtin.category;
    info.source = 'builtin';
  }
};

// Only small scalars are kept as prop examples: a long string (e.g. a base64 blockJsx contentCache is thousands
// of chars) or a whole array/object bloats the type registry — which rides in the cold-start primer — for no
// discovery value. The valueType is still recorded, so the shape is preserved without the payload.
const EXAMPLE_MAX_LENGTH = 80;

const isCompactExample = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.length <= EXAMPLE_MAX_LENGTH;
  }

  return typeof value === 'number' || typeof value === 'boolean';
};

const NOTE =
  'Element types and their props/slots are observed from the elements that already exist in this space — ' +
  'they are ground truth, never inferred. Each type also carries a `label`, `description` (what it is FOR) and ' +
  '`category`, plus a `source`: "builtin" (a Plitzi element), "plugin" (a custom element added via a plugin), or ' +
  '"unknown" (observed but undescribed — label only). Use the description to pick the right type (e.g. ' +
  'apiContainer fetches backend data, link navigates between pages). Props list the attribute keys seen on each ' +
  'type with example values. Slots are the styleSelectors keys seen on each type (target them via ' +
  'element.style.slots). CSS in definitions must use the kebab-case keys in cssProperties. Reference schema ' +
  'variables in props via {{name}} and style variables in CSS via var(--name).';

export const buildTypeRegistry = (schema: Schema, catalog?: ComponentCatalog): TypeRegistry => {
  const types: Record<string, TypeInfo> = {};

  for (const el of Object.values(schema.flat)) {
    const typeName = el.definition.type;
    const info = (types[typeName] ??= { count: 0, source: 'unknown', subTypes: [], slots: [], props: {} });
    info.count += 1;

    // Fallback label from the instance, used only when neither the built-in dictionary nor the plugin catalog
    // names the type. Instance labels are user-editable, so the first non-empty one is a best-effort hint.
    if (!info.label && typeof el.definition.label === 'string' && el.definition.label !== '') {
      info.label = el.definition.label;
    }

    const subType = el.attributes.subType;
    if (typeof subType === 'string' && !info.subTypes.includes(subType)) {
      info.subTypes.push(subType);
    }

    for (const slot of Object.keys(el.definition.styleSelectors)) {
      if (!info.slots.includes(slot)) {
        info.slots.push(slot);
      }
    }

    for (const [key, value] of Object.entries(el.attributes)) {
      if (key === 'subType') {
        continue;
      }

      const prop = (info.props[key] ??= { valueTypes: [], examples: [] });
      const valueType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      if (!prop.valueTypes.includes(valueType)) {
        prop.valueTypes.push(valueType);
      }

      if (prop.examples.length < 3 && isCompactExample(value) && value !== '' && !prop.examples.includes(value)) {
        prop.examples.push(value);
      }
    }
  }

  // Catalog types with no instance placed yet are still valid types the agent can use — surface them so the
  // registry (and the validation that reads it) is not limited to what already exists in the space.
  for (const typeName of Object.keys(catalog ?? {})) {
    types[typeName] ??= { count: 0, source: 'unknown', subTypes: [], slots: [], props: {} };
  }

  for (const [typeName, info] of Object.entries(types)) {
    enrichType(typeName, info, catalog);
    info.subTypes.sort();
    info.slots.sort();
  }

  return {
    note: NOTE,
    cssProperties,
    styleVariableCategories: ['color', 'spacing', 'shadow', 'custom'],
    templateSyntax: { schemaVariable: '{{name}}', styleVariable: 'var(--name)' },
    types
  };
};
