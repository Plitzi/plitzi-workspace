import { describe, expect, it } from 'vitest';

import { HEAVY_PAGE_BYTES } from './heavyPages';
import { authorSpace, container, list, paragraph, styles, text } from '../../index';

import type { ElementSpec, SpaceSpec } from '../../index';

/** The `heavy-page` suggestions of a space. */
const offered = (spec: SpaceSpec) =>
  authorSpace(spec).suggestions.filter(suggestion => suggestion.code === 'heavy-page');

const CARD = styles('card', { padding: 16 });

const WORDS = 'A plan for a site that sells, with its own domain, analytics, forms and a team of people who edit it. ';

/** A card of a plan, written out by hand: a title, a long description and six lines of what it includes. */
const card = (index: number): ElementSpec =>
  container({
    id: `plan-${String(index)}`,
    class: CARD,
    children: [
      text(`Plan ${String(index)}`, { id: `plan-${String(index)}-title` }),
      paragraph(WORDS.repeat(6), { id: `plan-${String(index)}-about` }),
      ...Array.from({ length: 6 }, (_, line) =>
        text(`${WORDS} (${String(line)})`, { id: `plan-${String(index)}-line-${String(line)}` })
      )
    ]
  });

const space = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Pricing',
  permanentUrl: 'pricing',
  classes: { card: CARD },
  pages: [
    { id: 'home', name: 'Home', slug: '', isDefault: true, body: [text('Hello', { id: 'hello' })] },
    { id: 'pricing', name: 'Pricing', slug: 'pricing', body }
  ]
});

describe('heavy-page, a suggestion', () => {
  it('says a page past the line, its weight, and the shapes written again most by what they weigh', () => {
    const found = offered(space(Array.from({ length: 80 }, (_, index) => card(index))));

    expect(found).toHaveLength(1);
    expect(found[0].elementIds[0]).toBe('pricing');
    expect(found[0].message).toMatch(/^Page "pricing" is \d+ KB of document, past 250 KB/);
    // The cards are the shape: the lines inside each are weighed in it, not named again.
    expect(found[0].message).toContain('"plan-0" ×80');
    expect(found[0].message).not.toContain('plan-0-line');
    expect(found[0].saves).toBeGreaterThan(0);
  });

  it('says nothing of a page under the line, nor of the same page written once as a list', () => {
    expect(offered(space(Array.from({ length: 4 }, (_, index) => card(index))))).toEqual([]);

    const rows = Array.from({ length: 80 }, (_, index) => ({ title: `Plan ${String(index)}`, about: WORDS.repeat(6) }));
    const asList = space([
      list({
        id: 'plans',
        source: 'controlled',
        items: rows,
        children: [text('', { id: 'plan-title', from: 'plans.item.title' })]
      })
    ]);

    expect(JSON.stringify(authorSpace(asList).schema).length).toBeLessThan(HEAVY_PAGE_BYTES * 2);
    expect(offered(asList)).toEqual([]);
  });
});
