/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
import { describe, expect, it } from 'vitest';

import * as authoring from './index';

import type { ElementSpec, SpaceSpec } from './index';

/**
 * Declarations that used to author without a word and then render wrong.
 *
 * Each one was found building a real space: the document validated, the page rendered, and what was on screen was not
 * what was written — a card linking to its own template text, a heading that said "Heading", a list fed a string. An
 * agent reads a silent failure as a platform limitation and works around it, so every case here is refused or warned
 * about, with the fix in the message.
 */

const space = (body: ElementSpec[], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Silent',
  permanentUrl: 'silent',
  ...extra,
  pages: [
    { id: 'home', name: 'Home', slug: '', isDefault: true, body },
    { id: 'game', name: 'Game', slug: 'games/{{slug}}', body: [authoring.text('', { id: 'game-slug' })] }
  ]
});

const author = (body: ElementSpec[], extra?: Partial<SpaceSpec>) => authoring.authorSpace(space(body, extra));

const rows = (children: ElementSpec[]): ElementSpec =>
  authoring.list({ id: 'rows', source: 'controlled', items: [{ slug: 'alpha' }], children });

describe('children on a type that holds none', () => {
  it('refuses them, and points a heading made of parts at a container with its tag', () => {
    expect(() =>
      author([authoring.heading({ id: 'title', subType: 'h2', children: [authoring.text('Space')] })])
    ).toThrow(/holds none.*container\(\{ subType: 'h2'/);
    expect(() => author([authoring.text('x', { id: 'tx', children: [authoring.text('y')] })])).toThrow(/holds none/);
  });

  it('accepts the heading built as a container', () => {
    expect(() =>
      author([authoring.container({ id: 'title', subType: 'h1', children: [authoring.text('Space')] })])
    ).not.toThrow();
  });
});

describe('a default content rendered beside children', () => {
  it('warns when the placeholder word would print next to them', () => {
    const { warnings } = author([authoring.button({ id: 'go', children: [authoring.text('Launch')] })]);

    expect(warnings.map(warning => warning.code)).toContain('default-content-beside-children');
  });

  it('says nothing once the content is the author’s', () => {
    const { warnings } = author([authoring.button({ id: 'go', content: '', children: [authoring.text('Launch')] })]);

    expect(warnings.map(warning => warning.code)).not.toContain('default-content-beside-children');
  });
});

describe('templates the interpreter cannot read', () => {
  const computed = (template: string) =>
    author([authoring.text('', { id: 't', bind: [authoring.bindTemplate('content', 'state.q', template)] })]);

  it.each([
    ["{{ source matches '/^a/' ? 'y' : 'n' }}", /`matches` is not supported/],
    ['{{ source|defualt }}', /Unknown filter "defualt"/],
    ['{{ source @ 2 }}', /Unexpected "@ 2"/],
    ['{{ now() }}', /Unknown function/]
  ])('refuses %s', (template, reason) => {
    expect(() => computed(template)).toThrow(reason);
  });

  it('accepts the operators Twig has', () => {
    expect(() => computed("{{ source starts with 'a' ? '%02d'|format(2 ** 3 // 2) : source ?: '—' }}")).not.toThrow();
  });
});

describe('names a template reads', () => {
  it('accepts a list row read from inside the row, as an attribute token', () => {
    expect(() =>
      author([rows([authoring.link({ id: 'go', mode: 'internal', href: '/games/{{ list_rows.item.slug }}' })])])
    ).not.toThrow();
  });

  it('refuses a list row read from outside the list', () => {
    expect(() =>
      author([rows([authoring.text('row')]), authoring.text('{{ list_rows.item.slug }}', { id: 'outside' })])
    ).toThrow(/"rows" is not around it/);
  });

  it('refuses a name nothing answers to, and says how a query parameter is spelled', () => {
    expect(() => author([authoring.link({ id: 'back', mode: 'internal', href: '/?r={{ redirect }}' })])).toThrow(
      /nothing here answers to.*navigation\.queryParams\.redirect/
    );
  });

  it('accepts a route param on the page that declares it, and a variable of the space', () => {
    expect(() =>
      authoring.authorSpace({
        name: 'Params',
        permanentUrl: 'params',
        schemaVariables: [{ name: 'apiUrl', category: 'api', type: 'text', value: 'https://x', subValues: [] }],
        pages: [
          {
            id: 'game',
            name: 'Game',
            slug: 'games/{{slug}}',
            isDefault: true,
            body: [authoring.link({ id: 'api', mode: 'external', href: '{{ apiUrl }}/games/{{ slug }}' })]
          }
        ]
      })
    ).not.toThrow();
  });

  it('reads an id with a hyphen inside a template as the name it is', () => {
    expect(() =>
      author([
        authoring.apiContainer({
          id: 'tn-data',
          query: '/x.json',
          children: [
            authoring.text('', {
              id: 'total',
              bind: [authoring.bindTemplate('content', 'tn-data.data', '{{ apiContainer_tn-data.data|length }}')]
            })
          ]
        })
      ])
    ).not.toThrow();
  });
});

describe('a template feeding a list', () => {
  const feeding = (returns?: 'value') =>
    author([
      authoring.list({
        id: 'filtered',
        source: 'controlled',
        bind: [
          authoring.bindTemplate('items', 'state.games', '{{ source|filter(g => g.new) }}', returns ? { returns } : {})
        ],
        children: [authoring.text('row')]
      })
    ]);

  it('refuses the text a template renders by default', () => {
    expect(() => feeding()).toThrow(/renders text — and "items" holds a list.*returnMode: 'value'/);
  });

  it('accepts the template handing over its value', () => {
    const { schema } = feeding('value');
    const [binding] = schema.flat.filtered.definition.bindings?.attributes ?? [];

    expect(binding.transformers?.[0].params).toEqual({
      template: '{{ source|filter(g => g.new) }}',
      returnMode: 'value'
    });
  });
});

describe('visible, computed by a template', () => {
  it('binds the template and starts the element hidden', () => {
    const { schema } = author([
      authoring.text('Nothing matches', {
        id: 'empty',
        visible: { source: 'state.query', template: "{{ source != '' ? 'true' : 'false' }}" }
      })
    ]);
    const element = schema.flat.empty;

    expect(element.definition.initialState?.visibility).toBe(false);
    expect(element.definition.bindings?.initialState?.[0]).toMatchObject({
      to: 'visibility',
      source: 'state.query',
      transformers: [{ action: 'twigTemplate', params: { template: "{{ source != '' ? 'true' : 'false' }}" } }]
    });
  });
});

describe('compact: tablet and phone at once', () => {
  it('writes the rules to both, under what either says for itself', () => {
    const { style } = author([
      authoring.container({
        id: 'grid',
        selector: 'grid',
        css: {
          desktop: { display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)' },
          compact: { 'grid-template-columns': '1fr', gap: '12px' },
          mobile: { gap: '8px' }
        }
      })
    ]);

    expect(style.platform.tablet.grid.attributes.base.default).toMatchObject({
      'grid-template-columns': '1fr',
      'row-gap': '12px'
    });
    expect(style.platform.mobile.grid.attributes.base.default).toMatchObject({
      'grid-template-columns': '1fr',
      'row-gap': '8px'
    });
  });
});

describe('handles a generic visual test can trust', () => {
  it('marks what renders once per row and what renders no element of its own', () => {
    const { handles } = author([
      authoring.apiContainer({
        id: 'feed',
        query: '/feed.json',
        children: [rows([authoring.text('x', { id: 'cell' })])]
      })
    ]);

    expect(handles.element('feed').boxless).toBe(true);
    expect(handles.element('cell').repeated).toBe(true);
    expect(handles.element('rows').repeated).toBeUndefined();
  });
});

describe('a form control on its own', () => {
  it('is a supported shape: a search box that filters a screen needs no form', () => {
    expect(() =>
      author([authoring.formControl({ id: 'q', name: 'q', label: 'Search', required: false })])
    ).not.toThrow();
  });
});

describe('computed values', () => {
  const computedSpace = (computed: Record<string, string>, body: ElementSpec[] = []) => author(body, { computed });

  it('writes them to the settings and lets any template read them', () => {
    const { schema } = computedSpace(
      { xp: '{{ (state.favourites|length) * 10 }}', level: '{{ computed.xp // 100 + 1 }}' },
      [
        authoring.text('', {
          id: 'lvl',
          bind: [authoring.bindTemplate('content', 'computed.level', 'Level {{ source }}')]
        })
      ]
    );

    expect(schema.settings.computed).toEqual({
      xp: '{{ (state.favourites|length) * 10 }}',
      level: '{{ computed.xp // 100 + 1 }}'
    });
  });

  it('refuses a value read before it is computed, and one nothing computes', () => {
    expect(() => computedSpace({ level: '{{ computed.xp // 100 }}', xp: '{{ state.runs }}' })).toThrow(
      /declared after it.*move "xp" above/
    );
    expect(() =>
      computedSpace({ xp: '{{ state.runs }}' }, [authoring.text('{{ computed.px }}', { id: 'typo' })])
    ).toThrow(/does not compute — did you mean "xp"/);
  });

  it('refuses an element source, a name that is not one, and a value that is not a template', () => {
    expect(() => computedSpace({ first: '{{ list_rows.item }}' })).toThrow(/reads only the globals/);
    expect(() => computedSpace({ 'total-xp': '{{ state.runs }}' })).toThrow(/"total_xp"/);
    expect(() => computedSpace({ xp: '10' })).toThrow(/is a template/);
  });
});

describe('notifications', () => {
  it('writes their colours as the toast container’s variables', () => {
    const { schema } = author([], { notifications: { background: 'var(--card)', success: 'var(--accent)' } });

    expect(schema.settings.customCss).toContain('--toastify-color-light: var(--card);');
    expect(schema.settings.customCss).toContain('--toastify-color-success: var(--accent);');
  });

  it('refuses an unknown field and a value that would break out of its declaration', () => {
    expect(() => author([], { notifications: { error: 'red' } as never })).toThrow(/has no "error"/);
    expect(() => author([], { notifications: { text: 'red; } body { display: none' } })).toThrow(/not one CSS value/);
  });
});
