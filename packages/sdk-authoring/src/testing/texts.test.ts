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

  // la-velada's copy wrote "Logotipo" where its original draws "LOGOTIPO": one text in other capitals, not two.
  it('pairs the same words in other capitals, and says their case differs', () => {
    expect(compareTexts([text('Logotipo')], [text('LOGOTIPO')])).toMatchObject({
      same: 0,
      differ: [{ text: 'Logotipo', differences: ['case Logotipo → LOGOTIPO'] }],
      onlyHere: [],
      onlyThere: []
    });
  });

  it('leaves half a pixel of type alone, and lists the words only one page has', () => {
    const comparison = compareTexts(
      [text('Docs', { fontSize: 16.2, lineHeight: '24.3px' }), text('Only here')],
      [text('Docs'), text('Only there')]
    );

    expect(comparison).toEqual({ same: 1, differ: [], onlyHere: ['Only here'], onlyThere: ['Only there'] });
  });

  // design-2: "✓USA EL LOGO…" there and "Usa el logo…" here landed in onlyHere and onlyThere — never compared.
  it('pairs the same words with a mark beside them, and says how they are written', () => {
    const { differ, onlyHere, onlyThere } = compareTexts(
      [text('Usa el logo sobre fondo oscuro', { y: 100 }), text('Ganador', { y: 200 })],
      [text('✓USA EL LOGO SOBRE FONDO OSCURO', { y: 100 }), text('★ GANADOR', { y: 200 })]
    );

    expect([onlyHere, onlyThere]).toEqual([[], []]);
    expect(differ.map(each => each.differences[0])).toEqual([
      'written Usa el logo sobre fondo oscuro → ✓USA EL LOGO SOBRE FONDO OSCURO',
      'written Ganador → ★ GANADOR'
    ]);
  });

  // lx-product: our "Agotado" button was compared with the original's "Agotado" stock label, above its button.
  it('pairs the same words with the same kind of element first: a button with a button, a label with a label', () => {
    const button = (y: number) => text('Agotado', { tag: 'button', y, width: 414, height: 44 });
    const label = (y: number) => text('Agotado', { tag: 'span', y, width: 65, height: 20 });
    // Ours draws the button first; the original, its stock label first: in order alone they cross.
    const { differ, same } = compareTexts([button(300), label(360)], [label(300), button(360)], () => 0);

    expect(differ.flatMap(each => each.differences)).toEqual(['y +60px', 'y -60px']);
    expect(same).toBe(0);
  });
});
