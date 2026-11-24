import { describe, expect, it } from 'vitest';

import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

import {
  ancestorTypeFor,
  categoryDisplay,
  definitionsByCategory,
  getInitialItems,
  hoverTextOf,
  makeIdMinter,
  summaryOf
} from './ElementHelper';
import { definitionOf } from './tests/definitions';

import type { Schema } from '@plitzi/sdk-shared';

const schemaWith = (ids: string[]): Pick<Schema, 'flat' | 'components'> => ({
  flat: Object.fromEntries(
    ids.map(id => [
      id,
      {
        id,
        attributes: {},
        definition: { type: 'text', label: 'Text', rootId: 'home', items: [], styleSelectors: { base: '' } }
      }
    ])
  ),
  components: {}
});

describe('names for a burst of new elements', () => {
  it('are free of the document and of each other, and say the element’s type', () => {
    const mint = makeIdMinter(schemaWith(['home', 'text-1']));
    const minted = Array.from({ length: 50 }, () => mint('text'));

    expect(new Set(minted).size).toBe(50);
    expect(minted).not.toContain('text-1');
    expect(minted.every(id => id.startsWith('text'))).toBe(true);
  });
});

describe('what a dropped element starts with', () => {
  const definitions = {
    card: definitionOf('card', { items: [], initialItems: ['heading', 'paragraph'] }),
    heading: definitionOf('heading'),
    paragraph: definitionOf('paragraph')
  };

  it('is its own children, each minted afresh and placed under it, the tree flat beside them', () => {
    let next = 0;
    const mint = (type: string) => `${type}-${String((next += 1))}`;
    const { directItems, items } = getInitialItems('page', ['card'], definitions, mint, 'home');
    const [cardId] = Object.keys(directItems);
    const card = items[cardId];

    expect(cardId).toBe('card-1');
    expect(card.definition).toMatchObject({ parentId: 'page', rootId: 'home', items: ['heading-2', 'paragraph-3'] });
    expect(items['heading-2'].definition).toMatchObject({ parentId: 'card-1', rootId: 'home', type: 'heading' });
    expect(Object.keys(items).sort()).toEqual(['card-1', 'heading-2', 'paragraph-3']);
    // The definitions themselves are never written to: the next drop starts from the same ones.
    expect(definitions.card.definition).not.toHaveProperty('parentId');
  });

  it('is nothing for a definition that is not there', () => {
    expect(getInitialItems('page', ['missing'], definitions, type => type)).toEqual({ directItems: {}, items: {} });
    expect(getInitialItems('page', undefined, definitions, type => type)).toEqual({ directItems: {}, items: {} });
  });
});

