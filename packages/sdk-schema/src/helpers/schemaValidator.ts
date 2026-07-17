/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { isValidIdRef } from './idRef';

import type { Element, Schema } from '@plitzi/sdk-shared';

export type SchemaValidationOptions = {
  baseElementId?: string;
};

export type SchemaValidationError = {
  code: string;
  message: string;
  elementId?: string;
  details?: unknown;
};

export type SchemaValidationResult = {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
};

const createValidator = (schema: Schema) => {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const { flat, pages, pageFolders, variables } = schema;

  // Helper: check if element exists in flat
  const elementExists = (id: string): boolean => !!flat[id];

  // Helper: get element safely
  const getElement = (id: string): Element | undefined => flat[id];

  // 1. Validate basic schema structure
  const validateStructure = () => {
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
    return true;
  };

  // 2. Validate each element
  const validateElements = () => {
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
  const validateParentChildConsistency = () => {
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
  const validateCircularReferences = () => {
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

  // 5. Validate pages
  const validatePages = () => {
    const pageSet = new Set<string>();
    let defaultPageCount = 0;

    pages.forEach((pageId, index) => {
      if (pageSet.has(pageId)) {
        errors.push({
          code: 'DUPLICATE_PAGE',
          message: `Duplicate page ID "${pageId}" in pages array at index ${index}`,
          elementId: pageId
        });
      }
      pageSet.add(pageId);

      const page = getElement(pageId);
      if (!page) {
        errors.push({
          code: 'INVALID_PAGE_REFERENCE',
          message: `Page ID "${pageId}" in pages array doesn't exist in flat`,
          elementId: pageId
        });
        return;
      }

      if (page.definition.type !== 'page') {
        errors.push({
          code: 'INVALID_PAGE_TYPE',
          message: `Element "${pageId}" in pages array has type "${page.definition.type}" instead of "page"`,
          elementId: pageId
        });
      }

      // Check rootId matches page's own ID
      if (page.definition.rootId !== pageId) {
        errors.push({
          code: 'PAGE_ROOT_ID_MISMATCH',
          message: `Page "${pageId}" has rootId "${page.definition.rootId}" instead of its own ID`,
          elementId: pageId
        });
      }

      // Count default page
      if (page.attributes?.default) {
        defaultPageCount++;
      }
    });

    if (defaultPageCount === 0 && pages.length > 0) {
      warnings.push({ code: 'NO_DEFAULT_PAGE', message: 'No default page found in schema' });
    } else if (defaultPageCount > 1) {
      warnings.push({ code: 'MULTIPLE_DEFAULT_PAGES', message: `Found ${defaultPageCount} default pages, expected 1` });
    }
  };

  // 6. Validate rootId consistency
  const validateRootConsistency = () => {
    pages.forEach(pageId => {
      const page = getElement(pageId);
      if (!page) {
        return;
      }

      // All descendants should have rootId = pageId
      const checkDescendants = (elementId: string) => {
        const element = getElement(elementId);
        if (!element?.definition) {
          return;
        }

        if (element.definition.rootId !== pageId) {
          errors.push({
            code: 'ROOT_ID_MISMATCH',
            message: `Element "${elementId}" has rootId "${element.definition.rootId}" but should be "${pageId}" (page's ID)`,
            elementId,
            details: { expectedRootId: pageId, actualRootId: element.definition.rootId }
          });
        }

        if (element.definition.items) {
          element.definition.items.forEach(childId => checkDescendants(childId));
        }
      };

      if (page.definition.items) {
        page.definition.items.forEach(childId => checkDescendants(childId));
      }
    });
  };

  // 7. Validate page folders
  const validatePageFolders = () => {
    const folderIds = new Set<string>();

    pageFolders.forEach((folder, index) => {
      if (!folder.id) {
        errors.push({ code: 'INVALID_FOLDER', message: `Page folder at index ${index} has no id` });
        return;
      }

      if (folderIds.has(folder.id)) {
        errors.push({ code: 'DUPLICATE_FOLDER', message: `Duplicate folder ID "${folder.id}"`, elementId: folder.id });
      }
      folderIds.add(folder.id);

      if (folder.parentId) {
        if (!folderIds.has(folder.parentId)) {
          errors.push({
            code: 'ORPHANED_FOLDER_PARENT',
            message: `Folder "${folder.id}" has non-existent parent "${folder.parentId}"`,
            elementId: folder.id,
            details: { parentId: folder.parentId }
          });
        }
      }
    });
  };

  // 8. Detect orphaned elements (elements not reachable from any page)
  const validateOrphanedElements = (baseElementId?: string) => {
    const reachable = new Set<string>();

    // Mark all elements reachable from pages
    const markReachable = (elementId: string) => {
      if (reachable.has(elementId)) {
        return;
      }

      reachable.add(elementId);
      const element = getElement(elementId);
      if (element?.definition?.items) {
        element.definition.items.forEach(childId => markReachable(childId));
      }
    };

    if (!baseElementId) {
      pages.forEach(pageId => {
        markReachable(pageId);
        const page = getElement(pageId);
        if (page?.attributes?.layoutContainer) {
          markReachable(page.attributes.layoutContainer as string);
        }
      });
    } else if (baseElementId) {
      markReachable(baseElementId);
      const element = getElement(baseElementId);
      if (element?.attributes?.layoutContainer) {
        markReachable(element.attributes.layoutContainer as string);
      }
    }

    // Check for orphans
    Object.keys(flat).forEach(elementId => {
      const element = getElement(elementId);
      if (!element) {
        return;
      }

      if (!reachable.has(elementId) && element.definition.type !== 'page') {
        warnings.push({
          code: 'ORPHANED_ELEMENT',
          message: `Element "${elementId}" is not reachable from any page`,
          elementId
        });
      }
    });
  };

  // 9. Validate variables
  const validateVariables = () => {
    const variableNames = new Set<string>();

    variables.forEach((variable, index) => {
      if (!variable.name) {
        errors.push({ code: 'INVALID_VARIABLE', message: `Variable at index ${index} has no name` });
        return;
      }

      if (variableNames.has(variable.name)) {
        errors.push({
          code: 'DUPLICATE_VARIABLE',
          message: `Duplicate variable name "${variable.name}"`,
          details: { variableName: variable.name }
        });
      }
      variableNames.add(variable.name);

      if (!(variable.type as undefined | typeof variable.type)) {
        warnings.push({
          code: 'MISSING_VARIABLE_TYPE',
          message: `Variable "${variable.name}" has no type`,
          details: { variableName: variable.name }
        });
      }
    });
  };

  // 9. Validate idRefs: the key an element publishes its data source under (`<type>_<idRef>`) and that a binding
  // targets. It is optional, but where present it must be unique across the space (two elements sharing one make a
  // binding ambiguous) and free of the separators its own grammar uses. And an element carrying interactions must
  // have one: the runtime registers an element's triggers/callbacks by idRef only, so a flow on an element without
  // one could never fire — the opaque id is deliberately not a fallback.
  const validateIdRefs = () => {
    const seen = new Map<string, string>();
    Object.values(flat).forEach(element => {
      // A null entry is already reported by validateElements; skip it rather than report it twice.
      if (!(element as Element | undefined)) {
        return;
      }

      const { idRef } = element;
      if (!idRef) {
        if (element.definition.interactions && Object.keys(element.definition.interactions).length > 0) {
          errors.push({
            code: 'INTERACTIONS_WITHOUT_ID_REF',
            message: `Element "${element.id}" has interactions but no idRef, so none of them can fire`,
            elementId: element.id
          });
        }

        return;
      }

      if (!isValidIdRef(idRef)) {
        errors.push({
          code: 'INVALID_ID_REF',
          message: `Element "${element.id}" has idRef "${idRef}", which must start with a letter, then letters, numbers and hyphens (no hyphen at the start or end)`,
          elementId: element.id
        });
      }

      const owner = seen.get(idRef);
      if (owner) {
        errors.push({
          code: 'DUPLICATE_ID_REF',
          message: `Elements "${owner}" and "${element.id}" share the idRef "${idRef}"`,
          elementId: element.id,
          details: { idRef, otherElementId: owner }
        });

        return;
      }

      seen.set(idRef, element.id);
    });
  };

  // Run all validations
  const validate = (options?: SchemaValidationOptions): SchemaValidationResult => {
    const { baseElementId } = options ?? {};
    if (!validateStructure()) {
      return { valid: false, errors, warnings };
    }

    validateElements();
    validateParentChildConsistency();
    validateCircularReferences();
    validatePages();
    validateRootConsistency();
    validatePageFolders();
    validateOrphanedElements(baseElementId);
    validateVariables();
    validateIdRefs();

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  };

  return { validate };
};

// Export the validator function
export const validateSchema = (schema: Schema, options?: SchemaValidationOptions): SchemaValidationResult => {
  return createValidator(schema).validate(options);
};

// Convenience function: throws if schema is invalid
export const assertSchemaValid = (schema: Schema, options?: SchemaValidationOptions, context?: string): void => {
  const result = validateSchema(schema, options);
  if (!result.valid) {
    const message = `Invalid schema${context ? ` (${context})` : ''}: ${result.errors.map(e => e.message).join('; ')}`;
    throw new Error(message);
  }
};

// Convenience function: returns true if schema is valid
export const isSchemaValid = (schema: Schema, options?: SchemaValidationOptions): boolean => {
  return validateSchema(schema, options).valid;
};
