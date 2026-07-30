import { describe, it, expect } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply, search, validate } from '../tools';

import type { Space } from '../helpers';
import type { AIDefinition, AIElementDetail } from '../types';

describe('mcp-ai global element styles (editable site-wide selectors like `button { … }`)', () => {
  const globalOp = {
    type: 'upsertGlobalStyle',
    componentType: 'button',
    desktop: { 'border-radius': '9999px' }
  } as const;

  it('creates a type "element" selector keyed by componentType — "all buttons rounded"', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    const item = cap.saved().style.platform.desktop.button as unknown as { type: string; componentType: string };
    expect(item.type).toBe('element');
    expect(item.componentType).toBe('button');
    const read = readResource(cap.saved(), 'main', 'plitzi://global-styles/main/button')?.data as AIDefinition & {
      appliesToType: string;
    };
    expect(read.appliesToType).toBe('button');
    expect(read.desktop?.['border-top-left-radius']).toBe('9999px');
  });

  it('lists the element types that have a global style', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://global-styles/main')?.data).toEqual(['button']);
  });

  it('reflects the created global in the detail of every element of that type', async () => {
    const cap = capturing(buildSpace());
    // c1 is a container; add a button element so it inherits the button global.
    await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'cta', type: 'button', props: { content: 'Go' } } },
          globalOp
        ]
      },
      buildSpace(),
      cap.persisters
    );
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/cta')?.data as AIElementDetail;
    expect(el.globalStyles?.[0].appliesToType).toBe('button');
    expect(el.globalStyles?.[0].desktop?.['border-top-left-radius']).toBe('9999px');
  });

  it('patchGlobalStyle merges into an existing global without resending it', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    const res = await apply(
      { operations: [{ type: 'patchGlobalStyle', componentType: 'button', desktop: { color: 'white' } }] },
      cap.saved(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const read = readResource(cap.saved(), 'main', 'plitzi://global-styles/main/button')?.data as AIDefinition;
    expect(read.desktop?.color).toBe('white');
    expect(read.desktop?.['border-top-left-radius']).toBe('9999px');
  });

  it('deleteGlobalStyle removes the global selector', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    await apply({ operations: [{ type: 'deleteGlobalStyle', componentType: 'button' }] }, cap.saved(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://global-styles/main/button')).toBeNull();
  });

  it('refuses a global op on a name held by a class definition (symmetric guard)', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertGlobalStyle', componentType: 'box', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('class definition');
  });

  it('patchGlobalStyle fails when no global exists yet for that type', async () => {
    const res = await apply(
      { operations: [{ type: 'patchGlobalStyle', componentType: 'button', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('No global style');
  });
});

describe('mcp-ai id styles (editable single-element selectors like `#hero { … }`)', () => {
  const idOp = { type: 'upsertIdStyle', targetId: 'hero', desktop: { 'min-height': '100vh' } } as const;

  it('creates a type "id" selector keyed by the DOM id', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    const item = cap.saved().style.platform.desktop.hero as unknown as { type: string; cache: string };
    expect(item.type).toBe('id');
    expect(item.cache).toContain('#hero');
    const read = readResource(cap.saved(), 'main', 'plitzi://id-styles/main/hero')?.data as AIDefinition & {
      targetId: string;
    };
    expect(read.targetId).toBe('hero');
    expect(read.desktop?.['min-height']).toBe('100vh');
  });

  it('lists the DOM ids that have an id rule', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://id-styles/main')?.data).toEqual(['hero']);
  });

  it('patchIdStyle merges into an existing id rule; deleteIdStyle removes it', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    const patched = await apply(
      { operations: [{ type: 'patchIdStyle', targetId: 'hero', desktop: { color: 'white' } }] },
      cap.saved(),
      cap.persisters
    );
    expect(patched.applied).toBe(true);
    const read = readResource(cap.saved(), 'main', 'plitzi://id-styles/main/hero')?.data as AIDefinition;
    expect(read.desktop?.color).toBe('white');
    expect(read.desktop?.['min-height']).toBe('100vh');

    await apply({ operations: [{ type: 'deleteIdStyle', targetId: 'hero' }] }, cap.saved(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://id-styles/main/hero')).toBeNull();
  });

  it('patchIdStyle fails when no id rule exists yet', async () => {
    const res = await apply(
      { operations: [{ type: 'patchIdStyle', targetId: 'hero', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('No id rule');
  });

  it('refuses an id op on a name held by a class definition (cross-kind guard)', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertIdStyle', targetId: 'box', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('class definition');
  });

  it('inlines the id rule in the detail of an element carrying that DOM id', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { id: 'hero' } }, idOp] },
      buildSpace(),
      cap.persisters
    );
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.idStyle?.targetId).toBe('hero');
    expect(el.idStyle?.desktop?.['min-height']).toBe('100vh');
  });

  it('omits idStyle when the element has no matching DOM id', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.idStyle).toBeUndefined();
  });
});

describe('mcp-ai style variants + element state', () => {
  it('an element read exposes availableVariants of its attached classes', () => {
    const el = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.availableVariants).toEqual({ box: ['lg'] });
  });

  it('patchElement applies a style variant + visibility and the read reflects it', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          {
            type: 'patchElement',
            pageRef: 'home',
            ref: 'c1',
            initialState: { styleVariant: { box: { base: 'lg' } }, visibility: false }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.initialState).toEqual({ styleVariant: { box: { base: 'lg' } }, visibility: false });
  });

  it('warns when an element applies a variant its class does not declare', () => {
    const res = validate(
      {
        operations: [
          {
            type: 'patchElement',
            pageRef: 'home',
            ref: 'c1',
            initialState: { styleVariant: { box: { base: 'ghost' } } }
          }
        ]
      },
      buildSpace()
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('ghost'))).toBe(true);
  });

  it('does not warn for a declared variant, nor for one created in the same batch', () => {
    const res = validate(
      {
        operations: [
          { type: 'patchElement', pageRef: 'home', ref: 'c1', initialState: { styleVariant: { box: { base: 'lg' } } } },
          { type: 'upsertDefinition', ref: 'box', variants: { fresh: { desktop: { color: 'red' } } } },
          {
            type: 'patchElement',
            pageRef: 'home',
            ref: 'c1',
            initialState: { styleVariant: { box: { base: 'fresh' } } }
          }
        ]
      },
      buildSpace()
    );
    expect(res.warnings.some(w => w.includes('lg') || w.includes('fresh'))).toBe(false);
  });
});

