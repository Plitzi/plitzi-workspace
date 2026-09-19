import { describe, expect, it } from 'vitest';

import { styles } from '../style';
import { authorSpace } from './index';

import type { SpaceSpec } from './index';
import type { StyleItem } from '@plitzi/sdk-shared';

const card = styles('card', { padding: '24px', 'border-radius': '12px' });

const spaceWith = (body: SpaceSpec['pages'][number]['body'], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Styled',
  permanentUrl: 'styled',
  pages: [{ name: 'Home', slug: '', body }],
  ...extra
});

const classesOf = (spec: SpaceSpec): Record<string, StyleItem> =>
  Object.fromEntries(
    Object.entries(authorSpace(spec).style.platform.desktop).filter(([, item]) => item.type === 'class')
  );

describe('a space that names style declarations', () => {
  it('writes one selector however many elements name it', () => {
    const classes = classesOf(
      spaceWith([
        { type: 'container', class: card },
        { type: 'container', class: card },
        { type: 'container', class: card }
      ])
    );

    expect(Object.keys(classes)).toEqual(['card']);
    expect(classes.card.attributes.base.default).toMatchObject({
      'padding-top': '24px',
      'border-top-left-radius': '12px'
    });
  });

  /**
   * The idiom this replaces, and the reason it is worth replacing: sharing a rule set through a TypeScript const
   * spread into each element's `css` shares the SOURCE and duplicates the DOCUMENT — one selector per element,
   * so re-theming the card in the builder re-themes one card.
   */
  it('writes what the same rules spread inline would write once instead of once per element', () => {
    const rules = { padding: '24px' };
    const inline = classesOf(
      spaceWith([
        { type: 'container', css: rules },
        { type: 'container', css: rules },
        { type: 'container', css: rules }
      ])
    );

    expect(Object.keys(inline)).toHaveLength(3);
    expect(Object.keys(classesOf(spaceWith([{ type: 'container', class: styles('card', rules) }])))).toHaveLength(1);
  });

  it('produces the same document as declaring the class at the top of the space', () => {
    const declared = authorSpace(
      spaceWith([{ type: 'container', class: 'card' }], {
        classes: { card: { padding: '24px', 'border-radius': '12px' } }
      })
    );
    const colocated = authorSpace(spaceWith([{ type: 'container', class: card }]));

    expect(colocated.style).toEqual(declared.style);
    expect(colocated.schema).toEqual(declared.schema);
  });

  it('collects a declaration named only by a slot', () => {
    const field = styles('field', { width: '100%' });
    const classes = classesOf(spaceWith([{ type: 'formControl', slots: { input: field } }]));

    expect(Object.keys(classes)).toEqual(['field']);
  });

  it('collects a declaration named by a page', () => {
    const shell = styles('shell', { 'min-height': '100vh' });
    const classes = classesOf({
      name: 'Styled',
      permanentUrl: 'styled',
      pages: [{ name: 'Home', slug: '', class: shell, body: [] }]
    });

    expect(Object.keys(classes)).toEqual(['shell']);
  });

  it('writes nothing for a declaration the tree never names', () => {
    styles('unused', { color: 'red' });

    expect(Object.keys(classesOf(spaceWith([{ type: 'container' }])))).toEqual([]);
  });

  it('accepts the same name twice when the rules agree, whatever order they were written in', () => {
    const one = styles('badge', { padding: '4px', color: 'red' });
    const other = styles('badge', { color: 'red', padding: '4px' });

    expect(
      Object.keys(
        classesOf(
          spaceWith([
            { type: 'container', class: one },
            { type: 'container', class: other }
          ])
        )
      )
    ).toEqual(['badge']);
  });

  /**
   * Declarations are reached from wherever they were written, so two files can name one class without either
   * knowing about the other. Letting the second one win would make the rule depend on traversal order.
   */
  it('refuses one name declared with two different rule sets', () => {
    expect(() =>
      authorSpace(
        spaceWith([
          { type: 'container', class: styles('badge', { padding: '4px' }) },
          { type: 'container', class: styles('badge', { padding: '8px' }) }
        ])
      )
    ).toThrow(/class "badge" with different rules/);
  });

  it('refuses a declaration that disagrees with the space-wide class of the same name', () => {
    expect(() =>
      authorSpace(spaceWith([{ type: 'container', class: card }], { classes: { card: { padding: '8px' } } }))
    ).toThrow(/class "card" with different rules/);
  });

  it('still refuses an element asking for a declaration and rules of its own', () => {
    expect(() => authorSpace(spaceWith([{ type: 'container', class: card, css: { color: 'red' } }]))).toThrow(
      /one base selector/
    );
  });

  it('suggests a co-located declaration when a plain name matches nothing', () => {
    expect(() =>
      authorSpace(
        spaceWith([
          { type: 'container', class: card },
          { type: 'container', class: 'crad' }
        ])
      )
    ).toThrow(/"crad".*did you mean "card"/);
  });
});

