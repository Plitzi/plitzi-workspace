import { cssProperties } from '../style/cssCatalog';

import type { Schema } from '@plitzi/sdk-shared';

export interface TypePropInfo {
  valueTypes: string[];
  examples: unknown[];
}

export interface TypeInfo {
  count: number;
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

const NOTE =
  'Element types and their props/slots are observed from the elements that already exist in this space — ' +
  'they are ground truth, never inferred. Props list the attribute keys seen on each type with example values. ' +
  'Slots are the styleSelectors keys seen on each type (target them via element.style.slots). CSS in definitions ' +
  'must use the kebab-case keys in cssProperties. Reference schema variables in props via {{name}} and style ' +
  'variables in CSS via var(--name).';

export const buildTypeRegistry = (schema: Schema): TypeRegistry => {
  const types: Record<string, TypeInfo> = {};

  for (const el of Object.values(schema.flat)) {
    const typeName = el.definition.type;
    const info = (types[typeName] ??= { count: 0, subTypes: [], slots: [], props: {} });
    info.count += 1;

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

      if (prop.examples.length < 3 && value !== null && value !== '' && !prop.examples.includes(value)) {
        prop.examples.push(value);
      }
    }
  }

  for (const info of Object.values(types)) {
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
