import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply } from '../tools';

import type { Operation } from '../tools';
import type { AIElementDetail, AIPageSkeleton } from '../types';

describe('what an agent actually does, end to end, with one key', () => {
  it('names, reads back, binds, renames — with no id translation anywhere', async () => {
    const cap = capturing(buildSpace());

    const created = await apply(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'home',
            element: { ref: 'products-api', type: 'apiContainer', props: { query: 'https://api.example.com/p' } }
          },
          {
            type: 'upsertElement',
            pageRef: 'home',
            parentRef: 'products-api',
            element: { ref: 'row-title', type: 'text' }
          },
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref: 'row-title',
            category: 'attributes',
            binding: { to: 'content', source: 'apiContainer_products-api.records' }
          }
        ] as Operation[]
      },
      cap.saved(),
      cap.persisters
    );
    expect(created.applied).toBe(true);

    // The name the agent wrote IS the document key — nothing translated it on the way in.
    expect(Object.keys(cap.saved().schema.flat)).toContain('products-api');

    // ...and the read hands back the same string, so the next op can be written from it directly.
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(JSON.stringify(page.tree)).toContain('products-api');

    const detail = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/row-title')
      ?.data as AIElementDetail;
    expect(detail.ref).toBe('row-title');
    expect(detail.parentRef).toBe('products-api');

    // A rename moves the wiring with it: the binding follows without the agent rewriting it.
    const renamed = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'products-api', rename: 'catalog-api' }] },
      cap.saved(),
      cap.persisters
    );
    expect(renamed.applied).toBe(true);
    const bound = cap.saved().schema.flat['row-title'].definition.bindings?.attributes?.[0];
    expect(bound?.source).toBe('apiContainer_catalog-api.records');
    expect(cap.saved().schema.flat['catalog-api']).toBeDefined();
    expect(cap.saved().schema.flat['products-api']).toBeUndefined();
  });

  it('refuses a name another element already answers to, and says so', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'home', type: 'text' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('already used');
  });

  it('refuses two steps of one flow sharing a name, instead of silently dropping one', async () => {
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [
              { nodeType: 'trigger', action: 'onClick', title: 'Click', id: 'go' },
              { nodeType: 'globalCallback', action: 'login', title: 'Log in', id: 'go' }
            ]
          }
        ] as Operation[]
      },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('called "go"');
  });
});
