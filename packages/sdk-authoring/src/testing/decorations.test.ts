// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { compareDecorations, pageDecorations } from './decorations';

import type { PageDecoration } from './decorations';
import type { PictureRegion } from './pictures';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const layer = (kind: PageDecoration['kind'], detail: string, y = 100): PageDecoration => ({
  kind,
  detail,
  on: 'element',
  element: 'div.card',
  css: `css of ${detail}`,
  x: 100,
  y,
  width: 200,
  height: 100
});

const region = (name: string, y: number, height: number): PictureRegion => ({ name, x: 0, y, width: 1440, height });

describe('pageDecorations', () => {
  it('reads the gradients, glows and background images an element is dressed in — never a shadow that only lifts it', () => {
    document.body.innerHTML = [
      '<section style="background-image: radial-gradient(circle, rgba(199, 168, 107, 0.2), transparent)"></section>',
      '<div style="box-shadow: 0 0 60px rgba(199, 168, 107, 0.25)"></div>',
      '<div style="box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3)"></div>',
      '<footer style="background-image: url(/brand/footer-x.webp)"></footer>'
    ].join('');
    // jsdom lays nothing out: every element is given a box, so each counts as drawn.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 100, height: 20 }));

    expect(pageDecorations(10).map(each => [each.kind, each.detail])).toEqual([
      ['gradient', 'radial-gradient rgba(199, 168, 107, 0.2)'],
      ['glow', 'box-shadow 60px rgba(199, 168, 107, 0.25)'],
      ['image', 'background footer-x.webp']
    ]);
  });
});

describe('pageDecorations, as a person reads them', () => {
  it('names an image written in the style by its type, and an oklab colour as rgb', () => {
    document.body.innerHTML = [
      `<footer style="background-image: url(&quot;data:image/svg+xml,%3Csvg filter='url(%23n)'%3E%3C/svg%3E&quot;)"></footer>`,
      '<div style="box-shadow: 0 0 60px oklab(0.745428 0.00989413 0.0865543 / 0.45)"></div>'
    ].join('');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 100, height: 20 }));

    expect(pageDecorations(10).map(each => each.detail)).toEqual([
      'background image/svg+xml in the style',
      'box-shadow 60px rgba(199, 168, 107, 0.45)'
    ]);
  });
});

describe('pageDecorations, of what is drawn', () => {
  it('reads no ornament of a pseudo-element with no size — a hover underline at rest', () => {
    document.body.innerHTML = '<a>Link</a>';
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 100, height: 20 }));
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = real(element);
      if (pseudo !== '::after') {
        return style;
      }

      const drawn: Record<string, unknown> = {
        content: '""',
        display: 'block',
        width: '0px',
        height: '1px',
        backgroundColor: 'rgb(169, 112, 255)',
        backgroundImage: 'none',
        boxShadow: 'none',
        textShadow: 'none',
        filter: 'none',
        borderTopColor: 'rgb(0, 0, 0)',
        getPropertyValue: () => '0px'
      };

      return new Proxy(style, {
        get: (target, key): unknown => (typeof key === 'string' && key in drawn ? drawn[key] : Reflect.get(target, key))
      });
    });

    expect(pageDecorations(10).filter(each => each.kind === 'ornament')).toEqual([]);
  });
});

describe('pageDecorations, of filters that do something', () => {
  it('reads no blur(0px): an arrival at rest is no dress', () => {
    document.body.innerHTML = '<div style="filter: blur(0px)"></div><div style="filter: blur(20px)"></div>';
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 100, height: 20 }));

    expect(pageDecorations(10).map(each => each.detail)).toEqual(['filter blur(20px)']);
  });
});

