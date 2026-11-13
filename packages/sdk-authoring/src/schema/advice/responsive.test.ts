import { describe, expect, it } from 'vitest';

import { authorSpace, container, styles, text } from '../../index';

import type { CssProps, ElementSpec, SpaceSpec, StyleSpec } from '../../index';

/** The `desktop-only` suggestions of a space. */
const offered = (spec: SpaceSpec) =>
  authorSpace(spec).suggestions.filter(suggestion => suggestion.code === 'desktop-only');

/** A home page whose body wears `style` on one container, with two texts inside it. */
const space = (style: StyleSpec, extra: Partial<SpaceSpec> = {}): SpaceSpec => {
  const box = styles('box', style);
  const body: ElementSpec[] = [
    container({ id: 'panel', class: box, children: [text('One', { id: 'one' }), text('Two', { id: 'two' })] })
  ];

  return {
    name: 'Shop',
    permanentUrl: 'shop',
    classes: { box },
    pages: [{ id: 'home', name: 'Home', slug: '', isDefault: true, body }],
    ...extra
  };
};

describe('desktop-only, a suggestion', () => {
  it('names a width past a phone that no mobile rule sets again, by its class and the element wearing it', () => {
    const found = offered(space({ css: { desktop: { width: '960px' } } }));

    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(/^Page "home" is styled for the desktop alone where a phone \(390 px\) breaks:/);
    expect(found[0].message).toContain('class "box" width 960px ("panel")');
    expect(found[0].elementIds).toEqual(['home', 'panel']);
    expect(found[0].subjects).toEqual(['box']);
  });

  it('names a grid a phone cannot hold, and type it holds a word or two a line of', () => {
    const cards = offered(
      space({ css: { desktop: { 'grid-template-columns': 'repeat(4, 1fr)', 'column-gap': '24px' } } })
    );
    const footer = offered(space({ css: { desktop: { 'grid-template-columns': '1.4fr 1fr 1fr 1fr', gap: '40px' } } }));
    const wide = offered(space({ css: { desktop: { 'grid-template-columns': '200px 200px minmax(120px, 1fr)' } } }));
    const type = offered(space({ css: { desktop: { 'font-size': '72px' } } }));

    expect(cards[0]?.message).toMatch(/class "box" 4 columns, about \d+px each on a phone/);
    expect(footer[0]?.message).toMatch(/class "box" 4 columns, about \d+px each on a phone/);
    expect(wide[0]?.message).toContain('class "box" 3 columns at least 520px wide');
    expect(type[0]?.message).toContain('class "box" font-size 72px');
  });

  // Each read off a seed: a row whose one column grows, a chart's bars, an emoji tray, a price.
  it('says nothing of a row, a dense widget, or type a phone holds', () => {
    const cases: CssProps[] = [
      { 'grid-template-columns': '48px minmax(0, 1fr) auto', 'column-gap': '14px' },
      { 'grid-template-columns': 'repeat(30, minmax(0px, 1fr))', 'column-gap': '6px' },
      { 'grid-template-columns': 'repeat(6, 32px)', gap: '2px' },
      { 'grid-template-columns': 'repeat(3, minmax(0px, 1fr))', 'column-gap': '10px' },
      { 'font-size': '56px' }
    ];
    for (const desktop of cases) {
      expect(offered(space({ css: { desktop } })), JSON.stringify(desktop)).toEqual([]);
    }
  });

  it('says nothing of what a mobile rule sets again, nor of what is fluid on its own', () => {
    expect(offered(space({ css: { desktop: { width: '960px' }, mobile: { width: '100%' } } }))).toEqual([]);
    expect(offered(space({ css: { desktop: { width: '960px', 'max-width': '100%' } } }))).toEqual([]);
    expect(offered(space({ css: { desktop: { width: 'min(960px, 100%)' } } }))).toEqual([]);
    expect(offered(space({ css: { desktop: { 'font-size': 'clamp(32px, 6vw, 72px)' } } }))).toEqual([]);
    expect(
      offered(space({ css: { desktop: { 'grid-template-columns': 'repeat(auto-fit, minmax(240px, 1fr))' } } }))
    ).toEqual([]);
    expect(offered(space({ css: { desktop: { 'grid-template-columns': '1fr 1fr' } } }))).toEqual([]);
    expect(offered(space({ css: { desktop: { width: '320px', 'font-size': '18px' } } }))).toEqual([]);
  });

  // The back-office's tables: a row of fixed columns on a desktop, stacked on a phone — a grid it no longer is.
  it('says nothing of a grid a mobile rule lays out otherwise', () => {
    const columns = { 'grid-template-columns': 'minmax(0, 1fr) 120px 160px 110px', 'column-gap': '16px' };

    expect(offered(space({ css: { desktop: { display: 'grid', ...columns }, mobile: { display: 'flex' } } }))).toEqual(
      []
    );
    expect(
      offered(space({ css: { desktop: { display: 'grid', ...columns }, mobile: { display: 'inline-grid' } } }))
    ).toHaveLength(1);
  });

  // The pricing page's comparison, scrolled sideways in its card; the hero's glow, clipped by the hero.
  it('says nothing of a width inside a box that scrolls or clips it sideways, but still names its type', () => {
    const held = (overflow: CssProps, inner: CssProps): SpaceSpec => {
      const frame = styles('frame', { css: { desktop: overflow } });
      const box = styles('box', { css: { desktop: inner } });

      return {
        name: 'Shop',
        permanentUrl: 'shop',
        classes: { frame, box },
        pages: [
          {
            id: 'home',
            name: 'Home',
            slug: '',
            isDefault: true,
            body: [
              container({
                id: 'frame',
                class: frame,
                children: [container({ id: 'panel', class: box, children: [text('One', { id: 'one' })] })]
              })
            ]
          }
        ]
      };
    };

    expect(offered(held({ 'overflow-x': 'auto' }, { 'min-width': '720px' }))).toEqual([]);
    expect(offered(held({ overflow: 'hidden' }, { width: '760px' }))).toEqual([]);
    expect(offered(held({ overflow: 'visible hidden' }, { width: '760px' }))).toHaveLength(1);
    expect(offered(held({ 'overflow-x': 'auto' }, { 'font-size': '72px' }))).toHaveLength(1);
  });

  // A style's mobile is laid over its desktop alone: a tablet rule leaves a phone the desktop's.
  it('still names what only a tablet rule sets again', () => {
    const found = offered(space({ css: { desktop: { width: '960px' }, tablet: { width: '100%' } } }));

    expect(found).toHaveLength(1);
  });

  it('takes a mobile rule of another class the same element wears as setting it again', () => {
    const base = styles('box', { css: { desktop: { width: '960px' } } });
    const phone = styles('box-phone', { css: { mobile: { width: '100%' } } });
    const spec: SpaceSpec = {
      name: 'Shop',
      permanentUrl: 'shop',
      classes: { box: base, 'box-phone': phone },
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [container({ id: 'panel', class: [base, phone], children: [text('One', { id: 'one' })] })]
        }
      ]
    };

    expect(offered(spec)).toEqual([]);
  });

  // The sign-in's brand panel: 60 px type, on a half a phone never draws.
  it('says nothing of what a mobile rule hides, nor of anything inside it', () => {
    const pane = styles('pane', { css: { desktop: { display: 'flex' }, mobile: { display: 'none' } } });
    const claim = styles('claim', { css: { desktop: { 'font-size': '60px', width: '640px' } } });
    const spec: SpaceSpec = {
      name: 'Shop',
      permanentUrl: 'shop',
      classes: { pane, claim },
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [
            container({
              id: 'aside',
              class: pane,
              children: [container({ id: 'big', class: claim, children: [text('Hi', { id: 'hi' })] })]
            })
          ]
        }
      ]
    };

    expect(offered(spec)).toEqual([]);
  });

  // Kinetic's orrery: a 900 px scene a phone shows whole, scaled to fit.
  it('says nothing of what a mobile rule scales down whole, nor of anything inside it', () => {
    const scene = styles('scene', { css: { desktop: { width: '900px' }, mobile: { transform: 'scale(0.42)' } } });
    const plane = styles('plane', { css: { desktop: { width: '860px' } } });
    const spec: SpaceSpec = {
      name: 'Shop',
      permanentUrl: 'shop',
      classes: { scene, plane },
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [
            container({
              id: 'orrery',
              class: scene,
              children: [container({ id: 'disc', class: plane, children: [text('Sun', { id: 'sun' })] })]
            })
          ]
        }
      ]
    };

    expect(offered(spec)).toEqual([]);
  });

  it('says nothing of a space written mobile first, whose base is the phone’s', () => {
    expect(offered(space({ css: { desktop: { width: '960px' } } }, { mode: 'mobile-first' }))).toEqual([]);
  });

  it('names a class once, with how many elements wear it', () => {
    const box = styles('box', { css: { desktop: { width: '960px' } } });
    const spec: SpaceSpec = {
      name: 'Shop',
      permanentUrl: 'shop',
      classes: { box },
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          body: [
            container({ id: 'a', class: box, children: [text('A', { id: 'a-text' })] }),
            container({ id: 'b', class: box, children: [text('B', { id: 'b-text' })] })
          ]
        }
      ]
    };

    const found = offered(spec);

    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('class "box" width 960px (2 elements)');
  });
});