describe('the elements panel’s catalog', () => {
  const definitions = {
    text: definitionOf('text', { label: 'Text', category: 'basic' }),
    button: definitionOf('button', { label: 'Button', category: 'basic' }),
    container: definitionOf('container', { label: 'Container', category: 'structure' }),
    blockHtml: definitionOf('blockHtml', { label: 'HTML', category: 'advanced' }),
    seats: definitionOf('seats', { label: 'Seat picker', category: 'Tickets' }),
    page: definitionOf('page', { label: 'Page', category: 'structure', canDragDrop: false })
  };

  it('groups what may be dragged in by category, in the panel’s order — a plugin’s after the known, advanced last', () => {
    const listed = definitionsByCategory(definitions, '');

    expect(listed.map(([category]) => category)).toEqual(['basic', 'structure', 'Tickets', 'advanced']);
    expect(listed[0][1].map(({ definition }) => definition.definition.label)).toEqual(['Button', 'Text']);
    expect(listed.flatMap(([, list]) => list.map(({ definition }) => definition.type))).not.toContain('page');
  });

  it('finds an element by its label or its type, whatever their case', () => {
    expect(
      definitionsByCategory(definitions, '  SEAT ').flatMap(([, list]) => list.map(({ definition }) => definition.type))
    ).toEqual(['seats']);
    expect(definitionsByCategory(definitions, 'blockhtml')[0][1][0].definition.type).toBe('blockHtml');
    expect(definitionsByCategory(definitions, 'nothing like it')).toEqual([]);
  });

  it('lists each part right after the element it goes inside, saying which — the rest by their label', () => {
    const structure = {
      variant: definitionOf('variantItem', { label: 'Variant', category: 'structure', ancestorType: 'variants' }),
      variants: definitionOf('variants', { label: 'Variants', category: 'structure' }),
      carousel: definitionOf('carousel', { label: 'Carousel', category: 'structure' }),
      track: definitionOf('carouselTrack', {
        label: 'Carousel Track',
        category: 'structure',
        ancestorType: 'carousel'
      }),
      wide: definitionOf('wide', { label: 'Banner', category: 'structure' })
    };
    const [[, listed]] = definitionsByCategory(structure, '');

    expect(listed.map(({ definition, partOf }) => [definition.type, partOf])).toEqual([
      ['wide', undefined],
      ['carousel', undefined],
      ['carouselTrack', 'Carousel'],
      ['variants', undefined],
      ['variantItem', 'Variants']
    ]);
    // Found alone, a part still says what it goes inside.
    const [[, found]] = definitionsByCategory(structure, 'variantItem');
    expect(found).toEqual([{ definition: structure.variant, partOf: 'Variants' }]);
  });

  it('reads what a part goes inside off a plugin’s manifest, and off a built-in’s own declaration', () => {
    expect(ancestorTypeFor('seat', definitionOf('seat', { ancestorType: 'seatMap' }))).toBe('seatMap');
    expect(ancestorTypeFor('variantItem', undefined)).toBe('variants');
    expect(ancestorTypeFor('container', undefined)).toBeUndefined();
  });

  it('says on hover what an element is, and what a part goes inside', () => {
    expect(hoverTextOf('Variant', 'One variant.', 'Variants')).toBe('Variant — goes inside Variants — One variant.');
    expect(hoverTextOf('Text', '')).toBe('Text');
  });

  it('shows a known category by its name and icon, and a plugin’s by the name it gave', () => {
    expect(categoryDisplay('provider')).toEqual({ label: 'Data', icon: 'fa-solid fa-plug' });
    expect(categoryDisplay('user')).toEqual({ label: 'User', icon: 'fa-solid fa-user' });
    expect(categoryDisplay('Tickets')).toEqual({ label: 'Tickets', icon: 'fa-solid fa-puzzle-piece' });
  });

  it('says an element by the first sentence of its description', () => {
    expect(summaryOf(definitionOf('list', { description: 'Rows of data. Each row is a component.' }))).toBe(
      'Rows of data.'
    );
    expect(summaryOf(definitionOf('map', { description: 'A map' }))).toBe('A map');
    expect(summaryOf(definitionOf('track', { description: 'Where it shows its slides: one per item.' }))).toBe(
      'Where it shows its slides.'
    );
    expect(summaryOf(definitionOf('box'))).toBe('');
    expect(summaryOf(definitionOf('row', { description: 'One of a `list`’s rows.' }))).toBe('One of a list’s rows.');
  });

  it('says every built-in element by a sentence of its own, never a lead-in such as “An A/B test:”', () => {
    const lacking = Object.values(elementDeclarations).flatMap(({ type, content }) => {
      const description = 'description' in content.definition ? content.definition.description : '';
      const summary = summaryOf(definitionOf(type, { description }));
      const words = summary.split(/\s+/).length;
      // A colon closes a lead-in when what comes before it is a bare name: "A realtime channel:".
      const leadIn = /^[^.]*:(\s|$)/.test(description) && words < 5;

      return words < 3 || leadIn ? [[type, summary]] : [];
    });

    expect(lacking).toEqual([]);
  });
});
