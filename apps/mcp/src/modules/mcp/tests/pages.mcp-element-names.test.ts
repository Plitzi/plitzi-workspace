import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { apply } from '../tools';

describe('MCP element names (the name IS the id, and the runtime wiring key)', () => {
  it('stores the chosen name as the element id, which is also its key in the document', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'products-api', type: 'apiContainer' } }]
      },
      buildSpace(),
      cap.persisters
    );
    const el = Object.values(cap.saved().schema.flat).find(e => e.definition.type === 'apiContainer');
    expect(el?.id).toBe('products-api');
    // No translation anywhere: the name the agent wrote is the flat key.
    expect(cap.saved().schema.flat['products-api']).toBeDefined();
  });

  it('a binding source written against the ref matches the key the runtime registers', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'products-api', type: 'apiContainer' } },
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
            binding: { to: 'content', source: 'apiContainer_products-api.data.name' }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);

    const saved = cap.saved();
    const api = Object.values(saved.schema.flat).find(e => e.definition.type === 'apiContainer');
    const child = Object.values(saved.schema.flat).find(e => e.id === 'row-title');
    const storedSource = child?.definition.bindings?.attributes?.[0].source;
    // What ApiContainer registers at runtime is `apiContainer_${id}` — the binding must target exactly that.
    const runtimeSourceName = api ? `apiContainer_${api.id}` : '';
    expect(storedSource?.startsWith(`${runtimeSourceName}.`)).toBe(true);
    expect(child?.definition.parentId).toBe(api?.id);
  });

  it('rejects a new ref whose charset would break the source/interaction path grammar', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'hero.cta', type: 'text' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('not a valid element name');
  });

  it('rejects a new name already used elsewhere in the space (a name is a global wiring key)', async () => {
    // "home" is the existing page's name: reusing it for a new element would make the wiring key ambiguous.
    const res = await apply(
      { operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'home', type: 'text' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('already used');
  });

  it('rejects duplicate refs within one element tree (validator)', async () => {
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'home',
            element: { ref: 'dup', type: 'container', children: [{ ref: 'dup', type: 'text' }] }
          }
        ]
      },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('Duplicate ref');
  });

  it('upserting an existing ref on its own page still updates it (not a uniqueness collision)', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'c1', type: 'container', label: 'Renamed' } }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    expect(cap.saved().schema.flat.c1.definition.label).toBe('Renamed');
  });

  it('patchElement renames an element, re-keying the document under the new name', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename: 'hero-box' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    expect(cap.saved().schema.flat.c1).toBeUndefined();
    expect(cap.saved().schema.flat['hero-box'].id).toBe('hero-box');
    // The parent's items moved with it — a rename that left the tree behind would orphan the element.
    expect(cap.saved().schema.flat.home.definition.items).toContain('hero-box');
  });

  it('patchElement rejects a new name that is taken or malformed, leaving the element untouched', async () => {
    for (const [rename, message] of [
      ['home', 'already used'],
      ['hero.box', 'not a valid name']
    ]) {
      const res = await apply(
        { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename }] },
        buildSpace()
      );
      expect(res.applied).toBe(false);
      expect(res.errors?.[0].message).toContain(message);
    }
  });

  it('patchElement renaming an element to its own name is a no-op, not a collision', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename: 'c1', label: 'Renamed' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    expect(cap.saved().schema.flat.c1.definition.label).toBe('Renamed');
  });

  it('patchElement renaming repoints the bindings and interactions that named the old id', async () => {
    const space = buildSpace();
    space.schema.flat.home.definition.bindings = {
      attributes: [{ id: 'b1', source: 'container_c1.data', to: 'items' }]
    };
    space.schema.flat.home.definition.interactions = {
      n1: {
        id: 'n1',
        title: 'Hide',
        type: 'callback',
        action: 'setVisibility',
        elementId: 'c1',
        params: {},
        preview: {},
        beforeNode: '',
        afterNode: '',
        flowId: 'n1',
        enabled: true
      }
    };
    const cap = capturing(space);

    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', rename: 'catalog-api' }] },
      cap.saved(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const page = cap.saved().schema.flat.home.definition;
    expect(page.bindings?.attributes?.[0].source).toBe('container_catalog-api.data');
    expect(page.interactions?.n1.elementId).toBe('catalog-api');
  });
});
describe('MCP write response element versions (R1)', () => {
  it('returns each element with its own uri and stateVersion, ready for the next edit', async () => {
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'home',
            element: { ref: 'c1', type: 'container', props: { subType: 'article' } }
          }
        ]
      },
      buildSpace()
    );
    const el = res.elements?.find(e => e.ref === 'c1');
    expect(el?.uri).toBe('plitzi://schema/main/elements/c1');
    expect(el?.stateVersion).toMatch(/^[a-f0-9]{12}$/);
  });
});
