/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
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
