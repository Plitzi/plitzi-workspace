import { describe, expect, it } from 'vitest';

import { unusedDeclarations } from './index';
import { component, container, custom, defineElement, heading, text } from '../../elements';
import { authorSpace as authorPublic } from '../../index';
import { authorSpace } from '../space';
import { codesOf, page, space } from './tests/advice';

import type { SpaceSpec } from '../types';

describe('suggestions', () => {
  describe('what a space declares and never uses, or says twice', () => {
    const palette = {
      color: {
        ink: { light: '#111111', dark: '#eeeeee', default: '#111111' },
        text: { light: '#111', dark: '#EEEEEE', default: '#111' },
        accent: { light: '#ff5500', dark: '#ff7733', default: '#ff5500' },
        spare: { light: '#00ff00', dark: '#00aa00', default: '#00ff00' }
      }
    };
    const declared = (extra: Partial<SpaceSpec> = {}) =>
      authorSpace(
        space(
          [
            page('home', [
              heading({ content: 'Hello', class: 'title' }),
              container({ class: 'panel', children: [text({ content: 'Inside', class: 'note' })] })
            ])
          ],
          {
            variables: palette,
            classes: {
              title: { color: 'var(--ink)' },
              panel: {
                css: { backgroundColor: '#FF5500', borderColor: 'var(--ink)' },
                ancestors: { shell: { states: { hover: { color: 'var(--text)' } } } }
              },
              note: {},
              shell: {},
              orphan: { color: 'red' }
            },
            ...extra
          }
        )
      ).suggestions;
    const find = (code: string, extra?: Partial<SpaceSpec>) => declared(extra).find(item => item.code === code);

    it('names a class nothing wears or names, and not one another class names in its ancestors', () => {
      const unused = find('unused-class');

      expect(unused?.message).toContain('`orphan`');
      expect(unused?.message).not.toContain('`shell`');
      expect(unused?.message).not.toContain('`note`');
    });

    it('names a token nothing reads, and not one a class or another class’s ancestors read', () => {
      const unused = find('unused-token');

      expect(unused?.message).toContain('`spare`');
      expect(unused?.message).not.toContain('`ink`');
      expect(unused?.message).not.toContain('`text`');
    });

    it('names a colour written out where a token of the scheme holds it, in whatever case — not one the same in both', () => {
      expect(find('literal-colour')?.message).toContain('`--accent` in `panel`');
      expect(
        find('literal-colour', {
          classes: { title: {}, note: {}, shell: {}, orphan: {}, panel: { backgroundColor: '#ff5500', color: '#111' } }
        })
      ).toBeUndefined();
      expect(
        find('literal-colour', {
          variables: { color: { ...palette.color, accent: { light: '#ff5500', dark: '#ff5500', default: '#ff5500' } } }
        })
      ).toBeUndefined();
    });

    it('counts a token a class reads through its own variables, as the builder writes them', () => {
      const { schema, style } = authorSpace(
        space([page('home', [heading({ content: 'Hello', class: 'title' })])], {
          variables: palette,
          classes: { title: { color: 'var(--ink)' } }
        })
      );
      const title = style.platform.desktop.title;
      const withRing = {
        ...style,
        platform: {
          ...style.platform,
          desktop: { ...style.platform.desktop, title: { ...title, variables: { custom: { ring: 'var(--spare)' } } } }
        }
      };

      expect(unusedDeclarations(schema, style).tokens).toContain('spare');
      expect(unusedDeclarations(schema, withRing).tokens).not.toContain('spare');
      // A plugin's own stylesheet reads it: the space's pages load it, and the colour is in use.
      expect(unusedDeclarations(schema, style, ['.sticky { background: var(--spare); }']).tokens).not.toContain(
        'spare'
      );
    });

    it('names a component no page places, and says what removing it saves', () => {
      const unused = find('unused-component', {
        components: [
          { id: 'Badge', root: container({ children: [text({ content: 'New' })] }) },
          { id: 'Used', root: container({ children: [text({ content: 'Here' })] }) }
        ],
        pages: [page('home', [component('Used')])]
      });

      expect(unused?.message).toContain('`Badge`');
      expect(unused?.message).not.toContain('`Used`');
      expect(unused?.saves).toBe(2);
    });
  });
});
/** A plugin is placed from its declaration: a `custom` host naming one the space was handed is pointed there. */
describe('plugin hosts', () => {
  const seats = {
    type: 'seatPicker',
    triggers: {},
    callbacks: {},
    content: { attributes: { start: 0 }, definition: { label: 'Seat picker' } }
  };

  it('offers the declaration for a `custom` host of a declared plugin', () => {
    const spec = space([page('home', [custom({ id: 'seats', renderType: 'seatPicker' })])]);
    const suggestion = authorPublic(spec, { plugins: [seats] }).suggestions.find(
      entry => entry.code === 'plugin-custom-host'
    );

    expect(suggestion?.elementIds).toEqual(['seats']);
    expect(suggestion?.message).toContain('defineElement(declaration)');
    expect(suggestion?.saves).toBe(0);
  });

  it('leaves the plugin placed by its own type, and a component with no declaration', () => {
    const spec = space([
      page('home', [defineElement(seats)({ id: 'seats' }), custom({ id: 'chart', renderType: 'trafficChart' })])
    ]);
    const codes = authorPublic(spec, { plugins: [seats] }).suggestions.map(entry => entry.code);

    expect(codes).not.toContain('plugin-custom-host');
  });
});
/** A colour named once on the page is what every element reads: one restated on a type says nothing. */
describe('element colours', () => {
  const coloured = (elements: SpaceSpec['elements']) =>
    space([page('home', [heading({ content: 'Hi' })])], { elements });

  it('offers to drop a type’s colour that is `inherit`, or the very colour the page has', () => {
    const suggestion = authorSpace(
      coloured({
        page: { base: { color: 'var(--ink)' } },
        heading: { base: { color: 'var(--ink)' } },
        text: { base: { color: 'inherit' } },
        paragraph: { base: { color: 'var(--muted)' } }
      })
    ).suggestions.find(entry => entry.code === 'element-color-inherited');

    expect(suggestion?.subjects).toEqual(['text', 'heading']);
    expect(suggestion?.message).toContain('`elements.page`');
  });

  it('leaves a type that chooses a colour of its own, or a page with none', () => {
    const codes = codesOf(
      coloured({ heading: { base: { color: 'var(--ink)' } }, paragraph: { base: { color: 'var(--muted)' } } })
    );

    expect(codes).not.toContain('element-color-inherited');
  });
});
