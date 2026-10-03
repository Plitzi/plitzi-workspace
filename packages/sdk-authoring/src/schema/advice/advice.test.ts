import { describe, expect, it } from 'vitest';

import { button, container, heading, link, list, text } from '../../elements';
import { onClick } from '../../elements/steps';
import { setState, toggleState } from '../../interactions';
import { authorSpace } from '../space';

import type { ElementSpec, PageSpec, SpaceSpec } from '../types';

/** A header as a page-per-page helper writes it: the same seven elements, a fresh copy on every page. */
const header = (current: string): ElementSpec =>
  container({
    class: 'top',
    children: [
      text({ content: 'Acme', class: 'brand' }),
      container({
        class: 'nav',
        children: ['home', 'about', 'pricing'].map(page =>
          link({ href: `/${page}`, mode: 'internal', class: page === current ? 'navOn' : 'navOff', content: page })
        )
      }),
      button({ content: 'Sign in' })
    ]
  });

const page = (id: string, body: ElementSpec[]): PageSpec => ({ id, name: id, slug: id === 'home' ? '' : id, body });

const space = (pages: PageSpec[], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Advice',
  permanentUrl: 'advice',
  classes: { top: { display: 'flex' }, brand: {}, nav: {}, navOn: { color: 'red' }, navOff: {}, card: {}, card2: {} },
  pages,
  ...extra
});

const codesOf = (spec: SpaceSpec): string[] => authorSpace(spec).suggestions.map(suggestion => suggestion.code);

describe('suggestions', () => {
  it('offers a layout for the same block at the edge of several pages, and says what it saves', () => {
    const pages = ['home', 'about', 'pricing'].map(id =>
      page(id, [header('none'), heading({ content: `The ${id} page` })])
    );
    const [suggestion] = authorSpace(space(pages)).suggestions;

    expect(suggestion).toMatchObject({
      code: 'repeated-on-pages',
      saves: 14,
      elementIds: expect.any(Array) as unknown
    });
    expect(suggestion.message).toContain('layout');
  });

  it('names the current state when the copies differ only in the class of one link', () => {
    const pages = ['home', 'about', 'pricing'].map(id => page(id, [header(id), heading({ content: id })]));
    const [suggestion] = authorSpace(space(pages)).suggestions;

    expect(suggestion.code).toBe('repeated-on-pages');
    expect(suggestion.message).toContain('states: { current:');
  });

  it('does not take two blocks reading different sources for one in two places', () => {
    const pager = (source: string) =>
      container({
        class: 'top',
        visible: `${source}.total`,
        children: [text({ content: 'a' }), text({ content: 'b' }), text({ content: 'c' }), text({ content: 'd' })]
      });
    const pages = [
      page('home', [heading({ content: 'h' }), pager('state.one')]),
      page('about', [heading({ content: 'a' }), pager('state.two')])
    ];

    expect(codesOf(space(pages))).not.toContain('repeated-on-pages');
  });

  it('offers a component for a block only some pages of one layout carry', () => {
    const band = () =>
      container({ class: 'top', children: ['a', 'b', 'c', 'd', 'e'].map(word => text({ content: word })) });
    const spec = space(
      ['home', 'about', 'pricing'].map(id => ({
        ...page(id, id === 'pricing' ? [heading({ content: id })] : [heading({ content: id }), band()]),
        layout: { id: 'site', slot: 'main' }
      })),
      { layouts: [{ id: 'site', body: [container({ id: 'main' })] }] }
    );
    const suggestion = authorSpace(spec).suggestions.find(entry => entry.code === 'repeated-on-pages');

    expect(suggestion?.message).toContain('make it a component');
    expect(suggestion?.saves).toBe(4);
  });

  it('takes copies that each read a provider of their own for one block', () => {
    const footer = (prefix: string) =>
      container({
        class: 'top',
        children: [
          text({ content: 'Links' }),
          list({ id: `${prefix}-links`, items: ['Docs', 'Blog'], children: [text({ from: `${prefix}-links.item` })] }),
          text({ content: 'a' }),
          text({ content: 'b' })
        ]
      });
    const pages = ['home', 'about'].map(id => page(id, [heading({ content: id }), footer(id)]));

    expect(codesOf(space(pages))).toContain('repeated-on-pages');
  });

  it('leaves a block between two parts of a page alone: a layout could not hold it there', () => {
    const middle = (id: string) =>
      page(id, [heading({ content: id }), header('none'), text({ content: `${id} ends here` })]);

    expect(codesOf(space([middle('home'), middle('about')]))).not.toContain('repeated-on-pages');
  });

  it('offers a component for one structure written again with other words, a list when they are siblings', () => {
    const card = (title: string) =>
      container({
        class: 'card',
        children: [heading({ content: title }), text({ content: `${title}, in a line` }), button({ content: 'Open' })]
      });
    const apart = space([
      page('home', [container({ children: [card('One')] }), container({ children: [card('Two')] }), card('Three')])
    ]);
    const together = space([page('home', [container({ children: [card('One'), card('Two'), card('Three')] })])]);

    expect(authorSpace(apart).suggestions[0].message).toContain('component');
    expect(authorSpace(together).suggestions[0].message).toContain('`list`');
  });

  it('does not take copies whose flows differ for one component', () => {
    const tile = (name: string, steps: 'one' | 'two') =>
      button({
        class: 'card2',
        content: name,
        flows: [
          [
            onClick(),
            steps === 'one' ? setState({ key: 'a', type: 'boolean', value: true }) : toggleState({ key: 'a' })
          ]
        ],
        children: [text({ content: 'a' }), text({ content: 'b' }), text({ content: 'c' })]
      });

    expect(
      codesOf(space([page('home', [container({ children: [tile('A', 'one'), tile('B', 'two'), tile('C', 'one')] })])]))
    ).not.toContain('repeated-shape');
  });

  it('offers the own content of a button or a link for a text that is its only child', () => {
    const spec = space([
      page('home', [
        button({ content: '', children: [text({ content: 'Save' })] }),
        link({ href: '/a', mode: 'internal', children: [text({ content: 'Docs', class: 'brand' })] }),
        link({ href: '/b', mode: 'internal', content: 'Pricing' })
      ])
    ]);
    const suggestion = authorSpace(spec).suggestions.find(entry => entry.code === 'content-attribute');

    expect(suggestion?.saves).toBe(2);
    expect(suggestion?.message).toContain('Where the text wears a class (1 of them)');
  });

  it('leaves alone a text that is a shape drawn inside the button, not words', () => {
    const spec = space(
      [
        page('home', [
          button({ content: '', children: [text({ content: '' })] }),
          button({ content: '', children: [text({ content: 'x', class: 'swatch' })] })
        ])
      ],
      { classes: { swatch: { width: '16px', height: '16px', backgroundColor: 'red' } } }
    );

    expect(codesOf(spec)).not.toContain('content-attribute');
  });

  it('reads customCss for what a class, the SDK or the notifications say better', () => {
    const spec = space([page('home', [container({ class: 'card' })])], {
      customCss: [
        '.card:hover { color: red; }',
        '@media (prefers-reduced-motion: reduce) { *, *::before { animation-duration: 0.01ms !important; } }',
        '.Toastify__toast { font-family: serif; border: 1px solid red; }'
      ].join('\n')
    });

    expect(codesOf(spec)).toEqual(
      expect.arrayContaining(['custom-css-class', 'custom-css-sdk-default', 'custom-css-notifications'])
    );
  });

  it('has nothing to say about a space written the short way', () => {
    expect(authorSpace(space([page('home', [heading({ content: 'Hello' })])])).suggestions).toEqual([]);
  });
});
