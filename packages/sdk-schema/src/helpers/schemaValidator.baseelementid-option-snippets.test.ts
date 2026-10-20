import { describe, it, expect } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';

import { REFERENCE_ERROR_CODES, isIntegrityError, validateSchema } from './schemaValidator';
import { createElement } from './tests/schemaValidator';

import type { Schema, Element } from '@plitzi/sdk-shared';

describe('schemaValidator', () => {
  // Tests for baseElementId (useful for snippets and AI previews)
  describe('baseElementId option (snippets and AI previews)', () => {
    it('should validate valid snippet without pages when baseElementId provided', () => {
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

    it('should validate snippet with nested children from baseElementId', () => {
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

    it('should detect circular reference within snippet when baseElementId provided', () => {
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

    it('should detect parent-child mismatch within snippet when baseElementId provided', () => {
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

    it('should validate AI preview with multiple elements', () => {
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

    it('should allow snippet without pages when baseElementId provided', () => {
      const schema: Schema = {
        ...EMPTY_SCHEMA.schema,
        flat: {
          'snippet-root': {
            id: 'snippet-root',
            attributes: {},
            definition: {
              rootId: 'snippet-root',
              label: 'Snippet Root',
              type: 'container',
              styleSelectors: { base: 'snippet-root' },
              items: ['child-1', 'child-2']
            }
          },
          'child-1': {
            id: 'child-1',
            attributes: {},
            definition: {
              rootId: 'snippet-root',
              label: 'Child 1',
              type: 'text',
              styleSelectors: { base: 'child-1' },
              parentId: 'snippet-root',
              items: []
            }
          },
          'child-2': {
            id: 'child-2',
            attributes: {},
            definition: {
              rootId: 'snippet-root',
              label: 'Child 2',
              type: 'container',
              styleSelectors: { base: 'child-2' },
              parentId: 'snippet-root',
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

      const result = validateSchema(schema, { baseElementId: 'snippet-root' });
      expect(result.valid).toBe(true);
    });
  });
});
describe('schemaValidator / nested layouts', () => {
  const shell = (id: string, attributes: Record<string, unknown> = {}, items: string[] = []): Element => ({
    ...createElement(id, 'layoutContainer', id),
    attributes,
    definition: { ...createElement(id, 'layoutContainer', id).definition, items }
  });

  const slot = (id: string, parentId: string): Element => ({
    ...createElement(id, 'container', parentId),
    definition: { ...createElement(id, 'container', parentId).definition, parentId }
  });

  const page = (layout: string, layoutContainer: string): Element => ({
    ...createElement('page-1', 'page'),
    attributes: { default: true, layout, layoutContainer }
  });

  it('accepts a shell that sits inside another shell', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        outer: shell('outer', {}, ['outer-body']),
        'outer-body': slot('outer-body', 'outer'),
        inner: shell('inner', { layout: 'outer', layoutContainer: 'outer-body' }, ['inner-body']),
        'inner-body': slot('inner-body', 'inner'),
        'page-1': page('inner', 'inner-body')
      },
      pages: ['page-1']
    };

    const result = validateSchema(schema, { baseElementId: 'page-1' });

    expect(result.errors).toEqual([]);
    // Validating one page still reaches the shell around its shell.
    expect(result.warnings.filter(warning => warning.code === 'ORPHANED_ELEMENT')).toEqual([]);
  });

  it('rejects shells that sit inside each other in a circle', () => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        a: shell('a', { layout: 'b', layoutContainer: 'b-body' }, ['a-body']),
        'a-body': slot('a-body', 'a'),
        b: shell('b', { layout: 'a', layoutContainer: 'a-body' }, ['b-body']),
        'b-body': slot('b-body', 'b'),
        'page-1': page('a', 'a-body')
      },
      pages: ['page-1']
    };

    const cycles = validateSchema(schema).errors.filter(error => error.code === 'LAYOUT_CYCLE');

    expect(cycles).toHaveLength(1);
    expect(cycles[0].details).toEqual({ cycle: ['a', 'b', 'a'] });
  });
});
describe('isIntegrityError', () => {
  const page = (): Schema => {
    const schema: Schema = {
      ...EMPTY_SCHEMA.schema,
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          attributes: { default: true },
          definition: { ...createElement('page-1', 'page').definition, items: ['provider', 'text-1'] }
        },
        provider: {
          ...createElement('provider', 'apiContainer'),
          definition: { ...createElement('provider', 'apiContainer').definition, parentId: 'page-1', items: [] }
        },
        'text-1': {
          ...createElement('text-1', 'text'),
          definition: { ...createElement('text-1', 'text').definition, parentId: 'page-1' }
        }
      },
      pages: ['page-1']
    };

    return schema;
  };

  // Each of these is what deleting the element a reference named leaves behind — an edit, not a broken document.
  it('reads every reference the validator reports as a reference, not as a broken tree', () => {
    const schema = page();
    schema.flat['text-1'].definition.bindings = {
      attributes: [
        { id: 'b1', to: 'content', source: 'apiContainer_ghost.data' },
        { id: 'b2', to: 'content', source: 'form_provider.data' }
      ]
    };
    schema.flat['text-1'].definition.interactions = {
      click: {
        id: 'click',
        title: 'Click',
        type: 'trigger',
        action: 'onClick',
        params: {},
        preview: {},
        elementId: 'text-1',
        beforeNode: '',
        afterNode: 'open',
        flowId: 'click',
        enabled: true
      },
      open: {
        id: 'open',
        title: 'Open',
        type: 'callback',
        action: 'openModal',
        params: {},
        preview: {},
        elementId: 'ghost-modal',
        beforeNode: 'click',
        afterNode: '',
        flowId: 'click',
        enabled: true
      }
    };

    // An instance of a component that was removed, and a child filling a slot its component no longer declares.
    const instance = (id: string, referenceId: string, items: string[] = []): Element => ({
      ...createElement(id, 'reference'),
      attributes: { referenceType: 'component', referenceId },
      definition: { ...createElement(id, 'reference').definition, parentId: 'page-1', items }
    });
    schema.flat['page-1'].definition.items?.push('ghost-instance', 'card-instance');
    schema.flat['ghost-instance'] = instance('ghost-instance', 'ghost');
    schema.flat['card-instance'] = instance('card-instance', 'card', ['card-filler']);
    schema.flat['card-filler'] = {
      ...createElement('card-filler', 'text'),
      attributes: { slot: 'card-gone' },
      definition: { ...createElement('card-filler', 'text').definition, parentId: 'card-instance' }
    };
    schema.components = {
      card: {
        id: 'card',
        rootId: 'card-root',
        slots: ['card-body'],
        flat: {
          'card-root': {
            ...createElement('card-root', 'container', 'card-root'),
            definition: { ...createElement('card-root', 'container', 'card-root').definition, items: ['card-body'] }
          },
          'card-body': {
            ...createElement('card-body', 'container', 'card-root'),
            definition: {
              ...createElement('card-body', 'container', 'card-root').definition,
              parentId: 'card-root',
              items: []
            }
          }
        }
      }
    };

    const { errors } = validateSchema(schema, { sourceTypes: { apiContainer: 'apiContainer', form: 'apiContainer' } });

    expect(new Set(errors.map(error => error.code))).toEqual(REFERENCE_ERROR_CODES);
    expect(errors.some(isIntegrityError)).toBe(false);
  });

  it('reads a broken tree as a broken tree', () => {
    const schema = page();
    schema.flat['text-1'].definition.parentId = 'provider';

    const { errors } = validateSchema(schema);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(isIntegrityError)).toBe(true);
  });
});
