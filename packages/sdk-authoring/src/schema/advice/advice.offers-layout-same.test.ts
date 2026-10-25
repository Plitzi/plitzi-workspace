import { describe, expect, it } from 'vitest';

import { suggestSpace } from './index';
import {
  apiContainer,
  button,
  component,
  container,
  fontAwesome,
  formControl,
  heading,
  link,
  list,
  text
} from '../../elements';
import { onClick } from '../../elements/steps';
import { setState, toggleState } from '../../interactions';
import { bindTemplate } from '../bindings';
import { authorSpace } from '../space';
import { codesOf, menu, page, space } from './tests/advice';

import type { ElementSpec, SpaceSpec } from '../types';

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
// Three figures a dashboard writes: alike, each in a panel of its own, each reading its own number.
const figure = (field: string, template: string) =>
  container({
    class: 'tile',
    children: [
      text({ class: 'tile-label', content: field }),
      text({ class: 'tile-value', bind: [bindTemplate('content', `state.${field}`, template)] }),
      text({ class: 'tile-note', content: 'this month' })
    ]
  });
const dashboard = (...figures: ElementSpec[]) =>
  space([
    page(
      'home',
      figures.map(each => container({ children: [each] }))
    )
  ]);

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
  it('takes figures that read their data in one form for one component, the field a prop', () => {
    const alike = dashboard(
      figure('views', '{{ source|number }} views'),
      figure('edits', '{{ source|number }} edits'),
      figure('pages', '{{ source|number }} pages')
    );

    expect(codesOf(alike)).toContain('repeated-shape');
  });
  /** encore-3: a helper called three times tripped it, and the agent guessed a smaller shape to get under it. */
  it('says what counts as a copy, and how copies alike on purpose are kept', () => {
    const { suggestions } = authorSpace(
      dashboard(
        figure('views', '{{ source|number }} views'),
        figure('edits', '{{ source|number }} edits'),
        figure('pages', '{{ source|number }} pages')
      )
    );
    const shape = suggestions.find(suggestion => suggestion.code === 'repeated-shape');

    expect(shape?.message).toContain('Counted from 3 copies of 4 elements or more (2 of 8 or more)');
    expect(shape?.message).toContain("`quiet: ['repeated-shape']`");
  });
  it('does not take figures that read their data in different forms for one component', () => {
    const unlike = dashboard(
      figure('views', '{{ source|number }} views'),
      figure('quota', '{{ source }} of {{ state.limit }}'),
      figure('share', '{{ (source * 100)|round }}%')
    );

    expect(codesOf(unlike)).not.toContain('repeated-shape');
  });
  it('does not take forms asking for different kinds of field for one component: a date field is no number field', () => {
    const form = (fields: ('text' | 'date' | 'number' | 'select' | 'textarea')[]) =>
      container({
        class: 'tile',
        children: fields.map((subType, n) => formControl({ subType, name: `field${String(n)}`, class: 'tile-value' }))
      });
    const forms = (...each: ElementSpec[]) =>
      space([
        page(
          'home',
          each.map(one => container({ children: [one] }))
        )
      ]);

    expect(
      codesOf(
        forms(
          form(['select', 'date', 'number', 'textarea']),
          form(['select', 'date', 'number', 'textarea']),
          form(['select', 'date', 'number', 'textarea'])
        )
      )
    ).toContain('repeated-shape');
    expect(
      codesOf(
        forms(
          form(['select', 'date', 'number', 'textarea']),
          form(['select', 'date', 'select', 'number']),
          form(['text', 'text', 'number', 'textarea'])
        )
      )
    ).not.toContain('repeated-shape');
  });
  it('does not take panels holding a provider resolved on the server for copies: each is found by its own id', () => {
    const panel = (id: string) =>
      container({
        class: 'panel',
        children: [
          heading({ content: id }),
          apiContainer({ id, query: `/data/${id}.json`, runtime: 'server', children: [text({ content: 'rows' })] }),
          text({ content: 'More' })
        ]
      });

    expect(codesOf(dashboard(panel('feed'), panel('picks'), panel('later')))).not.toContain('repeated-shape');
  });
  it('takes controls wired to different sources and keys for controls, not rows of one list', () => {
    const menus = space([page('home', [container({ children: [menu('language'), menu('level'), menu('topic')] })])]);

    expect(codesOf(menus)).not.toContain('repeated-shape');
  });
  // Instances of one component whose slots are filled alike are offered as a repeat too — and, written that way on
  // purpose, an instance quiets it like any element: what the export prints, `component(id, { quiet })`, authors.
  it('leaves out a repeat of component instances that the instances quiet', () => {
    const framed = (quiet?: 'repeated-shape') =>
      space(
        [
          page('home', [
            container({
              children: ['Videos', 'Exercises', 'A certificate', 'Lifetime access'].map(words =>
                component('frame', {
                  ...(quiet ? { quiet: [quiet] } : {}),
                  children: [
                    text({ class: 'tick', content: '✓' }),
                    text({ class: 'line', content: words }),
                    text({ content: '' })
                  ]
                })
              )
            })
          ])
        ],
        {
          components: [
            {
              id: 'frame',
              slots: ['frame-body'],
              root: container({ id: 'frame-root', class: 'includes', children: [container({ id: 'frame-body' })] })
            }
          ]
        }
      );

    expect(codesOf(framed())).toContain('repeated-shape');
    expect(codesOf(framed('repeated-shape'))).not.toContain('repeated-shape');
  });
  it('leaves out a suggestion an element it is about quiets, and refuses a quiet that names no suggestion', () => {
    const row = (words: string, quiet?: 'repeated-shape') =>
      container({
        class: 'includes',
        ...(quiet ? { quiet: [quiet] } : {}),
        children: [
          text({ class: 'tick', content: '✓' }),
          text({ class: 'line', content: words }),
          text({ content: '' })
        ]
      });
    const rows = (quiet?: 'repeated-shape') =>
      space([
        page('home', [
          container({
            children: ['Videos', 'Exercises', 'A certificate', 'Lifetime access'].map(words => row(words, quiet))
          })
        ])
      ]);

    expect(codesOf(rows())).toContain('repeated-shape');
    expect(codesOf(rows('repeated-shape'))).not.toContain('repeated-shape');

    // In the document, where the builder's list and the MCP read it: the same suggestion is left out there too.
    const { schema, style } = authorSpace(rows('repeated-shape'));
    expect(Object.values(schema.flat).some(element => element.definition.quiet?.includes('repeated-shape'))).toBe(true);
    expect(suggestSpace({ schema, style }).map(suggestion => suggestion.code)).not.toContain('repeated-shape');
    expect(() =>
      authorSpace(space([page('home', [container({ quiet: ['class-and-css' as 'repeated-shape'] })])]))
    ).toThrow(/quiet-unknown[^]*"class-and-css", which is no suggestion's code/);
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
  it('offers the own icon of a button or a link for a plain icon beside its words, and leaves one that means something', () => {
    const spec = space([
      page('home', [
        link({
          href: '/a',
          mode: 'internal',
          children: [text({ content: 'Docs' }), fontAwesome({ icon: 'fas fa-arrow-right' })]
        }),
        button({ content: '', title: 'Close', children: [fontAwesome({ icon: 'fas fa-xmark' })] }),
        button({
          content: '',
          children: [fontAwesome({ icon: 'fas fa-star', label: 'Favourite' }), text({ content: 'Star' })]
        })
      ])
    ]);
    const suggestion = authorSpace(spec).suggestions.find(entry => entry.code === 'content-attribute');

    expect(suggestion?.elementIds).toHaveLength(2);
    expect(suggestion?.saves).toBe(3);
    expect(suggestion?.message).toContain('its `icon`');
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
  it('reads the toast’s parts dressed by hand as the notifications’ fields, and leaves what those cannot say', () => {
    const toasts = (customCss: string) =>
      codesOf(space([page('home', [container()])], { customCss })).includes('custom-css-notifications');

    expect(toasts('.plitzi-sdk-toasts .Toastify__toast-icon { width: 18px; }')).toBe(true);
    expect(toasts('.plitzi-sdk-toasts .Toastify__close-button { align-self: center; color: var(--muted); }')).toBe(
      true
    );
    expect(toasts('.plitzi-sdk-toasts .Toastify__progress-bar { height: 2px; }')).toBe(true);
    expect(toasts('.Toastify__toast { min-height: 0; }')).toBe(true);
    expect(toasts('.Toastify__close-button { background-color: red; }')).toBe(false);
    expect(toasts('.Toastify__toast { letter-spacing: 0.08em; text-transform: uppercase; }')).toBe(false);
  });
  it('does not read the rules the notifications write as the toasts dressed by hand', () => {
    const spec = space([page('home', [container()])], {
      notifications: { font: 'var(--font-sans)', minHeight: '0px', iconSize: '18px', closeColor: 'var(--muted)' },
      customCss: '.plitzi-sdk-toasts .Toastify__close-button { align-self: center; }'
    });

    expect(codesOf(spec)).not.toContain('custom-css-notifications');
  });
  describe('heavy animations', () => {
    const animated = (customCss: string, classes: SpaceSpec['classes'] = {}) =>
      authorSpace(
        space([page('home', [container({ class: 'card' })])], {
          classes: { card: {}, ...classes },
          customCss
        })
      ).suggestions.filter(suggestion => suggestion.code === 'heavy-animation');

    it('names the keyframes a class runs off the compositor, and the way out of each cost', () => {
      const [suggestion] = animated(
        '@keyframes grow { to { width: 100%; box-shadow: 0 0 40px red; } }\n@keyframes fade { to { opacity: 1; } }',
        { bar: { animation: 'grow 1s ease infinite' }, ghost: { animation: 'fade 1s' } }
      );

      expect(suggestion.message).toContain('`grow` (`width`, `box-shadow`)');
      expect(suggestion.message).not.toContain('`fade`');
      expect(suggestion.message).toContain('`translate`, `scale`');
      expect(suggestion.message).toContain('`opacity` changes');
    });

    it('reads the animations customCss starts too, inside an at-rule', () => {
      expect(
        animated(
          '@keyframes sweep { to { background-position: 100% 0; } }\n@media (min-width: 40rem) { .hero::before { animation: sweep 9s linear infinite; } }'
        )
      ).toHaveLength(1);
    });

    it('says where each animation is — a class and its variant — and writes the fix against that class', () => {
      const [suggestion] = animated('@keyframes foil { to { background-position: -300% 0; } }', {
        'rarity-badge': {
          css: { padding: '2px' },
          variants: { epico: { css: { animation: 'foil 3.2s linear infinite' } } }
        }
      });

      expect(suggestion.message).toContain(
        '`foil` (`background-position`) in the class `rarity-badge`, variant `epico`'
      );
      expect(suggestion.message).toContain('`[data-hydrated] .rarity-badge { animation-play-state: running; }`');
      expect(suggestion.message).not.toContain('in `customCss` animate');
      expect(suggestion.message).not.toContain('.glow');
    });

    it('lets main-thread decoration through once it waits for the page to be hydrated', () => {
      const keyframes = '@keyframes glow { to { --glow: 1; } }';
      const gate = '[data-hydrated] .glow { animation-play-state: running; }';

      expect(animated(`${keyframes}\n${gate}`, { glow: { animation: 'glow 8s linear infinite paused' } })).toEqual([]);
      expect(animated(keyframes, { glow: { animation: 'glow 8s linear infinite paused' } })).toHaveLength(1);
      expect(animated(`${keyframes}\n${gate}`, { glow: { animation: 'glow 8s linear infinite' } })).toHaveLength(1);
    });

    it('counts a colour only when it loops, and never a property that only switches', () => {
      const keyframes =
        '@keyframes lit { to { background-color: red; } }\n@keyframes boot { to { visibility: visible; } }';

      expect(
        animated(keyframes, { lit: { animation: 'lit 300ms ease' }, boot: { animation: 'boot 1s infinite' } })
      ).toEqual([]);
      expect(animated(keyframes, { lit: { animation: 'lit 2s ease infinite' } })).toHaveLength(1);
    });

    it('does not let a blur through for waiting', () => {
      const [suggestion] = animated(
        '@keyframes haze { to { filter: blur(40px); color: red; } }\n[data-hydrated] .haze { animation-play-state: running; }',
        { haze: { animation: 'haze 4s infinite paused' } }
      );

      expect(suggestion.message).toContain('`haze` (`filter`)');
    });

    it('is about the elements wearing the class, and says nothing once each of them quiets it', () => {
      const entrance = (quieted = false) =>
        authorSpace(
          space(
            [
              page('home', [
                container({
                  id: 'crest',
                  class: 'blurred',
                  ...(quieted ? { quiet: ['heavy-animation' as const] } : {})
                }),
                container({
                  id: 'title',
                  class: 'blurred',
                  ...(quieted ? { quiet: ['heavy-animation' as const] } : {})
                })
              ])
            ],
            {
              classes: { blurred: { animation: 'blurred-in 900ms ease-in-out both' } },
              customCss: '@keyframes blurred-in { from { filter: blur(5px); opacity: 0; } }'
            }
          )
        ).suggestions.filter(suggestion => suggestion.code === 'heavy-animation');

      expect(entrance().map(suggestion => suggestion.elementIds)).toEqual([['crest', 'title']]);
      expect(entrance(true)).toEqual([]);
    });

    it('has nothing to say about keyframes nothing runs, or ones the compositor runs alone', () => {
      expect(
        animated(
          '@keyframes unused { to { height: 0; } }\n@keyframes rise { from { opacity: 0; translate: 0 8px; } }',
          {
            rise: { animation: 'rise 400ms ease both' }
          }
        )
      ).toEqual([]);
    });
  });
  it('has nothing to say about a space written the short way', () => {
    expect(authorSpace(space([page('home', [heading({ content: 'Hello' })])], { classes: {} })).suggestions).toEqual(
      []
    );
  });
});
