import { describe, it, expect } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply } from '../tools';

import type { AIDefinition } from '../types';

// The batched form of upsertDefinition: one op carries every class, keyed by name. It exists purely to stop a
// widget from spending a third of its tokens on repeated `{"type":"upsertDefinition","ref":…}` envelopes, so what
// matters is that it writes EXACTLY what the single ops write.
describe('MCP upsertDefinitions (one op, many classes)', () => {
  const batch = {
    type: 'upsertDefinitions',
    definitions: {
      row: { desktop: { display: 'flex', 'flex-direction': 'row' } },
      pill: { desktop: { 'border-radius': '9999px', padding: '4px 8px' } },
      cta: { desktop: { color: '#fff' }, states: { hover: { desktop: { color: '#eee' } } } }
    }
  } as const;

  it('writes every class, identically to a run of upsertDefinition', async () => {
    const batched = capturing(buildSpace());
    const singles = capturing(buildSpace());

    expect((await apply({ operations: [batch] }, buildSpace(), batched.persisters)).applied).toBe(true);
    expect(
      (
        await apply(
          {
            operations: [
              { type: 'upsertDefinition', ref: 'row', desktop: { display: 'flex', 'flex-direction': 'row' } },
              { type: 'upsertDefinition', ref: 'pill', desktop: { 'border-radius': '9999px', padding: '4px 8px' } },
              {
                type: 'upsertDefinition',
                ref: 'cta',
                desktop: { color: '#fff' },
                states: { hover: { desktop: { color: '#eee' } } }
              }
            ]
          },
          buildSpace(),
          singles.persisters
        )
      ).applied
    ).toBe(true);

    expect(batched.saved().style.platform).toEqual(singles.saved().style.platform);
  });

  it('reports a bad property under the class it belongs to, and applies nothing', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertDefinitions',
            definitions: { ok: { desktop: { color: 'red' } }, bad: { desktop: { fontSize: '10px' } } }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0]?.path).toBe('operations[0].definitions.bad.desktop.fontSize');
    expect(res.errors?.[0]?.hint).toContain('font-size');
  });

  it('refuses a name already held by a global element style, like the single op does', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'upsertGlobalStyle', componentType: 'button', desktop: { color: 'red' } }] },
      buildSpace(),
      cap.persisters
    );
    const res = await apply(
      { operations: [{ type: 'upsertDefinitions', definitions: { button: { desktop: { color: 'blue' } } } }] },
      cap.saved(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0]?.path).toBe('operations[0].definitions.button');
  });

  it('counts a variant it declares as declared in this batch (no false warning on apply)', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertDefinitions',
            definitions: { chip: { desktop: { color: 'red' }, variants: { lg: { desktop: { 'font-size': '20px' } } } } }
          },
          {
            type: 'patchElement',
            pageRef: 'home',
            ref: 'c1',
            style: { base: ['chip'] },
            initialState: { styleVariant: { chip: { base: 'lg' } } }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    expect((res.warnings ?? []).join(' ')).not.toContain('lg');
  });
});
// Edge cases of the batched form. The point of each: an empty batch is a mistake worth naming, an upsert REPLACES
// (it does not merge), and every corner of a definition — breakpoints, states, variants, named slots — has to ride
// through the batch exactly as it does through the single op.
describe('MCP upsertDefinitions edge cases', () => {
  it('names an empty batch instead of silently doing nothing', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'upsertDefinitions', definitions: {} }] },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0]?.path).toBe('operations[0].definitions');
    expect(res.errors?.[0]?.hint).toContain('definitions');
  });

  it('REPLACES an existing class, like upsertDefinition (use patchDefinition to merge)', async () => {
    const cap = capturing(buildSpace());
    // `box` exists in the fixture with display:flex.
    const res = await apply(
      { operations: [{ type: 'upsertDefinitions', definitions: { box: { desktop: { color: 'red' } } } }] },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop?.color).toBe('red');
    expect(def.desktop).not.toHaveProperty('display');
  });

  it('carries breakpoints, states, variants and named slots through', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertDefinitions',
            definitions: {
              rich: {
                desktop: { 'font-size': '20px' },
                mobile: { 'font-size': '14px' },
                states: { hover: { desktop: { color: 'blue' } } },
                variants: { lg: { desktop: { 'font-size': '40px' } } },
                slots: { icon: { desktop: { width: '16px' } } }
              }
            }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/rich')?.data as AIDefinition & {
      variants?: Record<string, unknown>;
      slots?: Record<string, unknown>;
    };
    expect(def.desktop?.['font-size']).toBe('20px');
    expect(def.mobile?.['font-size']).toBe('14px');
    expect(def.states?.hover.desktop?.color).toBe('blue');
    expect(def.variants).toHaveProperty('lg');
    expect(def.slots).toHaveProperty('icon');
  });

  it('mixes with patchDefinition in the same batch, in order', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertDefinitions', definitions: { chip: { desktop: { color: 'red', padding: '4px' } } } },
          { type: 'patchDefinition', ref: 'chip', desktop: { color: 'green' } }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/chip')?.data as AIDefinition;
    expect(def.desktop?.color).toBe('green');
    expect(def.desktop?.['padding-top']).toBe('4px');
  });
});
describe('MCP ancestor conditions (`.card:hover .icon` as part of the class)', () => {
  const hover = { card: { states: { hover: { desktop: { transform: 'translateX(3px)' } } } } };

  const withHover = async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'upsertDefinition', ref: 'icon', desktop: { color: 'black' }, ancestors: hover }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);

    return cap.saved();
  };

  it('writes an ancestor state into the class, compiled, and reads it back', async () => {
    const space = await withHover();
    const def = readResource(space, 'main', 'plitzi://definitions/main/icon')?.data as AIDefinition;

    expect(def.ancestors).toEqual(hover);
    expect(space.style.platform.desktop.icon.cache).toContain(':where(.card:hover) &{transform:translateX(3px);}');
  });

  it('keeps the ancestors through a patch that does not name them, and removes one set to null', async () => {
    const space = await withHover();
    const cap = capturing(space);
    await apply(
      {
        operations: [
          {
            type: 'patchDefinition',
            ref: 'icon',
            desktop: { color: 'red' },
            ancestors: { sidebar: { variants: { collapsed: { desktop: { display: 'none' } } } } }
          }
        ]
      },
      space,
      cap.persisters
    );
    const patched = readResource(cap.saved(), 'main', 'plitzi://definitions/main/icon')?.data as AIDefinition;
    expect(patched.ancestors).toEqual({
      ...hover,
      sidebar: { variants: { collapsed: { desktop: { display: 'none' } } } }
    });

    const removal = capturing(cap.saved());
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'icon', ancestors: { card: null } }] },
      cap.saved(),
      removal.persisters
    );
    const removed = readResource(removal.saved(), 'main', 'plitzi://definitions/main/icon')?.data as AIDefinition;
    expect(Object.keys(removed.ancestors ?? {})).toEqual(['sidebar']);
  });
});
