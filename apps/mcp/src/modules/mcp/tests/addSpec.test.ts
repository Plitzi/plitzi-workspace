import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { apply } from '../tools/apply';

import type { Operation } from '../tools/operations';

/**
 * An element tree in the authoring skill's vocabulary — what `container({ … })` returns, as JSON — and its classes:
 * one vocabulary for an agent in a project and over the MCP (RFC 0033 § 8.4).
 */

const card: Operation = {
  type: 'addSpec',
  pageRef: 'home',
  parentRef: 'c1',
  spec: {
    type: 'container',
    id: 'promo',
    attributes: { subType: 'section' },
    class: ['promo-card'],
    children: [
      { type: 'heading', id: 'promo-title', attributes: { content: 'Plans', subType: 'h2' } },
      {
        type: 'button',
        id: 'promo-go',
        attributes: { content: 'Start' },
        flows: [
          [
            { type: 'trigger', action: 'onClick', params: {} },
            {
              type: 'globalCallback',
              action: 'setState',
              on: 'state',
              params: { key: 'started', type: 'boolean', value: true }
            }
          ]
        ]
      }
    ]
  },
  classes: { 'promo-card': { padding: 24, borderRadius: 16 } }
};

describe('an element written as authoring writes one', () => {
  it('is added where it is asked, its children and its class with it', async () => {
    const cap = capturing(buildSpace());
    const result = await apply({ operations: [card] }, buildSpace(), cap.persisters);
    const { flat } = cap.saved().schema;

    expect(result.applied, JSON.stringify(result.errors)).toBe(true);
    expect(flat.promo.definition).toMatchObject({ parentId: 'c1', rootId: 'home', type: 'container' });
    expect(flat.promo.definition.items).toEqual(['promo-title', 'promo-go']);
    expect(flat.c1.definition.items).toContain('promo');
    expect(flat['promo-title'].attributes).toMatchObject({ content: 'Plans', subType: 'h2' });
    expect(flat.promo.definition.styleSelectors.base).toContain('promo-card');
    expect(cap.saved().style.platform.desktop['promo-card']).toBeDefined();
  });

  it('is refused in authoring’s own words for what authoring refuses', async () => {
    const cap = capturing(buildSpace());
    const result = await apply(
      {
        operations: [
          {
            type: 'addSpec',
            pageRef: 'home',
            spec: {
              type: 'heading',
              id: 'bad',
              attributes: { content: 'x' },
              children: [{ type: 'text', id: 'bad-in', attributes: { content: 'y' } }]
            }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(result).toMatchObject({ applied: false, errors: [{ code: 'bad-value', path: 'operations[0].spec' }] });
    expect(result.errors?.[0]?.message).toMatch(/holds none/);
  });

  it('refuses a name the space already has, naming it', async () => {
    const cap = capturing(buildSpace());
    const result = await apply(
      {
        operations: [
          { type: 'addSpec', pageRef: 'home', spec: { type: 'text', id: 'c1', attributes: { content: 'again' } } }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(result).toMatchObject({
      applied: false,
      errors: [{ code: 'exists', message: 'The space already has "c1"' }]
    });
  });

  it('says what authoring warns of, with the batch', async () => {
    const cap = capturing(buildSpace());
    const result = await apply(
      {
        operations: [
          {
            type: 'addSpec',
            pageRef: 'home',
            spec: {
              type: 'button',
              id: 'go',
              attributes: { content: 'Button' },
              children: [{ type: 'text', id: 'go-in', attributes: { content: 'Launch' } }]
            }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(result.applied).toBe(true);
    expect(result.warnings?.some(warning => warning.startsWith('operations[0].spec:'))).toBe(true);
  });
});
