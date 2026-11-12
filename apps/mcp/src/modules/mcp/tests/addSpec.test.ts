import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { apply } from '../tools/apply';

import type { Operation } from '../tools/operations';

/**
 * An element tree in the authoring skill's vocabulary — what `container({ … })` returns, as JSON — and its classes:
 * one vocabulary for an agent in a project and over the MCP.
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

  describe('in the place of an element (`replaces`)', () => {
    const text = (id: string, content: string): Operation => ({
      type: 'addSpec',
      pageRef: 'home',
      parentRef: 'c1',
      spec: { type: 'text', id, attributes: { content } }
    });

    const rewrite: Operation = {
      type: 'addSpec',
      pageRef: 'home',
      replaces: 'promo',
      spec: {
        type: 'container',
        id: 'promo',
        children: [
          { type: 'heading', id: 'promo-title', attributes: { content: 'Pricing', subType: 'h2' } },
          { type: 'text', id: 'promo-note', attributes: { content: 'Monthly or yearly' } }
        ]
      }
    };

    it('takes its place among its siblings, may name its ids again, and drops what the spec leaves out', async () => {
      const cap = capturing(buildSpace());
      const result = await apply(
        { operations: [text('first', 'A'), card, text('last', 'Z'), rewrite] },
        buildSpace(),
        cap.persisters
      );
      const { flat } = cap.saved().schema;

      expect(result.applied, JSON.stringify(result.errors)).toBe(true);
      expect(flat.c1.definition.items).toEqual(['first', 'promo', 'last']);
      expect(flat.promo.definition).toMatchObject({ parentId: 'c1', rootId: 'home' });
      expect(flat.promo.definition.items).toEqual(['promo-title', 'promo-note']);
      expect(flat['promo-title'].attributes).toMatchObject({ content: 'Pricing' });
      expect(flat['promo-go']).toBeUndefined();
    });

    it('goes inside the parent when it was its only child', async () => {
      const cap = capturing(buildSpace());
      const result = await apply({ operations: [card, rewrite] }, buildSpace(), cap.persisters);

      expect(result.applied, JSON.stringify(result.errors)).toBe(true);
      expect(cap.saved().schema.flat.c1.definition.items).toEqual(['promo']);
    });

    it('still refuses a name the space has elsewhere', async () => {
      const cap = capturing(buildSpace());
      const result = await apply(
        {
          operations: [
            card,
            { ...rewrite, spec: { type: 'container', id: 'promo', children: [{ type: 'text', id: 'c1' }] } }
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

    it('refuses a place said twice, and an element the page does not have', async () => {
      const twice = await apply(
        { operations: [card, { ...rewrite, parentRef: 'c1' }] },
        buildSpace(),
        capturing(buildSpace()).persisters
      );
      const nowhere = await apply(
        { operations: [{ ...rewrite, replaces: 'nope' }] },
        buildSpace(),
        capturing(buildSpace()).persisters
      );

      expect(twice).toMatchObject({ applied: false, errors: [{ code: 'bad-value', path: 'operations[1].replaces' }] });
      expect(nowhere).toMatchObject({ applied: false, errors: [{ code: 'missing', path: 'operations[0].replaces' }] });
    });
  });
});
