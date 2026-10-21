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

describe('compareDecorations', () => {
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
        extra: []
      }
    ]);
  });
});
