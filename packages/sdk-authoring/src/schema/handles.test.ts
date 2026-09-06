import { describe, expect, it } from 'vitest';

import { authorSpace } from './space';

import type { SpaceSpec } from './types';

/**
 * The handles are a contract with every suite written against a space, so what is asserted here is what those suites
 * are allowed to rely on: the id an author wrote is the id they get back, a derived one is discoverable rather than
 * guessable, and a name that does not exist fails at author time instead of matching nothing on screen.
 */

const spec: SpaceSpec = {
  name: 'Handles',
  permanentUrl: 'handles',
  pages: [
    {
      name: 'Home',
      slug: '',
      body: [
        {
          type: 'container',
          id: 'hero',
          children: [
            { type: 'heading', id: 'hero-title', attributes: { content: 'Hi' } },
            { type: 'text', attributes: { content: 'Unnamed' } }
          ]
        }
      ]
    },
    { name: 'Pricing', slug: 'pricing', id: 'pricing', body: [{ type: 'heading', id: 'pricing-title' }] }
  ]
};

describe('schema/handles', () => {
  const { handles } = authorSpace(spec);

  it('hands back the name the author wrote, and the selector the renderer publishes', () => {
    expect(handles.element('hero-title')).toMatchObject({
      id: 'hero-title',
      type: 'heading',
      selector: '[data-plitzi-el="hero-title"]'
    });
  });

  /**
   * The one thing a generic suite can hold any space to: what somebody bothered to name is what somebody meant to
   * point at, so it had better be on the page.
   */
  it('says which ids the author wrote and which were derived', () => {
    expect(handles.element('hero-title').named).toBe(true);
    expect(handles.page('pricing').named).toBe(true);
    expect(handles.page('').named).toBe(false);
    expect(
      Object.values(handles.page('').elements)
        .filter(handle => handle.named)
        .map(handle => handle.id)
    ).toEqual(['hero', 'hero-title']);
  });

  it('covers elements the author did not name, under the id authoring minted', () => {
    const derived = Object.values(handles.page('').elements).filter(handle => handle.type === 'text');

    expect(derived).toHaveLength(1);
    expect(handles.element(derived[0].id).selector).toBe(`[data-plitzi-el="${derived[0].id}"]`);
  });

  it('files every element under the page it renders on', () => {
    expect(Object.keys(handles.page('pricing').elements)).toEqual(['pricing-title']);
    expect(handles.element('pricing-title').pageId).toBe('pricing');
  });

  it('gives a page the route a test navigates to', () => {
    expect(handles.page('').path).toBe('/');
    expect(handles.page('pricing').path).toBe('/pricing');
  });

  /** A page is reachable by either name: a spec knows its slug, a flow that targets it knows its id. */
  it('finds a page by id or by slug', () => {
    expect(handles.page('pricing')).toBe(handles.pages.pricing);
  });

  /**
   * The whole point of authoring the handles rather than writing selectors by hand: a typo is a failed build, not a
   * suite that reports the element is missing from the page it is sitting on.
   */
  it('refuses a name that does not exist, and suggests the one that does', () => {
    expect(() => handles.element('hero-titel')).toThrow('did you mean "hero-title"');
    expect(() => handles.page('pricng')).toThrow('did you mean "pricing"');
  });

  it('escapes an id before it reaches a selector', () => {
    expect(handles.element('hero').selector).not.toContain('\\');
  });
});
