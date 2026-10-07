import { describe, expect, it } from 'vitest';

import { matchElements } from './where';

import type { WrittenElement } from '@plitzi/sdk-authoring';

const element = (elementId: string, classes: string[], content?: string): WrittenElement => ({
  elementId,
  type: 'text',
  rootId: 'home',
  classes,
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

  it('finds nothing for what nothing is', () => {
    expect(matchElements(elements, 'pricing')).toBeUndefined();
  });
});
