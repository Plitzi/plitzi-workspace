import { describe, expect, it } from 'vitest';

import { container } from '../../elements';
import { styles } from '../../style';
import { authorSpace } from '../space';

import type { ElementSpec, SpaceSpec } from '../types';

const space = (body: ElementSpec[], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Overrides',
  permanentUrl: 'overrides',
  pages: [{ id: 'home', name: 'Home', slug: '', body }],
  ...extra
});

const overrides = (spec: SpaceSpec) =>
  authorSpace(spec).suggestions.filter(suggestion => suggestion.code === 'class-overrides-class');

describe('class-overrides-class', () => {
  it('says a class whose shorthand erases the longhand a class listed after it writes out', () => {
    const tight = styles('tight', { paddingTop: '0px' });
    const card = styles('card', { padding: '24px' });
    // `tight` is met first, so the stylesheet writes `card` after it, whatever the class list says.
    const found = overrides(
      space([
        container({ id: 'intro', class: tight }),
        container({ id: 'hero', class: [card, tight] }),
        container({ id: 'promo', class: [card, tight] })
      ])
    );

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ elementIds: ['hero', 'promo'], subjects: ['card', 'tight'], saves: 0 });
    expect(found[0].message).toContain('its `padding` sets padding-top: 24px over 0px at desktop, tablet, mobile');
    expect(found[0].message).toContain('not the order of a class list');
    expect(found[0].message).toContain('padding-right, padding-bottom, padding-left');
    expect(found[0].message).toContain(
      `"card" (styles('card')) erases what "tight" (styles('tight')) writes out on "hero"`
    );
  });

  // A run's agent fixed the element named, ran lint again and met the next one — four times: every one is named.
  it('names every element wearing both, not a count of the others', () => {
    const tight = styles('tight', { paddingTop: '0px' });
    const card = styles('card', { padding: '24px' });
    const wearing = Array.from({ length: 9 }, (_, index) => `card${String(index + 1)}`);
    const [found] = overrides(
      space([container({ id: 'intro', class: tight }), ...wearing.map(id => container({ id, class: [card, tight] }))])
    );

    expect(found.message).toContain(
      'on "card1" (and "card2", "card3", "card4", "card5", "card6", "card7" and 2 more, wearing both)'
    );
  });

  // A run made a shared class of a key's look, `gap: 10px` in it: `btn`, met first in the stylesheet's order, wrote its
  // `8px` later — two buttons lost two pixels, and author, lint and the check all passed.
  it('says a longhand another class sets over the same longhand, when the class listed after it loses', () => {
    const keyLed = styles('key-led', { gap: '10px' });
    const btn = styles('btn', { display: 'inline-flex', gap: '8px' });
    const found = overrides(
      space([
        // The header's key is met first: the stylesheet writes `btn` after `key-led`.
        container({ id: 'lamp', class: keyLed }),
        container({ id: 'cta', class: btn }),
        container({ id: 'follow', class: [btn, keyLed] })
      ])
    );

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ elementIds: ['follow'], subjects: ['btn', 'key-led'] });
    expect(found[0].message).toContain(
      `"btn" (styles('btn')) wins over what "key-led" (styles('key-led')) writes on "follow", listed after it: gap: 8px over 10px at desktop, tablet, mobile`
    );
  });

  it('says a breakpoint’s shorthand erasing a longhand written for every width', () => {
    const card = styles('card', { padding: { desktop: '24px', mobile: '16px' } });
    const tight = styles('tight', { paddingTop: '0px' });
    const found = overrides(space([container({ id: 'hero', class: [card, tight] })]));

    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('padding-top: 16px over 0px at mobile');
    expect(found[0].message).not.toContain('at desktop');
    expect(found[0].message).toContain("a breakpoint's rules come after the base ones");
  });

  it('knows a shorthand written for `compact` is one at tablet and mobile alike', () => {
    const card = styles('card', { compact: { padding: '16px' }, mobile: { paddingBottom: '4px' } });
    const tight = styles('tight', { paddingTop: '0px', paddingBottom: '0px' });
    const found = overrides(space([container({ id: 'hero', class: [card, tight] })]));

    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(
      'padding-top: 16px over 0px at tablet, mobile; padding-bottom: 16px over 0px at tablet'
    );
  });

  it('says the element’s own rules erased the same way', () => {
    const card = styles('card', { padding: { desktop: '24px', mobile: '16px' } });
    const found = overrides(space([container({ id: 'hero', class: [card, { paddingTop: '0px' }] })]));

    expect(found.map(each => each.subjects)).toEqual([['card', 'hero--own']]);
  });

  it('leaves base and modifier alone: a longhand on top, a shorthand that resets, the same value, one class', () => {
    const base = styles('base', { padding: '24px' });
    const top = styles('top', { paddingTop: '0px' });
    const flush = styles('flush', { padding: '0px' });
    const edged = styles('edged', { paddingTop: '8px' });
    const same = styles('same', { paddingTop: '24px' });
    const own = styles('own', { padding: '8px', paddingTop: '0px' });

    expect(
      overrides(
        space([
          container({ id: 'a', class: [base, top] }),
          container({ id: 'b', class: [edged, flush] }),
          container({ id: 'c', class: [base, same] }),
          container({ id: 'd', class: own })
        ])
      )
    ).toEqual([]);
  });

  it('is quieted on the element, as every suggestion is', () => {
    const tight = styles('tight', { paddingTop: '0px' });
    const card = styles('card', { padding: '24px' });

    expect(
      overrides(
        space([
          container({ id: 'intro', class: tight }),
          container({ id: 'hero', class: [card, tight], quiet: ['class-overrides-class'] })
        ])
      )
    ).toEqual([]);
  });
});
