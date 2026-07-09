import { findPageByRef, getPageElements, pageRefOf } from '../helpers';
import { buildTypeRegistry, isCssProperty, suggestCssProperty } from '../resources';

import type { DefinitionSlotInput, ElementInput, Operation } from './operations';
import type { Space } from '../helpers';
import type { ValidationError } from '../types';

const REF_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_OPS = 100;
const STYLE_CATEGORIES = ['color', 'spacing', 'shadow', 'custom'];

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

const checkRef = (ref: string, path: string, errors: ValidationError[]): void => {
  if (!ref || ref.trim().length === 0) {
    errors.push({ path, message: 'Ref must not be empty', hint: 'Use a semantic name like "hero.title"' });

    return;
  }

  if (!REF_RE.test(ref)) {
    errors.push({
      path,
      message: `Ref "${ref}" has invalid characters`,
      hint: 'Allowed characters: letters, numbers, dot, hyphen, underscore'
    });
  }
};

const checkCss = (css: Record<string, string | number> | undefined, path: string, errors: ValidationError[]): void => {
  if (!css) {
    return;
  }

  for (const key of Object.keys(css)) {
    if (!isCssProperty(key)) {
      const suggestion = suggestCssProperty(key);
      errors.push({
        path: `${path}.${key}`,
        message: `Unknown CSS property "${key}"`,
        hint: suggestion
          ? `Use the kebab-case key "${suggestion}"`
          : 'Read plitzi://css-properties for the valid property keys'
      });
    }
  }
};

const checkSlotCss = (slot: DefinitionSlotInput, path: string, errors: ValidationError[]): void => {
  checkCss(slot.desktop, `${path}.desktop`, errors);
  checkCss(slot.tablet, `${path}.tablet`, errors);
  checkCss(slot.mobile, `${path}.mobile`, errors);
  for (const [state, dm] of Object.entries(slot.states ?? {})) {
    checkCss(dm.desktop, `${path}.states.${state}.desktop`, errors);
    checkCss(dm.tablet, `${path}.states.${state}.tablet`, errors);
    checkCss(dm.mobile, `${path}.states.${state}.mobile`, errors);
  }

  for (const [name, dm] of Object.entries(slot.variants ?? {})) {
    checkCss(dm.desktop, `${path}.variants.${name}.desktop`, errors);
    checkCss(dm.tablet, `${path}.variants.${name}.tablet`, errors);
    checkCss(dm.mobile, `${path}.variants.${name}.mobile`, errors);
  }
};

const checkElementInput = (
  element: ElementInput,
  path: string,
  knownTypes: Set<string>,
  errors: ValidationError[],
  warnings: string[],
  seen: Set<string>
): void => {
  checkRef(element.ref, `${path}.ref`, errors);
  if (seen.has(element.ref)) {
    errors.push({
      path: `${path}.ref`,
      message: `Duplicate ref "${element.ref}" in this batch`,
      hint: 'Use a unique ref'
    });
  }

  seen.add(element.ref);

  if (!element.type) {
    errors.push({
      path: `${path}.type`,
      message: 'Element type is required',
      hint: 'Read plitzi://types for known types'
    });
  } else if (!knownTypes.has(element.type)) {
    warnings.push(`Type "${element.type}" was not seen in this space; ensure a plugin provides it (${path}.type).`);
  }

  element.children?.forEach((child, i) =>
    checkElementInput(child, `${path}.children[${i}]`, knownTypes, errors, warnings, seen)
  );
};

export const validateOperations = (space: Space, ops: Operation[]): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const knownTypes = new Set(Object.keys(buildTypeRegistry(space.schema).types));

  if (ops.length > MAX_OPS) {
    errors.push({
      path: 'operations',
      message: `Batch has ${ops.length} operations (max ${MAX_OPS})`,
      hint: `Split into batches of at most ${MAX_OPS}`
    });
  }

  ops.forEach((op, i) => {
    const base = `operations[${i}]`;

    if ((op.type === 'upsertElement' || op.type === 'deleteElement' || op.type === 'moveElement') && op.pageRef) {
      if (!findPageByRef(space.schema, op.pageRef)) {
        const validRefs = getPageElements(space.schema).map(pageRefOf);
        errors.push({
          path: `${base}.pageRef`,
          message: `Page "${op.pageRef}" does not exist`,
          hint: 'Use an existing page ref',
          validValues: validRefs
        });
      }
    }

    switch (op.type) {
      case 'upsertElement':
        checkElementInput(op.element, `${base}.element`, knownTypes, errors, warnings, new Set());
        break;
      case 'upsertDefinition': {
        const { type, ref, slots, ...slot } = op;
        void type;
        checkRef(ref, `${base}.ref`, errors);
        checkSlotCss(slot, base, errors);
        for (const [slotName, slotDef] of Object.entries(slots ?? {})) {
          checkSlotCss(slotDef, `${base}.slots.${slotName}`, errors);
        }

        break;
      }
      case 'deleteDefinition':
      case 'upsertPage':
      case 'deletePage':
      case 'upsertVariable':
      case 'deleteVariable':
        checkRef('ref' in op ? op.ref : op.name, `${base}.${'ref' in op ? 'ref' : 'name'}`, errors);
        break;
      case 'upsertStyleVariable':
      case 'deleteStyleVariable':
        if (!STYLE_CATEGORIES.includes(op.category)) {
          errors.push({
            path: `${base}.category`,
            message: `Unknown style-variable category "${op.category}"`,
            hint: 'Use one of the valid categories',
            validValues: STYLE_CATEGORIES
          });
        }

        break;
      default:
        break;
    }
  });

  return { valid: errors.length === 0, errors, warnings };
};
