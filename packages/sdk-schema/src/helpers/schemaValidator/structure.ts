/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { isValidElementId } from '../elementId';

import type { ValidationContext } from './context';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** The document's shape: its fields, each element, parents and children agreeing, no cycle, ids that can be named. */

// 1. Validate basic schema structure
export const validateStructure = ({ errors, flat, pages, pageFolders, variables, components }: ValidationContext) => {
  if (!(flat as Schema['flat'] | undefined) || typeof flat !== 'object') {
    errors.push({ code: 'INVALID_FLAT', message: 'Schema.flat must be a valid Record<string, Element>' });
    return false;
  }
  if (!Array.isArray(pages)) {
    errors.push({ code: 'INVALID_PAGES', message: 'Schema.pages must be an array of element IDs' });
    return false;
  }
  if (!Array.isArray(pageFolders)) {
    errors.push({ code: 'INVALID_PAGE_FOLDERS', message: 'Schema.pageFolders must be an array' });
    return false;
  }
  if (!Array.isArray(variables)) {
    errors.push({ code: 'INVALID_VARIABLES', message: 'Schema.variables must be an array' });
    return false;
  }
  if (!components || typeof components !== 'object') {
    errors.push({
      code: 'INVALID_COMPONENTS',
      message: 'Schema.components must be a Record<string, SpaceComponent>'
    });
    return false;
  }
  return true;
};

// 2. Validate each element
export const validateElements = ({ errors, warnings, flat, elementExists }: ValidationContext) => {
  Object.entries(flat).forEach(([id, element]) => {
    if (!(element as Element | undefined)) {
      errors.push({ code: 'NULL_ELEMENT', message: `Element with id "${id}" is null or undefined`, elementId: id });

      return;
    }

    // Check required fields
    if (!element.id) {
      errors.push({ code: 'MISSING_ID', message: `Element at key "${id}" has no id property` });

      return;
    }

    if (element.id !== id) {
      errors.push({
        code: 'ID_MISMATCH',
        message: `Element id "${element.id}" doesn't match flat key "${id}"`,
        elementId: id
      });
    }

    if (!(element.definition as Element['definition'] | undefined)) {
      errors.push({ code: 'MISSING_DEFINITION', message: 'Element missing definition', elementId: id });

      return;
    }

    const { definition, attributes } = element;

    if (!definition.type) {
      errors.push({ code: 'MISSING_TYPE', message: 'Element missing definition.type', elementId: id });
    }

    if ((definition.label as string | undefined) === undefined) {
      errors.push({ code: 'MISSING_LABEL', message: 'Element missing definition.label', elementId: id });
    }

    if (!definition.rootId) {
      errors.push({ code: 'MISSING_ROOT_ID', message: 'Element missing definition.rootId', elementId: id });
    }

    if (!(definition.styleSelectors as object | undefined) || typeof definition.styleSelectors !== 'object') {
      errors.push({
        code: 'MISSING_STYLE_SELECTORS',
        message: 'Element missing or invalid definition.styleSelectors',
        elementId: id
      });
    }

    if (!(attributes as object | undefined)) {
      warnings.push({ code: 'MISSING_ATTRIBUTES', message: 'Element has no attributes', elementId: id });
    }

    // Validate items array references
    if (definition.items) {
      if (!Array.isArray(definition.items)) {
        errors.push({ code: 'INVALID_ITEMS', message: 'Element.definition.items must be an array', elementId: id });
      } else {
        definition.items.forEach((childId, index) => {
          if (!elementExists(childId)) {
            errors.push({
              code: 'ORPHANED_ITEM_REFERENCE',
              message: `Element "${id}" references non-existent child "${childId}" at items[${index}]`,
              elementId: id,
              details: { childId, index }
            });
          }
        });
      }
    }

    // Validate parentId reference
    if (definition.parentId && !elementExists(definition.parentId)) {
      errors.push({
        code: 'ORPHANED_PARENT_REFERENCE',
        message: `Element "${id}" has parentId "${definition.parentId}" but parent doesn't exist in flat`,
        elementId: id,
        details: { parentId: definition.parentId }
      });
    }
  });
};