describe('mcp-ai patchDefinition (RFC 0005 #2 — partial CSS merge)', () => {
  it('merges one declaration, preserving the rest of the definition', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { color: 'red' } }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop).toEqual({ display: 'flex', color: 'red' });
    expect(def.variants?.lg.desktop).toEqual({ 'font-size': '50px' });
  });

  it('removes a property when its value is null, leaving the others', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { display: null, 'align-items': 'center' } }] },
      buildSpace(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop).toEqual({ 'align-items': 'center' });
  });

  it('fails (does not create) when the definition does not exist', async () => {
    const res = await apply(
      { operations: [{ type: 'patchDefinition', ref: 'ghost', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('not found');
  });

  it('expands shorthands in a patch just like upsertDefinition', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { padding: '4px 8px' } }] },
      buildSpace(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop?.['padding-top']).toBe('4px');
    expect(def.desktop?.['padding-right']).toBe('8px');
    expect(def.desktop?.display).toBe('flex');
  });

  it('lets a patched shorthand overwrite the longhands a previous edit stored', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { 'padding-left': '99px' } }] },
      buildSpace(),
      cap.persisters
    );
    expect(
      (readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition).desktop?.[
        'padding-left'
      ]
    ).toBe('99px');

    // The stored CSS is longhand, so the shorthand has to be atomized BEFORE the merge or padding-left survives it.
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { padding: '4px' } }] },
      cap.saved(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop?.['padding-left']).toBe('4px');
    expect(def.desktop?.['padding-top']).toBe('4px');
  });

  it('removes every longhand a shorthand controls when it is patched to null', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { border: '1px solid red' } }] },
      buildSpace(),
      cap.persisters
    );
    expect(
      (readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition).desktop?.[
        'border-top-width'
      ]
    ).toBe('1px');

    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { border: null } }] },
      cap.saved(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(Object.keys(def.desktop ?? {}).filter(key => key.startsWith('border-'))).toEqual([]);
    expect(def.desktop?.display).toBe('flex');
  });
});

describe('mcp-ai class ops never touch a global element style (false-positive guard)', () => {
  const spaceWithGlobal = (): Space => {
    const space = buildSpace();
    space.style.platform.desktop.button = {
      name: 'button',
      type: 'element',
      componentType: 'button',
      attributes: { base: { default: { 'background-color': 'blue' } } },
      cache: ''
    } as unknown as (typeof space.style.platform)['desktop'][string];

    return space;
  };

  it('excludes element-type items from the definitions listing and does not resolve one', () => {
    expect(readResource(spaceWithGlobal(), 'main', 'plitzi://definitions/main')?.data).toEqual(['box']);
    expect(readResource(spaceWithGlobal(), 'main', 'plitzi://definitions/main/button')).toBeNull();
  });

  it('omits element-type items from search definitions', () => {
    expect(search({ query: 'button' }, spaceWithGlobal(), 'main').definitions).toBeUndefined();
  });

  it('refuses upsertDefinition on a global element name and never converts it', async () => {
    const cap = capturing(spaceWithGlobal());
    const res = await apply(
      { operations: [{ type: 'upsertDefinition', ref: 'button', desktop: { color: 'red' } }] },
      cap.saved(),
      cap.persisters
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('global style');
    // Nothing persisted; the global item keeps its type and CSS.
    const item = cap.saved().style.platform.desktop.button as unknown as { type: string };
    expect(item.type).toBe('element');
  });

  it('refuses patchDefinition and deleteDefinition on a global element name', async () => {
    const patched = await apply(
      { operations: [{ type: 'patchDefinition', ref: 'button', desktop: { color: 'red' } }] },
      spaceWithGlobal()
    );
    expect(patched.applied).toBe(false);
    expect(patched.errors?.[0].message).toContain('global style');

    const deleted = await apply({ operations: [{ type: 'deleteDefinition', ref: 'button' }] }, spaceWithGlobal());
    expect(deleted.applied).toBe(false);
    expect(deleted.errors?.[0].message).toContain('global style');
  });
});

describe('mcp-ai CSS shorthand expansion (I4)', () => {
  it('accepts border-radius / padding shorthands and persists them as longhands', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertDefinition', ref: 'pill', desktop: { 'border-radius': '9999px', padding: '4px 8px' } }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/pill')?.data as AIDefinition;
    expect(def.desktop?.['border-top-left-radius']).toBe('9999px');
    expect(def.desktop?.['padding-top']).toBe('4px');
    expect(def.desktop?.['padding-right']).toBe('8px');
    expect(def.desktop).not.toHaveProperty('border-radius');
  });

  it('expands the border shorthand into per-side width/style/color', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'upsertDefinition', ref: 'bd', desktop: { border: '1px solid red' } }] },
      buildSpace(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/bd')?.data as AIDefinition;
    expect(def.desktop?.['border-top-width']).toBe('1px');
    expect(def.desktop?.['border-top-style']).toBe('solid');
    expect(def.desktop?.['border-top-color']).toBe('red');
  });
});
