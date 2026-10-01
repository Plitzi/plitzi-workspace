import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply } from '../tools';

import type { Space } from '../helpers';
import type { Operation } from '../tools/operations';
import type { AIComponentSummary, AIPageSkeleton } from '../types';

/**
 * Components through the MCP: declared with one op, filled with the element ops an agent already knows — `pageRef`
 * names the component — and placed as a `reference` element.
 */

const run = async (operations: Operation[], space: Space = buildSpace()) => {
  const cap = capturing(space);
  const res = await apply({ operations }, space, cap.persisters);

  return { res, space: res.applied ? cap.saved() : space };
};

/** A card with a required title, placed once on the home page. */
const withCard = async (): Promise<Space> => {
  const { res, space } = await run([
    {
      type: 'upsertComponent',
      ref: 'card',
      label: 'Card',
      props: { title: { type: 'text', description: 'The heading', required: true } }
    },
    {
      type: 'upsertElement',
      pageRef: 'card',
      parentRef: 'card-root',
      element: { ref: 'card-title', type: 'text', props: { content: '{{ props.title }}' } }
    },
    {
      type: 'upsertElement',
      pageRef: 'home',
      element: {
        ref: 'lamp',
        type: 'reference',
        props: { referenceType: 'component', referenceId: 'card', title: 'Lamp' }
      }
    }
  ]);

  expect(res.applied, JSON.stringify(res.errors)).toBe(true);

  return space;
};

describe('mcp-ai components', () => {
  it('declares a component, fills it through pageRef, and writes its tree beside the pages', async () => {
    const space = await withCard();

    expect(Object.keys(space.schema.components)).toEqual(['card']);
    expect(Object.keys(space.schema.components.card.flat).sort()).toEqual(['card-root', 'card-title']);
    expect(space.schema.flat['card-title']).toBeUndefined();
    expect(space.schema.flat.lamp.attributes).toMatchObject({ referenceId: 'card', title: 'Lamp' });
  });

  it('lists the components and reads one as a page is read', async () => {
    const space = await withCard();
    const components = readResource(space, 'main', 'plitzi://schema/main/components')?.data as AIComponentSummary[];

    expect(components).toEqual([
      expect.objectContaining({ ref: 'card', label: 'Card', rootRef: 'card-root', instances: 1, elementCount: 2 })
    ]);

    const tree = readResource(space, 'main', 'plitzi://schema/main/pages/card')?.data as AIPageSkeleton;
    expect(JSON.stringify(tree)).toContain('card-title');
  });

  it('refuses a name another tree already holds', async () => {
    const space = await withCard();
    const { res } = await run(
      [{ type: 'upsertElement', pageRef: 'home', element: { ref: 'card-title', type: 'text' } }],
      space
    );

    expect(res.applied).toBe(false);
  });

  it('makes a component of an element and leaves an instance where it was', async () => {
    const { res: placed, space: before } = await run([
      {
        type: 'upsertElement',
        pageRef: 'home',
        element: { ref: 'promo', type: 'container', children: [{ ref: 'promo-text', type: 'text' }] }
      }
    ]);
    expect(placed.applied, JSON.stringify(placed.errors)).toBe(true);

    const { res, space } = await run(
      [{ type: 'upsertComponent', ref: 'promo-card', fromRef: 'promo', instanceRef: 'promo-1' }],
      before
    );

    expect(res.applied, JSON.stringify(res.errors)).toBe(true);
    expect(space.schema.components['promo-card'].rootId).toBe('promo');
    expect(space.schema.flat['promo-1'].attributes).toMatchObject({ referenceId: 'promo-card' });
    expect(space.schema.flat.promo).toBeUndefined();
  });

  it('refuses a prop that is not one, naming why', async () => {
    const { res } = await run([
      { type: 'upsertComponent', ref: 'badge', props: { tone: { type: 'colour', description: 'x' } } }
    ]);

    expect(res.applied).toBe(false);
    expect(JSON.stringify(res.errors)).toContain('prop \\"tone\\" is not a prop');
  });

  it('refuses to delete a component something still places, naming it', async () => {
    const space = await withCard();
    const { res } = await run([{ type: 'deleteComponent', ref: 'card' }], space);

    expect(res.applied).toBe(false);
    expect(JSON.stringify(res.errors)).toContain('lamp');
  });
});
