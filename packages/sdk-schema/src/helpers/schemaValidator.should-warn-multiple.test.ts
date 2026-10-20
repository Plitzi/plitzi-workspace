import { describe, it, expect } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';

import { validateSchema } from './schemaValidator';
import { createElement } from './tests/schemaValidator';

import type { Schema, Element } from '@plitzi/sdk-shared';

describe('schemaValidator', () => {
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
  // An element's id is the key it publishes its data source under and the name every binding and interaction
  // wires by, so the charset it is held to is load-bearing rather than cosmetic.
  describe('element id', () => {
    const withIds = (...ids: string[]): Schema => ({
      ...EMPTY_SCHEMA.schema,
      pages: ['page-1'],
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: { ...createElement('page-1', 'page').definition, items: ids }
        },
        ...Object.fromEntries(
          ids.map(id => [
            id,
            {
              ...createElement(id, 'apiContainer'),
              definition: { ...createElement(id, 'apiContainer').definition, parentId: 'page-1' }
            }
          ])
        )
      }
    });

    it('accepts distinct, well-formed names', () => {
      expect(validateSchema(withIds('products-api', 'orders-api')).valid).toBe(true);
    });

    it('rejects a name carrying the dot the source grammar and the flat paths both split on', () => {
      const result = validateSchema(withIds('products.api'));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ELEMENT_ID')).toBe(true);
    });

    it('rejects a name that does not start with a letter', () => {
      expect(validateSchema(withIds('2products')).errors.some(e => e.code === 'INVALID_ELEMENT_ID')).toBe(true);
    });
  });
  // A step id and a binding id are names too — read by a later step as `{{ <id>.field }}`, and used to address one
  // rule of one element — so both are held to the same rules the element ids are.
  describe('interaction and binding ids', () => {
    const step = (overrides: Record<string, unknown>) =>
      ({
        id: 'onClick-1',
        title: 'Click',
        type: 'trigger',
        action: 'onClick',
        params: {},
        preview: {},
        elementId: null,
        beforeNode: '',
        afterNode: '',
        flowId: 'onClick-1',
        enabled: true,
        ...overrides
      }) as never;

    const withElement = (definition: Partial<Element['definition']>): Schema => ({
      ...EMPTY_SCHEMA.schema,
      pages: ['page-1'],
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: { ...createElement('page-1', 'page').definition, items: ['btn'] }
        },
        btn: {
          ...createElement('btn', 'button'),
          definition: { ...createElement('btn', 'button').definition, parentId: 'page-1', ...definition }
        }
      }
    });

    it('rejects a step name carrying the dot a later step would read as a path separator', () => {
      const result = validateSchema(
        withElement({ interactions: { 'on.click': step({ id: 'on.click', flowId: 'on.click' }) } })
      );
      expect(result.errors.some(e => e.code === 'INVALID_INTERACTION_ID')).toBe(true);
    });

    it('rejects a step whose stored id disagrees with the key the flow holds it under', () => {
      const result = validateSchema(
        withElement({ interactions: { 'onClick-1': step({ id: 'somewhere-else', flowId: 'onClick-1' }) } })
      );
      expect(result.errors.some(e => e.code === 'INTERACTION_ID_MISMATCH')).toBe(true);
    });

    it('rejects two bindings of one element sharing a name', () => {
      const result = validateSchema(
        withElement({
          bindings: {
            attributes: [
              { id: 'attributes-1', to: 'content', source: 'variables.a' },
              { id: 'attributes-1', to: 'title', source: 'variables.b' }
            ]
          }
        })
      );
      expect(result.errors.some(e => e.code === 'DUPLICATE_BINDING_ID')).toBe(true);
    });

    it('accepts distinct, well-formed step and binding names', () => {
      const result = validateSchema(
        withElement({
          interactions: { 'onClick-1': step({}) },
          bindings: { attributes: [{ id: 'attributes-1', to: 'content', source: 'variables.a' }] }
        })
      );
      expect(result.valid).toBe(true);
    });
  });
  describe('form submit', () => {
    const submit = (enabled = true) =>
      ({
        id: 'submitted',
        title: 'On Form Submit',
        type: 'trigger',
        action: 'onSubmit',
        params: {},
        preview: {},
        elementId: null,
        beforeNode: '',
        afterNode: '',
        flowId: 'submitted',
        enabled
      }) as never;

    const withForm = (managedByInteractions: boolean, enabled = true): Schema => ({
      ...EMPTY_SCHEMA.schema,
      pages: ['page-1'],
      flat: {
        'page-1': {
          ...createElement('page-1', 'page'),
          definition: { ...createElement('page-1', 'page').definition, items: ['signup'] }
        },
        signup: {
          ...createElement('signup', 'form'),
          attributes: { managedByInteractions },
          definition: {
            ...createElement('signup', 'form').definition,
            parentId: 'page-1',
            interactions: { submitted: submit(enabled) }
          }
        }
      }
    });

    // Left unmanaged, the browser submits the form itself and the flow is saved, correct, and never runs.
    it('warns about an onSubmit flow on a form the browser submits natively', () => {
      const result = validateSchema(withForm(false));

      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'FORM_SUBMIT_UNMANAGED', elementId: 'signup' })
      );
    });

    it('says nothing once the form hands its submit to the flow, or when the flow is switched off', () => {
      expect(validateSchema(withForm(true)).warnings.map(w => w.code)).not.toContain('FORM_SUBMIT_UNMANAGED');
      expect(validateSchema(withForm(false, false)).warnings.map(w => w.code)).not.toContain('FORM_SUBMIT_UNMANAGED');
    });
  });
});
