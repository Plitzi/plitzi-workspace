import { describe, expect, it } from 'vitest';

import { compareTexts } from './texts';

import type { PageText } from './texts';

const text = (words: string, overrides: Partial<PageText> = {}): PageText => ({
  text: words,
  tag: 'p',
  x: 0,
  y: 0,
  width: 300,
  height: 24,
  fontSize: 16,
  fontWeight: '400',
  lineHeight: '24px',
  letterSpacing: 'normal',
  fontFamily: 'inter',
  color: 'rgb(0, 0, 0)',
  background: 'rgba(0, 0, 0, 0)',
  padding: '0px',
  radius: '0px',
  ...overrides
});

describe('compareTexts', () => {
  it('says what a text does differently on the other page, measured', () => {
    const { differ, same } = compareTexts(
      [text('Learn CSS', { tag: 'h1', y: 100, fontSize: 68, fontWeight: '800' }), text('Start', { y: 300 })],
      [text('Learn CSS', { tag: 'h1', y: 119, fontSize: 60, fontWeight: '700' }), text('Start', { y: 300 })]
    );

    expect(same).toBe(1);
    expect(differ).toEqual([
      {
        tag: 'h1',
        text: 'Learn CSS',
        y: 100,
        differences: ['font-size 68px → 60px', 'font-weight 800 → 700', 'y +19px']
      }
    ]);
  });

  it('takes off how far the section around a text moved, and pairs repeated words in order', () => {
    const { differ, same } = compareTexts(
      [text('Buy', { y: 500 }), text('Buy', { y: 900, padding: '8px 16px' })],
      [text('Buy', { y: 900 }), text('Buy', { y: 1300, padding: '6px 12px' })],
      y => (y >= 400 ? 400 : 0)
    );

    expect(same).toBe(1);
    expect(differ.map(entry => entry.differences)).toEqual([['padding 8px 16px → 6px 12px']]);
  });

  it('leaves half a pixel of type alone, and lists the words only one page has', () => {
    const comparison = compareTexts(
      [text('Docs', { fontSize: 16.2, lineHeight: '24.3px' }), text('Only here')],
      [text('Docs'), text('Only there')]
    );

    expect(comparison).toEqual({ same: 1, differ: [], onlyHere: ['Only here'], onlyThere: ['Only there'] });
  });
});
