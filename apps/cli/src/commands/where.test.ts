import { describe, expect, it } from 'vitest';

import { byCall, callsThrough, matchElements } from './where';

import type { WrittenElement } from '@plitzi/sdk-authoring';

const element = (elementId: string, classes: string[], content?: string): WrittenElement => ({
  elementId,
  type: 'text',
  rootId: 'home',
  classes,
  templates: [],
  words: content === undefined ? [] : [content],
  through: [],
  bound: [],
  attributes: {},
  ...(content === undefined ? {} : { content })
});

const elements = [
  element('hero-title', ['hero-title'], 'Ship it'),
  element('nav-home', ['nav-link'], 'Home'),
  element('nav-docs', ['nav-link'], 'Docs'),
  element('cta', [], 'Ship it today')
];

describe('what plitzi where finds', () => {
  it('takes an id first, then a class, then words', () => {
    expect(matchElements(elements, 'hero-title')).toMatchObject({ by: 'id', found: [{ elementId: 'hero-title' }] });
    expect(matchElements(elements, 'nav-link')?.found.map(found => found.elementId)).toEqual(['nav-home', 'nav-docs']);
    expect(matchElements(elements, 'ship it')).toMatchObject({ by: 'text' });
    expect(matchElements(elements, 'ship it')?.found).toHaveLength(2);
  });

  // The code names a class by the variable that holds it; the space by the class's own name.
  it('finds a class by the name of the variable that holds it', () => {
    expect(matchElements(elements, 'navLink')).toMatchObject({ by: 'class' });
  });

  // A query that means two things is answered as the first and says the other, with its count — never as one silently.
  it('says the other readings a query matched, and reads it one way when asked', () => {
    const withCta = [...elements, element('cta-2', [], 'cta')];

    expect(matchElements(withCta, 'cta')).toMatchObject({ by: 'id', also: [{ by: 'text', count: 1 }] });
    expect(matchElements(withCta, 'cta', 'text')).toMatchObject({ by: 'text', also: [] });
    expect(matchElements(withCta, 'cta', 'class')).toBeUndefined();
  });

  // What a visitor reads is searched for by those words, whether the element holds them or a template writes them.
  it('finds words a binding’s template writes', () => {
    const quoted = (words: string): string => `'${words}'`;
    const template = `{{ user ? ${quoted('Welcome back')} : ${quoted('Reading as a guest')} }}`;
    const greeting = { ...element('greeting', []), templates: [template], words: [template] };

    expect(matchElements([greeting], 'reading as a guest')).toMatchObject({
      by: 'text',
      found: [{ elementId: 'greeting' }]
    });
  });

  // `pageHead('about-head', 'About us')` places a component: the words are the instance's, the title only reads them.
  it('finds words an instance hands its component', () => {
    const instance = {
      ...element('about-head', []),
      type: 'reference',
      attributes: { referenceType: 'component', referenceId: 'page-head', title: 'About us' },
      words: ['About us']
    };

    expect(matchElements([instance], 'about us')).toMatchObject({ by: 'text', found: [{ elementId: 'about-head' }] });
    expect(matchElements([instance], 'page-head')).toBeUndefined();
  });

  it('finds nothing for what nothing is', () => {
    expect(matchElements(elements, 'pricing')).toBeUndefined();
  });

  // A helper called twice writes two elements from one call: an edit there changes both, and that is said.
  it('knows the elements one call writes', () => {
    const at = { file: 'src/space/brand.ts', line: 30, column: 3 };
    const calls = byCall([
      { ...element('site-brand', []), position: at },
      { ...element('site-footer-brand', []), position: at },
      { ...element('hero-title', []), position: { ...at, line: 12 } }
    ]);

    expect(calls.get('src/space/brand.ts:30:3')?.map(found => found.elementId)).toEqual([
      'site-brand',
      'site-footer-brand'
    ]);
    expect(calls.get('src/space/brand.ts:12:3')?.map(found => found.elementId)).toEqual(['hero-title']);
  });

  // `pageHead(…)` writes every page's title from one call; what tells them apart is where each page calls it.
  it('tells the calls that lead to one element alone from those it shares', () => {
    const at = (file: string, line: number) => ({ file, line, column: 5 });
    const written = at('src/space/parts/pageHead.ts', 32);
    const about = {
      ...element('about-head-title', []),
      position: written,
      through: [at('src/space/pages/about.ts', 17), at('src/space/index.ts', 3)]
    };
    const writers = {
      ...element('writers-head-title', []),
      position: written,
      through: [at('src/space/pages/writers.ts', 72), at('src/space/index.ts', 3)]
    };

    expect(callsThrough(about, [writers])).toEqual([
      { at: 'src/space/pages/about.ts:17', position: about.through[0] },
      { at: 'src/space/index.ts:3', position: about.through[1], sharedWith: ['writers-head-title'] }
    ]);
  });
});
