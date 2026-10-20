import { describe, it, expect } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';

import { validateSchema } from './schemaValidator';
import { createElement } from './tests/schemaValidator';

import type { Schema, Element } from '@plitzi/sdk-shared';

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
  /**
   * The shared-layout arrangement, which is where "reachable" stops meaning "somewhere under a page".
   *
   * `layout` names the shell — its own root, holding the header/sidebar/footer every page shows — and
   * `layoutContainer` names the slot INSIDE that shell where the page's body is rendered. Walking only from the
   * slot reaches the page's own subtree and nothing else, so a space's whole chrome read as orphaned.
   */
  it('reaches the layout shell a page is rendered inside, not just the slot it is rendered into', () => {
    // The shell is a root of its own: nothing owns it, and its subtree is rooted on it rather than on a page.
    const inLayout = (id: string, type: string, parentId?: string, items?: string[]): Element => {
      const element = createElement(id, type, 'layout-main');

      return { ...element, definition: { ...element.definition, ...(parentId ? { parentId } : {}), items } };
    };

    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'page'),
        'layout-main': inLayout('layout-main', 'layoutContainer', undefined, ['sidebar', 'body-slot']),
        sidebar: inLayout('sidebar', 'container', 'layout-main', ['nav-link']),
        'nav-link': inLayout('nav-link', 'link', 'sidebar', []),
        'body-slot': inLayout('body-slot', 'container', 'layout-main', [])
      },
      pages: ['page-1']
    };
    (schema.flat['page-1'] as Element).attributes = {
      default: true,
      layout: 'layout-main',
      layoutContainer: 'body-slot'
    };

    const result = validateSchema(schema);

    expect(result.errors).toEqual([]);
    expect(result.warnings.filter(warning => warning.code === 'ORPHANED_ELEMENT')).toEqual([]);
  });
  it('roots a layout shell on itself, and never calls it or its contents orphaned', () => {
    const inLayout = (id: string, type: string, parentId?: string, items?: string[]): Element => {
      const element = createElement(id, type, 'lonely-layout');

      return { ...element, definition: { ...element.definition, ...(parentId ? { parentId } : {}), items } };
    };

    // A shell no page uses YET — authored, not yet attached. It is still a root: nothing is meant to reach it.
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'page'),
        'lonely-layout': inLayout('lonely-layout', 'layoutContainer', undefined, ['footer']),
        footer: inLayout('footer', 'container', 'lonely-layout', [])
      },
      pages: ['page-1']
    };
    (schema.flat['page-1'] as Element).attributes = { default: true };

    const result = validateSchema(schema);

    expect(result.errors).toEqual([]);
    expect(result.warnings.filter(warning => warning.code === 'ORPHANED_ELEMENT')).toEqual([]);
  });
  it('holds a layout\u2019s descendants to the layout\u2019s own rootId', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': createElement('page-1', 'page'),
        'main-layout': {
          ...createElement('main-layout', 'layoutContainer', 'main-layout'),
          definition: {
            ...createElement('main-layout', 'layoutContainer', 'main-layout').definition,
            items: ['stray']
          }
        },
        // Rooted on the page it is not in — the mismatch that used to go unreported, because nothing walked here.
        stray: {
          ...createElement('stray', 'container', 'page-1'),
          definition: { ...createElement('stray', 'container', 'page-1').definition, parentId: 'main-layout' }
        }
      },
      pages: ['page-1']
    };
    (schema.flat['page-1'] as Element).attributes = { default: true, layout: 'main-layout' };

    const result = validateSchema(schema);

    expect(result.errors.some(error => error.code === 'ROOT_ID_MISMATCH' && error.elementId === 'stray')).toBe(true);
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
});