// velada-dress: the footer's photo, a decorative <picture>, was nobody's dress and went; and the fighters' spotlight,
// the original's behind each cut-out, was painted over the faces — both passed every --dress check.
describe('pageDecorations, of pictures', () => {
  it('reads a decorative picture laid behind a section as its background — never a picture of the page’s own', () => {
    document.body.innerHTML = [
      '<footer><picture aria-hidden="true" style="position: absolute"><img alt="" src="https://cdn.example.com/hero-bg/background-2048.webp?v=2"></picture></footer>',
      '<div><img alt="IlloJuan" src="https://cdn.example.com/illojuan.webp" style="position: absolute"></div>',
      '<p><img alt="" src="https://cdn.example.com/inline.webp"></p>',
      // In the flow, its title laid over it: the same backdrop, drawn another way.
      '<section><img alt="" src="https://cdn.example.com/banner.webp"><div style="position: absolute">Lo mejor</div></section>'
    ].join('');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 100, height: 20 }));

    expect(pageDecorations(10).map(each => [each.kind, each.detail])).toEqual([
      ['image', 'backdrop background-2048.webp'],
      ['image', 'backdrop banner.webp']
    ]);
  });

  it('says whether a light over a photo is painted over it or under it, as CSS stacks them', () => {
    const side = (spot: number, photo: number) =>
      `<div style="display: grid"><img alt="IlloJuan" src="a.webp" style="position: absolute; z-index: ${String(photo)}"><span style="position: absolute; z-index: ${String(spot)}; background-image: radial-gradient(circle, rgba(199, 168, 107, 0.52), transparent)"></span></div>`;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width: 100, height: 20 }));

    document.body.innerHTML = side(0, 1);
    expect(pageDecorations(10)).toEqual([expect.objectContaining({ kind: 'gradient', stack: 'under' })]);
    document.body.innerHTML = side(1, 0);
    expect(pageDecorations(10)).toEqual([expect.objectContaining({ kind: 'gradient', stack: 'over' })]);
  });
});

describe('compareDecorations', () => {
  // velada-polish: one VS medal's shadow gone, and the cards' text-shadows — all still there — read as lost.
  it('names only the details there are fewer of, each by how many', () => {
    const regions = [region('section#fights-page', 0, 1000)];
    const names = Array.from({ length: 20 }, () => layer('glow', 'text-shadow 12px rgba(0, 0, 0, 0.9)'));
    const medal = layer('glow', 'box-shadow 14px rgba(255, 255, 255, 0.35)');
    const compared = compareDecorations(
      { layers: [...names, medal], regions },
      { layers: [...names, medal, medal, medal], regions }
    );

    expect(compared).toMatchObject([{ missing: ['box-shadow 14px rgba(255, 255, 255, 0.35) ×2'], extra: [] }]);
  });

  it('says, section by section, the dress the other page has and this one lacks — and what this one adds', () => {
    const regions = [region('header#site-header', 0, 80), region('section#artist-page', 80, 900)];
    const compared = compareDecorations(
      { layers: [layer('ornament', '::before border rgb(199, 168, 107)', -40)], regions },
      {
        layers: [
          layer('gradient', 'radial-gradient rgba(199, 168, 107, 0.2)'),
          layer('gradient', 'radial-gradient rgba(199, 168, 107, 0.2)', 300),
          layer('glow', 'box-shadow 60px rgba(199, 168, 107, 0.25)'),
          layer('ornament', '::before border rgb(199, 168, 107)', -40)
        ],
        regions
      }
    );

    // The header has the same dress on both: not said.
    expect(compared).toEqual([
      {
        section: 'section#artist-page',
        here: {},
        there: { gradient: 2, glow: 1 },
        missing: ['radial-gradient rgba(199, 168, 107, 0.2) ×2', 'box-shadow 60px rgba(199, 168, 107, 0.25)'],
        extra: [],
        absent: [
          'radial-gradient (radial-gradient rgba(199, 168, 107, 0.2))',
          'box-shadow (box-shadow 60px rgba(199, 168, 107, 0.25))'
        ],
        absentLayers: [
          expect.objectContaining({ css: 'css of radial-gradient rgba(199, 168, 107, 0.2)', element: 'div.card' }),
          expect.objectContaining({ y: 300 }),
          expect.objectContaining({ css: 'css of box-shadow 60px rgba(199, 168, 107, 0.25)' })
        ]
      }
    ]);
  });

  // la-velada's artist page had a gold radial gradient — on one card — where the original's lit the whole page.
  it('tells a light across the section from the same gradient on one card in it', () => {
    const regions = [region('section#artist-page', 0, 1000)];
    const card = layer('gradient', 'radial-gradient rgba(199, 168, 107, 0.18)');
    const light = { ...layer('gradient', 'radial-gradient rgba(199, 168, 107, 0.16)'), x: 0, width: 1440, height: 900 };

    expect(compareDecorations({ layers: [card], regions }, { layers: [card, light], regions })[0]?.absent).toEqual([
      'radial-gradient across the section (radial-gradient rgba(199, 168, 107, 0.16))'
    ]);
  });

  it('tells a light behind a photo from the same light over it', () => {
    const regions = [region('section#predictions-page', 0, 1000)];
    const spot = layer('gradient', 'radial-gradient rgba(199, 168, 107, 0.52)');

    expect(
      compareDecorations(
        { layers: [{ ...spot, stack: 'over' }], regions },
        { layers: [{ ...spot, stack: 'under' }], regions }
      )[0]?.absent
    ).toEqual(['radial-gradient under a picture (radial-gradient rgba(199, 168, 107, 0.52))']);
  });
});
