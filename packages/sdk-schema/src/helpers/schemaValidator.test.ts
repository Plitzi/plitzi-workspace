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

  // An idRef is the key an element publishes its data source under, so the space must agree on who owns one.
  describe('idRef', () => {
    const withIdRefs = (...idRefs: (string | undefined)[]): Schema => ({
      ...EMPTY_SCHEMA.schema,
      pages: ['page-1'],
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: { ...createElement('page-1', 'page').definition, items: idRefs.map((_, i) => `el-${i}`) }
        },
        ...Object.fromEntries(
          idRefs.map((idRef, i) => [
            `el-${i}`,
            {
              ...createElement(`el-${i}`, 'apiContainer'),
              idRef,
              definition: { ...createElement(`el-${i}`, 'apiContainer').definition, parentId: 'page-1' }
            }
          ])
        )
      }
    });

    it('accepts elements with no idRef at all (it is optional)', () => {
      expect(validateSchema(withIdRefs(undefined, undefined)).valid).toBe(true);
    });

    it('accepts distinct, well-formed idRefs', () => {
      expect(validateSchema(withIdRefs('products-api', 'orders-api')).valid).toBe(true);
    });

    it('rejects two elements sharing one idRef, naming both owners', () => {
      const result = validateSchema(withIdRefs('products-api', 'products-api'));
      expect(result.valid).toBe(false);
      const error = result.errors.find(e => e.code === 'DUPLICATE_ID_REF');
      expect(error?.message).toContain('products-api');
      expect(error?.details).toEqual({ idRef: 'products-api', otherElementId: 'el-0' });
    });

    it('rejects an idRef carrying a dot separator the source grammar uses', () => {
      const result = validateSchema(withIdRefs('products.api'));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ID_REF')).toBe(true);
    });
  });

  // Tests for baseElementId (useful for AI templates/previews)
  describe('baseElementId option (AI templates/previews)', () => {
    it('should validate valid template without pages when baseElementId provided', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          footer: {
            id: 'footer',
            attributes: {},
            definition: {
              rootId: 'footer',
              label: 'footer',
              type: 'container',
              styleSelectors: { base: 'footer' },
              items: ['footer-text']
            }
          },
          'footer-text': {
            id: 'footer-text',
            attributes: {},
            definition: {
              rootId: 'footer',
              label: 'footer-text',
              type: 'text',
              styleSelectors: { base: 'footer-text' },
              parentId: 'footer',
              items: []
            }
          }
        },
        pages: [] // No pages needed when using baseElementId
      };

      const result = validateSchema(schema, { baseElementId: 'footer' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect orphan elements when baseElementId provided but some elements not reachable', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          footer: createElement('footer', 'container', 'footer'),
          header: createElement('header', 'container', 'header'),
          unrelated: createElement('unrelated', 'container', 'unrelated')
        },
        pages: []
      };

      const result = validateSchema(schema, { baseElementId: 'footer' });
      expect(result.valid).toBe(true); // Valid, but with warning about orphan
      expect(result.warnings.some(w => w.code === 'ORPHANED_ELEMENT')).toBe(true);
      expect(result.warnings.find(w => w.elementId === 'header')).toBeDefined();
      expect(result.warnings.find(w => w.elementId === 'unrelated')).toBeDefined();
    });

    it('should validate template with nested children from baseElementId', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          card: {
            id: 'card',
            attributes: {},
            definition: {
              rootId: 'card',
              label: 'card',
              type: 'container',
              styleSelectors: { base: 'card' },
              items: ['card-header', 'card-body']
            }
          },
          'card-header': {
            id: 'card-header',
            attributes: {},
            definition: {
              rootId: 'card',
              label: 'card-header',
              type: 'container',
              styleSelectors: { base: 'card-header' },
              parentId: 'card',
              items: ['card-title']
            }
          },
          'card-title': {
            id: 'card-title',
            attributes: {},
            definition: {
              rootId: 'card',
              label: 'card-title',
              type: 'heading',
              styleSelectors: { base: 'card-title' },
              parentId: 'card-header'
            }
          },
          'card-body': {
            id: 'card-body',
            attributes: {},
            definition: {
              rootId: 'card',
              label: 'card-body',
              type: 'container',
              styleSelectors: { base: 'card-body' },
              parentId: 'card',
              items: ['card-text']
            }
          },
          'card-text': {
            id: 'card-text',
            attributes: {},
            definition: {
              rootId: 'card',
              label: 'card-text',
              type: 'text',
              styleSelectors: { base: 'card-text' },
              parentId: 'card-body'
            }
          }
        },
        pages: []
      };

      const result = validateSchema(schema, { baseElementId: 'card' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular reference within template when baseElementId provided', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          'element-1': {
            ...createElement('element-1', 'container', 'element-1'),
            definition: {
              ...createElement('element-1', 'container', 'element-1').definition,
              items: ['element-2']
            }
          },
          'element-2': {
            ...createElement('element-2', 'container', 'element-1'),
            definition: {
              ...createElement('element-2', 'container', 'element-1').definition,
              parentId: 'element-1',
              items: ['element-1'] // Circular!
            }
          }
        },
        pages: []
      };

      const result = validateSchema(schema, { baseElementId: 'element-1' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CIRCULAR_REFERENCE')).toBe(true);
    });

    it('should detect parent-child mismatch within template when baseElementId provided', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          parent: {
            ...createElement('parent', 'container', 'parent'),
            definition: {
              ...createElement('parent', 'container', 'parent').definition,
              items: ['child']
            }
          },
          child: {
            ...createElement('child', 'text', 'parent'),
            definition: {
              ...createElement('child', 'text', 'parent').definition,
              parentId: 'different-parent' // Mismatch!
            }
          }
        },
        pages: []
      };

      const result = validateSchema(schema, { baseElementId: 'parent' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PARENT_CHILD_MISMATCH')).toBe(true);
    });

    it('should detect non-existent baseElementId', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          footer: createElement('footer', 'container', 'footer')
        },
        pages: []
      };

      const result = validateSchema(schema, { baseElementId: 'non-existent' });
      expect(result.warnings.some(w => w.code === 'ORPHANED_ELEMENT')).toBe(true);
      // The baseElementId doesn't exist, so footer becomes orphan
      expect(result.warnings.find(w => w.elementId === 'footer')).toBeDefined();
    });

    it('should validate AI template preview with multiple elements', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          hero: {
            id: 'hero',
            attributes: {},
            definition: {
              rootId: 'hero',
              label: 'hero',
              type: 'container',
              styleSelectors: { base: 'hero' },
              items: ['hero-title', 'hero-subtitle', 'hero-cta']
            }
          },
          'hero-title': {
            id: 'hero-title',
            attributes: {},
            definition: {
              rootId: 'hero',
              label: 'hero-title',
              type: 'heading',
              styleSelectors: { base: 'hero-title' },
              parentId: 'hero'
            }
          },
          'hero-subtitle': {
            id: 'hero-subtitle',
            attributes: {},
            definition: {
              rootId: 'hero',
              label: 'hero-subtitle',
              type: 'text',
              styleSelectors: { base: 'hero-subtitle' },
              parentId: 'hero'
            }
          },
          'hero-cta': {
            id: 'hero-cta',
            attributes: {},
            definition: {
              rootId: 'hero',
              label: 'hero-cta',
              type: 'button',
              styleSelectors: { base: 'hero-cta' },
              parentId: 'hero'
            }
          }
        },
        pages: []
      };

      const result = validateSchema(schema, { baseElementId: 'hero' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should allow template without pages when baseElementId provided', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          'template-root': {
            id: 'template-root',
            attributes: {},
            definition: {
              rootId: 'template-root',
              label: 'Template Root',
              type: 'container',
              styleSelectors: { base: 'template-root' },
              items: ['child-1', 'child-2']
            }
          },
          'child-1': {
            id: 'child-1',
            attributes: {},
            definition: {
              rootId: 'template-root',
              label: 'Child 1',
              type: 'text',
              styleSelectors: { base: 'child-1' },
              parentId: 'template-root',
              items: []
            }
          },
          'child-2': {
            id: 'child-2',
            attributes: {},
            definition: {
              rootId: 'template-root',
              label: 'Child 2',
              type: 'container',
              styleSelectors: { base: 'child-2' },
              parentId: 'template-root',
              items: []
            }
          }
        },
        pages: [], // Empty pages OK when baseElementId provided
        variables: [],
        settings: { customCss: '' },
        pageFolders: [],
        definition: { name: '', permanentUrl: '' }
      };

      const result = validateSchema(schema, { baseElementId: 'template-root' });
      expect(result.valid).toBe(true);
    });
  });
});