describe('an element that wears several classes', () => {
  const panel = styles('panel', { padding: '12px' });
  const wide = styles('wide', { width: '100%' });
  const selectorOf = (spec: SpaceSpec, id: string, slot = 'base'): string | undefined =>
    authorSpace(spec).schema.flat[id].definition.styleSelectors[slot];

  it('joins them into its one selector, in the order written, from declarations and names alike', () => {
    const spec = spaceWith([{ type: 'container', id: 'box', class: [panel, 'accent', wide] }], {
      classes: { accent: { color: 'red' } }
    });

    expect(selectorOf(spec, 'box')).toBe('panel accent wide');
    expect(Object.keys(classesOf(spec))).toEqual(expect.arrayContaining(['panel', 'accent', 'wide']));
  });

  it('refuses a list naming a class the space does not declare, by that name', () => {
    expect(() => authorSpace(spaceWith([{ type: 'container', class: [panel, 'missing'] }]))).toThrow(
      /names the class "missing"/
    );
  });

  it('refuses a list and rules of its own, naming every class in it', () => {
    expect(() => authorSpace(spaceWith([{ type: 'container', class: [panel, wide], css: { color: 'red' } }]))).toThrow(
      /declares both a shared class \("panel wide"\) and css of its own/
    );
  });

  it('dresses a slot with several classes too', () => {
    const spec = spaceWith([{ type: 'formControl', id: 'field', slots: { input: [panel, wide] } }]);

    expect(selectorOf(spec, 'field', 'input')).toBe('panel wide');
  });

  it('dresses a page with several classes too', () => {
    const { schema } = authorSpace({
      name: 'Paged',
      permanentUrl: 'paged',
      pages: [{ id: 'home', name: 'Home', slug: '', class: [panel, wide], body: [] }]
    });

    expect(schema.flat.home.definition.styleSelectors.base).toBe('panel wide');
  });
});

describe('the order of `classes`', () => {
  const first = styles('first', { color: 'red' });
  const second = styles('second', { color: 'blue' });
  const body = [{ type: 'container', class: [second, first] }];
  const orderOf = (spec: SpaceSpec): string[] =>
    Object.keys(classesOf(spec)).filter(name => name === 'first' || name === 'second');

  it('writes the tree’s declarations in the order the tree names them when `classes` says nothing', () => {
    expect(orderOf(spaceWith(body))).toEqual(['second', 'first']);
  });

  it('writes a declaration listed in `classes` where it is listed, ahead of the tree', () => {
    expect(orderOf(spaceWith(body, { classes: { first, second } }))).toEqual(['first', 'second']);
  });

  it('interleaves a declaration with plain rule sets in the one order written', () => {
    const spec = spaceWith([{ type: 'container', class: ['plain', first] }], {
      classes: { first, plain: { margin: '0' } }
    });

    expect(Object.keys(classesOf(spec)).filter(name => name === 'first' || name === 'plain')).toEqual([
      'first',
      'plain'
    ]);
  });

  it('refuses a listed declaration that disagrees with the one the tree names', () => {
    const other = styles('first', { color: 'green' });

    expect(() => authorSpace(spaceWith([{ type: 'container', class: other }], { classes: { first } }))).toThrow(
      /declares the class "first" with different rules/
    );
  });
});