// 3. Validate parent-child consistency
export const validateParentChildConsistency = ({ errors, flat, getElement }: ValidationContext) => {
  Object.values(flat).forEach(element => {
    if (!(element as Element | undefined)?.definition) {
      return;
    }

    const { id, definition } = element;

    // Check if items match parentId
    if (definition.items) {
      definition.items.forEach(childId => {
        const child = getElement(childId);
        if (!child?.definition) {
          return;
        }

        // Child should have parentId pointing to this element
        if (child.definition.parentId !== id) {
          errors.push({
            code: 'PARENT_CHILD_MISMATCH',
            message: `Element "${childId}" is in "${id}".items but has parentId "${child.definition.parentId}"`,
            elementId: childId,
            details: { expectedParent: id, actualParent: child.definition.parentId }
          });
        }
      });
    }

    // Check if parentId matches items of parent
    if (definition.parentId) {
      const parent = getElement(definition.parentId);
      if (!parent?.definition) {
        return;
      }

      const parentItems = parent.definition.items || [];
      if (!parentItems.includes(id)) {
        errors.push({
          code: 'PARENT_CHILD_MISMATCH',
          message: `Element "${id}" has parentId "${definition.parentId}" but parent doesn't have it in items`,
          elementId: id,
          details: { parentId: definition.parentId, parentItems }
        });
      }
    }
  });
};

// 4. Detect circular references
export const validateCircularReferences = ({ errors, flat, getElement }: ValidationContext) => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const checkCircular = (elementId: string): boolean => {
    if (recursionStack.has(elementId)) {
      errors.push({
        code: 'CIRCULAR_REFERENCE',
        message: `Circular reference detected involving element "${elementId}"`,
        elementId
      });
      return true;
    }

    if (visited.has(elementId)) {
      return false;
    }

    visited.add(elementId);
    recursionStack.add(elementId);

    const element = getElement(elementId);
    if (element?.definition?.items) {
      for (const childId of element.definition.items) {
        if (checkCircular(childId)) {
          recursionStack.delete(elementId);
          return true;
        }
      }
    }

    // Also check parent chain for circularity
    const parentChain = new Set<string>();
    let current = element;
    while (current?.definition?.parentId) {
      if (parentChain.has(current.id)) {
        errors.push({
          code: 'CIRCULAR_PARENT_REFERENCE',
          message: `Circular parent reference detected involving element "${current.id}"`,
          elementId: current.id
        });
        return true;
      }
      parentChain.add(current.id);
      current = getElement(current.definition.parentId);
    }

    recursionStack.delete(elementId);
    return false;
  };

  Object.keys(flat).forEach(id => {
    if (!visited.has(id)) {
      checkCircular(id);
    }
  });
};

// 9. Validate element ids. Uniqueness needs no check — `flat` is keyed by the id, and a key that disagrees with
// the element under it is already reported as ID_MISMATCH. What is left is the charset, and it is load-bearing:
// a source name is `<type>_<id>` split on the first underscore, and `flat` is read and written through lodash
// paths, so an id carrying a '.' silently addresses something else.
export const validateElementIds = ({ errors, flat }: ValidationContext) => {
  Object.values(flat).forEach(element => {
    // A null entry is already reported by validateElements; skip it rather than report it twice.
    if (!(element as Element | undefined)) {
      return;
    }

    if (!isValidElementId(element.id)) {
      errors.push({
        code: 'INVALID_ELEMENT_ID',
        message: `Element "${element.id}" has a name that must start with a letter, then letters, numbers, hyphens and underscores (no hyphen or underscore at the start, and no hyphen at the end)`,
        elementId: element.id
      });
    }
  });
};
