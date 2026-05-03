import { describe, it, expect } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';

import { validateSchema } from './schemaValidator';

import type { Schema, Element } from '@plitzi/sdk-shared';

// Helper to create element
const createElement = (id: string, type: string, rootId?: string): Element => ({
  id,
  attributes: {},
  definition: {
    rootId: rootId || (type === 'page' ? id : 'page-1'),
    label: id,
    type,
    styleSelectors: { base: id }
  }
});

describe('schemaValidator', () => {
  it('should validate a valid schema with multiple pages', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: {
            ...createElement('page-1', 'page').definition,
            items: ['container-1']
          }
        },
        'page-2': createElement('page-2', 'page'),
        'container-1': {
          ...createElement('container-1', 'container'),
          definition: {
            ...createElement('container-1', 'container').definition,
            parentId: 'page-1',
            items: ['text-1']
          }
        },
        'text-1': {
          ...createElement('text-1', 'text'),
          definition: {
            ...createElement('text-1', 'text').definition,
            parentId: 'container-1'
          }
        }
      },
      pages: ['page-1', 'page-2']
    };
    (schema.flat['page-1'] as Element).attributes = { default: true };

    const result = validateSchema(schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing element id', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'element-1': {
          id: '',
          attributes: {},
          definition: {
            rootId: 'page-1',
            label: 'Test',
            type: 'container',
            styleSelectors: { base: 'test' }
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_ID')).toBe(true);
  });

  it('should detect id mismatch between key and element.id', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'element-1': createElement('different-id', 'container')
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ID_MISMATCH')).toBe(true);
  });

  it('should detect orphaned item references', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'parent-1': {
          ...createElement('parent-1', 'container'),
          definition: {
            ...createElement('parent-1', 'container').definition,
            items: ['non-existent-child']
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ORPHANED_ITEM_REFERENCE')).toBe(true);
  });

  it('should detect orphaned parent references', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'child-1': {
          ...createElement('child-1', 'text'),
          definition: {
            ...createElement('child-1', 'text').definition,
            parentId: 'non-existent-parent'
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ORPHANED_PARENT_REFERENCE')).toBe(true);
  });

  it('should detect parent-child mismatch (child in items but wrong parentId)', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'parent-1': {
          ...createElement('parent-1', 'container'),
          definition: {
            ...createElement('parent-1', 'container').definition,
            items: ['child-1']
          }
        },
        'child-1': {
          ...createElement('child-1', 'text'),
          definition: {
            ...createElement('child-1', 'text').definition,
            parentId: 'different-parent'
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PARENT_CHILD_MISMATCH')).toBe(true);
  });

  it('should detect parent-child mismatch (parentId set but not in parent items)', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'parent-1': createElement('parent-1', 'container'),
        'child-1': {
          ...createElement('child-1', 'text'),
          definition: {
            ...createElement('child-1', 'text').definition,
            parentId: 'parent-1'
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PARENT_CHILD_MISMATCH')).toBe(true);
  });

  it('should detect circular references in items', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'element-1': {
          ...createElement('element-1', 'container'),
          definition: {
            ...createElement('element-1', 'container').definition,
            items: ['element-2']
          }
        },
        'element-2': {
          ...createElement('element-2', 'container'),
          definition: {
            ...createElement('element-2', 'container').definition,
            parentId: 'element-1',
            items: ['element-1']
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CIRCULAR_REFERENCE')).toBe(true);
  });

  it('should detect circular references in parentId chain', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'element-1': {
          ...createElement('element-1', 'container'),
          definition: {
            ...createElement('element-1', 'container').definition,
            parentId: 'element-2'
          }
        },
        'element-2': {
          ...createElement('element-2', 'container'),
          definition: {
            ...createElement('element-2', 'container').definition,
            parentId: 'element-1'
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CIRCULAR_PARENT_REFERENCE')).toBe(true);
  });

  it('should detect deep circular references (3+ levels)', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'element-1': {
          ...createElement('element-1', 'container'),
          definition: {
            ...createElement('element-1', 'container').definition,
            parentId: 'element-3'
          }
        },
        'element-2': {
          ...createElement('element-2', 'container'),
          definition: {
            ...createElement('element-2', 'container').definition,
            parentId: 'element-1'
          }
        },
        'element-3': {
          ...createElement('element-3', 'container'),
          definition: {
            ...createElement('element-3', 'container').definition,
            parentId: 'element-2'
          }
        }
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CIRCULAR_PARENT_REFERENCE')).toBe(true);
  });

  it('should detect orphaned elements (not reachable from any page)', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'page'),
        'orphan-1': createElement('orphan-1', 'container')
      },
      pages: ['page-1']
    };
    (schema.flat['page-1'] as Element).attributes = { default: true };

    const result = validateSchema(schema);
    expect(result.valid).toBe(true); // Schema can be valid but with warnings
    expect(result.warnings.some(e => e.code === 'ORPHANED_ELEMENT')).toBe(true);
  });

  it('should detect invalid page references in pages array', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {},
      pages: ['non-existent-page']
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_PAGE_REFERENCE')).toBe(true);
  });

  it('should detect page with wrong type', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'container') // Wrong type
      },
      pages: ['page-1']
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_PAGE_TYPE')).toBe(true);
  });

  it('should detect page with wrong rootId (not self)', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: {
            ...createElement('page-1', 'page').definition,
            rootId: 'different-id'
          }
        }
      },
      pages: ['page-1']
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PAGE_ROOT_ID_MISMATCH')).toBe(true);
  });

  it('should detect rootId mismatch for descendants', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: {
            ...createElement('page-1', 'page').definition,
            items: ['child-1']
          }
        },
        'child-1': {
          ...createElement('child-1', 'container'),
          definition: {
            ...createElement('child-1', 'container').definition,
            parentId: 'page-1',
            rootId: 'different-page'
          }
        }
      },
      pages: ['page-1']
    };
    (schema.flat['page-1'] as Element).attributes = { default: true };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ROOT_ID_MISMATCH')).toBe(true);
  });

  it('should detect invalid page folders (non-existent parent)', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {},
      pages: [],
      pageFolders: [{ id: 'folder-1', name: 'Folder 1', slug: 'folder-1', parentId: 'non-existent' }]
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ORPHANED_FOLDER_PARENT')).toBe(true);
  });

  it('should detect duplicate page ids in pages array', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'page')
      },
      pages: ['page-1', 'page-1']
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE_PAGE')).toBe(true);
  });

  it('should detect duplicate variable names', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {},
      pages: [],
      variables: [
        { name: 'var1', category: 'test', type: 'text', value: 'a', subValues: [] },
        { name: 'var1', category: 'test', type: 'text', value: 'b', subValues: [] }
      ]
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE_VARIABLE')).toBe(true);
  });

  it('should warn when no default page exists', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'page')
      },
      pages: ['page-1']
    };

    const result = validateSchema(schema);
    expect(result.warnings.some(e => e.code === 'NO_DEFAULT_PAGE')).toBe(true);
  });

  it('should warn when multiple default pages exist', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'page'),
        'page-2': createElement('page-2', 'page')
      },
      pages: ['page-1', 'page-2']
    };
    (schema.flat['page-1'] as Element).attributes = { default: true };
    (schema.flat['page-2'] as Element).attributes = { default: true };

    const result = validateSchema(schema);
    expect(result.warnings.some(e => e.code === 'MULTIPLE_DEFAULT_PAGES')).toBe(true);
  });

  it('should handle null/undefined elements in flat', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'element-1': null as unknown as Element,
        'element-2': undefined as unknown as Element
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'NULL_ELEMENT')).toBe(true);
  });

  it('should validate nested children with correct relationships', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: {
            ...createElement('page-1', 'page').definition,
            items: ['c1']
          }
        },
        c1: {
          ...createElement('c1', 'container'),
          definition: {
            ...createElement('c1', 'container').definition,
            parentId: 'page-1',
            items: ['c2']
          }
        },
        c2: {
          ...createElement('c2', 'container'),
          definition: {
            ...createElement('c2', 'container').definition,
            parentId: 'c1',
            items: ['c3']
          }
        },
        c3: {
          ...createElement('c3', 'container'),
          definition: {
            ...createElement('c3', 'container').definition,
            parentId: 'c2',
            items: []
          }
        }
      },
      pages: ['page-1']
    };
    (schema.flat['page-1'] as Element).attributes = { default: true };

    const result = validateSchema(schema);
    expect(result.valid).toBe(true);
  });

  it('should detect missing required definition fields', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'element-1': {
          id: 'element-1',
          attributes: {},
          definition: {
            // Missing type, label, styleSelectors
            rootId: 'page-1'
          }
        } as unknown as Element
      },
      pages: []
    };

    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_TYPE')).toBe(true);
    expect(result.errors.some(e => e.code === 'MISSING_LABEL')).toBe(true);
    expect(result.errors.some(e => e.code === 'MISSING_STYLE_SELECTORS')).toBe(true);
  });

  it('should handle empty schema (only EMPTY_SCHEMA)', () => {
    const result = validateSchema(EMPTY_SCHEMA.schema);
    expect(result.valid).toBe(true);
  });
});
