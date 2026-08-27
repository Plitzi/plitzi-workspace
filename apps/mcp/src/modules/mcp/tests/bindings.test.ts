import { describe, it, expect } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply, validate } from '../tools';

import type { Space } from '../helpers';
import type { AIElementDetail } from '../types';
import type { Style } from '@plitzi/sdk-shared';

const scopeSpace = (): Space => ({
  schema: {
    flat: {
      home: {
        id: 'home',
        attributes: { slug: '', name: 'Home', default: true },
        definition: {
          rootId: 'home',
          label: 'Page',
          type: 'page',
          items: ['products', 'out-text'],
          styleSelectors: { base: 'p' }
        }
      },
      products: {
        id: 'products',
        attributes: {},
        definition: {
          rootId: 'home',
          parentId: 'home',
          label: 'Api',
          type: 'apiContainer',
          items: ['inner-text'],
          styleSelectors: { base: 'a' }
        }
      },
      'inner-text': {
        id: 'inner-text',
        attributes: { content: '' },
        definition: {
          rootId: 'home',
          parentId: 'products',
          label: 'Inner',
          type: 'text',
          items: [],
          styleSelectors: { base: 't' }
        }
      },
      'out-text': {
        id: 'out-text',
        attributes: { content: '' },
        definition: {
          rootId: 'home',
          parentId: 'home',
          label: 'Out',
          type: 'text',
          items: [],
          styleSelectors: { base: 't' }
        }
      }
    },
    definition: { name: 'T', permanentUrl: '' },
    variables: [],
    settings: { customCss: '' },
    pages: ['home'],
    pageFolders: []
  },
  style: {
    platform: { desktop: {}, tablet: {}, mobile: {} },
    theme: { default: 'system', schemes: ['light'] },
    variables: {},
    cache: ''
  } as unknown as Style,
  connectors: [],
  actions: []
});

describe('mcp-ai binding source scope (descendants only)', () => {
  const bind = (ref: string) =>
    validate(
      {
        operations: [
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref,
            category: 'attributes',
            binding: { to: 'content', source: 'apiContainer_products.data' }
          }
        ]
      },
      scopeSpace()
    );

  it('accepts a binding from an element inside the provider subtree', () => {
    const r = bind('inner-text');
    expect(r.valid).toBe(true);
    expect(r.errors.some(e => e.message.includes('subtree'))).toBe(false);
  });

  it('errors (blocks) when the bound element is outside the provider subtree', () => {
    const r = bind('out-text');
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(e => e.message.includes('provided by element "products"') && e.message.includes('subtree'))
    ).toBe(true);
  });
});

describe('mcp-ai binding transformers', () => {
  const withTransformer = (action: string, params: Record<string, string>) =>
    validate(
      {
        operations: [
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref: 'c1',
            category: 'attributes',
            binding: { to: 'title', source: 'apiContainer_x.data', transformers: [{ action, params }] }
          }
        ]
      },
      buildSpace()
    );

  it('errors on an unknown transformer action and suggests the real one', () => {
    const r = withTransformer('template', { template: '{{value}} min' });
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(e => e.message.includes('Unknown transformer action "template"') && e.hint.includes('twigTemplate'))
    ).toBe(true);
  });

  it('accepts a valid transformer', () => {
    const r = withTransformer('twigTemplate', { template: '{{source}} min' });
    expect(r.errors.some(e => e.message.includes('transformer'))).toBe(false);
  });

  it('errors on a missing required param', () => {
    const r = withTransformer('twigTemplate', {});
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('missing required param "template"'))).toBe(true);
  });

  it('errors on a select value outside its options', () => {
    const r = withTransformer('dateConverter', { locale: 'fr' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('param "locale" is "fr"'))).toBe(true);
  });
});

describe('mcp-ai data bindings', () => {
  it('upserts, patches and deletes a binding; reads reflect each step', async () => {
    const cap = capturing(buildSpace());
    let res = await apply(
      {
        operations: [
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref: 'c1',
            category: 'attributes',
            binding: { to: 'items', source: 'apiContainer_x.data' }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    expect(res.summary.created).toBe(1);
    let el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.bindings?.attributes?.[0]).toMatchObject({ to: 'items', source: 'apiContainer_x.data' });

    res = await apply(
      {
        operations: [
          {
            type: 'patchBinding',
            pageRef: 'home',
            ref: 'c1',
            category: 'attributes',
            to: 'items',
            source: 'other.data'
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    expect(res.summary.updated).toBe(1);
    el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.bindings?.attributes?.[0].source).toBe('other.data');

    await apply(
      { operations: [{ type: 'deleteBinding', pageRef: 'home', ref: 'c1', category: 'attributes', to: 'items' }] },
      cap.saved(),
      cap.persisters
    );
    el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.bindings).toBeUndefined();
  });

  it('exposes an observed data-sources catalog', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref: 'c1',
            category: 'attributes',
            binding: { to: 'items', source: 'apiContainer_x.data' }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    const catalog = readResource(cap.saved(), 'main', 'plitzi://data-sources/main')?.data as {
      sources: string[];
      targets: Record<string, string[]>;
    };
    expect(catalog.sources).toContain('apiContainer_x.data');
    expect(catalog.targets.attributes).toContain('items');
  });
});
