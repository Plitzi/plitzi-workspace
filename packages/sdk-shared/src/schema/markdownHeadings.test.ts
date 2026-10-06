import { describe, expect, it } from 'vitest';

import { anchorOf, isAnchor, uniqueAnchor } from './anchor';
import { headingText, markdownHeadings } from './markdownHeadings';

describe('anchorOf', () => {
  it('reads words as an anchor', () => {
    expect(anchorOf('Server-resolved data')).toBe('server-resolved-data');
    expect(anchorOf('What is `authorSpace`?')).toBe('what-is-authorspace');
    expect(anchorOf('Café & crème')).toBe('cafe-creme');
  });

  it('always answers a well-formed anchor', () => {
    for (const text of ['1. Install', '¿Qué?', '', '---', 'Ünïcödé 2026']) {
      expect(isAnchor(anchorOf(text)), text).toBe(true);
    }
  });
});

describe('uniqueAnchor', () => {
  it('numbers the same words the second time', () => {
    const taken = new Set<string>();

    expect([uniqueAnchor('FAQ', taken), uniqueAnchor('FAQ', taken), uniqueAnchor('faq', taken)]).toEqual([
      'faq',
      'faq-2',
      'faq-3'
    ]);
  });
});

describe('headingText', () => {
  it('takes away the inline Markdown a reader does not see', () => {
    expect(headingText('The `link` element, **bold** and *soft*')).toBe('The link element, bold and soft');
    expect(headingText('[Server actions](./actions.md) and ![logo](logo.png)')).toBe('Server actions and');
    expect(headingText('snake_case stays, _this_ goes')).toBe('snake_case stays, this goes');
    expect(headingText('An escaped \\* star')).toBe('An escaped * star');
  });
});

describe('markdownHeadings', () => {
  it('lists the headings in order, with their anchors, skipping fenced code', () => {
    const source = [
      '# Title',
      'Text.',
      '## One import ##',
      '```ts',
      '## not a heading',
      '```',
      '### `authorSpace`',
      '## One import',
      '####### seven is a paragraph'
    ].join('\n');

    expect(markdownHeadings(source)).toEqual([
      { level: 1, text: 'Title', anchor: 'title' },
      { level: 2, text: 'One import', anchor: 'one-import' },
      { level: 3, text: 'authorSpace', anchor: 'authorspace' },
      { level: 2, text: 'One import', anchor: 'one-import-2' }
    ]);
  });
});
