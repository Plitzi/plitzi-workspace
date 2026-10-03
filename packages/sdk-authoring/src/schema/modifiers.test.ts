import { describe, expect, it } from 'vitest';

import { compareSpaces } from '../decompile/compareSpaces';
import { specFromSpace } from '../decompile/specFromSpace';
import { authorSpace, container, image, styles } from '../index';

import type { ElementSpec, SpaceSpec } from './types';

const cover = styles('cover', { css: { 'object-fit': 'cover', opacity: '1' } });

const space = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Modifiers',
  permanentUrl: 'modifiers',
  pages: [{ id: 'home', name: 'Home', slug: '', body }]
});

describe('rules on top of a class', () => {
  it('become a class named after the element, worn after the shared one', () => {
    const { schema, style } = authorSpace(
      space([image({ id: 'hero-bg', src: '/a.png', class: [cover, { opacity: '0.25' }] })])
    );

    expect(schema.flat['hero-bg'].definition.styleSelectors.base).toBe('cover hero-bg--own');
    expect(style.platform.desktop['hero-bg--own'].attributes.base.default).toEqual({ opacity: '0.25' });
  });

  it('win over the class they sit on: declared after it, at the same specificity', () => {
    const { style } = authorSpace(
      space([image({ id: 'hero-bg', src: '/a.png', class: [cover, { opacity: '0.25' }] })])
    );

    expect(style.cache.indexOf('.hero-bg--own')).toBeGreaterThan(style.cache.indexOf('.cover'));
  });

  it('take states and breakpoints the way styles() does', () => {
    const { style } = authorSpace(
      space([
        container({
          id: 'badge',
          class: [
            cover,
            {
              css: { desktop: { 'font-size': '14px' }, mobile: { 'font-size': '12px' } },
              states: { hover: { opacity: '0.8' } }
            }
          ]
        })
      ])
    );

    expect(style.platform.mobile['badge--own'].attributes.base.default).toEqual({ 'font-size': '12px' });
    expect(style.platform.desktop['badge--own'].attributes.base.states?.hover).toEqual({ opacity: '0.8' });
  });

  it('need the element’s id, which names them, and come one set at a time', () => {
    expect(() => authorSpace(space([container({ class: [cover, { opacity: '0.5' }] })]))).toThrow(
      /rules of its own in its class list but no `id`/
    );
    expect(() =>
      authorSpace(space([container({ id: 'two', class: [cover, { opacity: '0.5' }, { margin: '0' }] })]))
    ).toThrow(/2 sets of rules in its class list/);
  });

  it('are what a class worn with css of its own is pointed to', () => {
    expect(() => authorSpace(space([container({ id: 'both', class: cover, css: { margin: '0' } })]))).toThrow(
      /put the rules on top of the class instead — `class: \[cover, \{ … \}\]`/
    );
  });

  it('come back from the document as the object they were written as', () => {
    const authored = authorSpace(space([image({ id: 'hero-bg', src: '/a.png', class: [cover, { opacity: '0.25' }] })]));
    const { spec, corrections } = specFromSpace(authored);
    const [hero] = spec.pages[0].body;

    expect(corrections).toEqual([]);
    expect(hero.class).toEqual(['cover', { opacity: '0.25' }]);
    expect(compareSpaces(authored, authorSpace(spec))).toEqual([]);
  });
});
