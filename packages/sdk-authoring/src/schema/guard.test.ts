import { describe, expect, expectTypeOf, it } from 'vitest';

import * as authoring from '../index';

import type {
  BINDING_SPEC_KEYS,
  ELEMENT_SPEC_KEYS,
  ELEMENT_STYLE_SPEC_KEYS,
  LAYOUT_SPEC_KEYS,
  PAGE_FOLDER_SPEC_KEYS,
  PAGE_SPEC_KEYS,
  SPACE_SPEC_KEYS,
  STEP_SPEC_KEYS
} from './guard';
import type {
  BindingSpec,
  ElementSpec,
  ElementStyleSpec,
  LayoutSpec,
  PageFolderSpec,
  PageSpec,
  SpaceSpec,
  StepSpec
} from './types';

describe('the fields the guard knows', () => {
  // If this stops compiling, a spec grew a field the guard would refuse. Add it to its list in `guard.ts`.
  it('names every field of every spec', () => {
    expectTypeOf<Exclude<keyof SpaceSpec, (typeof SPACE_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof PageSpec, (typeof PAGE_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof LayoutSpec, (typeof LAYOUT_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof ElementSpec, (typeof ELEMENT_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof BindingSpec, (typeof BINDING_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof StepSpec, (typeof STEP_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof PageFolderSpec, (typeof PAGE_FOLDER_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof ElementStyleSpec, (typeof ELEMENT_STYLE_SPEC_KEYS)[number]>>().toEqualTypeOf<never>();
  });
});

/**
 * What an author without TypeScript — JavaScript, generated JSON, a cast — gets wrong, and the refusal that says so.
 * Each would otherwise be written into the document and do nothing.
 */
describe('a declaration TypeScript never saw', () => {
  const space = (body: unknown[], page: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    ({
      name: 'Guard',
      permanentUrl: 'guard',
      ...extra,
      pages: [{ id: 'home', name: 'Home', slug: '', isDefault: true, body, ...page }]
    }) as unknown as SpaceSpec;
  const author = (body: unknown[], page?: Record<string, unknown>, extra?: Record<string, unknown>) =>
    authoring.authorSpace(space(body, page, extra));
  // Written the way a hand-built document is — an object, not a factory call — so the step can be anything at all.
  const step = (params: Record<string, unknown>): unknown[] => [
    {
      type: 'button',
      id: 'go',
      attributes: { content: 'Go' },
      flows: [[authoring.onClick(), { type: 'globalCallback', ...params }]]
    }
  ];

  it.each([
    ['a field the space does not take', () => author([], {}, { colours: {} }), /"colours", which it does not take/],
    ['a field a page does not take', () => author([], { titel: 'x' }), /"titel", which it does not take/],
    ['an access level that does not exist', () => author([], { accessLevel: 'admins' }), /'public', 'authenticated'/],
    [
      'two pages for the same visitors at one address',
      () =>
        authoring.authorSpace({
          name: 'Guard',
          permanentUrl: 'guard',
          pages: [
            { id: 'a', name: 'A', slug: 'x', body: [] },
            { id: 'b', name: 'B', slug: 'x', body: [] }
          ]
        }),
      /can never be reached/
    ],
    [
      'an event written as an attribute',
      () => author([{ type: 'button', id: 'b', attributes: { onClick: 'x' } }]),
      /flows:/
    ],
    [
      'a load strategy that does not exist',
      () => author([{ type: 'text', id: 't', loadStrategy: 'soon' }]),
      /'eager', 'lazy', 'visible'/
    ],
    [
      'a subType the element does not have',
      () => author([authoring.heading({ id: 'h', subType: 'h7' as 'h1' })]),
      /"h7" — did you mean "h1"/
    ],
    [
      'text where a flag is read',
      () => author([{ type: 'button', id: 'b', attributes: { disabled: 'yes' } }]),
      /write the boolean/
    ],
    [
      'a binding category that does not exist',
      () =>
        author([
          authoring.text('', {
            id: 't',
            bind: [{ to: 'content', source: 'state.x', category: 'attribute' as 'attributes' }]
          })
        ]),
      /did you mean "attributes"/
    ],
    [
      'a transformer that does not exist',
      () =>
        author([
          authoring.text('', {
            id: 't',
            bind: [{ to: 'content', source: 'state.x', transformers: [{ action: 'template', params: {} }] }]
          })
        ]),
      /"template", which does not exist — did you mean "twigTemplate"/
    ],
    [
      'a param a transformer does not take',
      () =>
        author([
          authoring.text('', {
            id: 't',
            bind: [
              { to: 'content', source: 'state.x', transformers: [{ action: 'twigTemplate', params: { tpl: 'x' } }] }
            ]
          })
        ]),
      /"tpl", which it does not take/
    ],
    [
      'visibility bound as an attribute',
      () => author([authoring.text('', { id: 't', bind: { visibility: 'state.open' } })]),
      /visible: 'state.open'/
    ],
    [
      'a param a step does not take',
      () => author(step({ action: 'setState', on: 'state', params: { key: 'k', type: 'text', value: 'v', extra: 1 } })),
      /"extra"/
    ],
    [
      'a step value outside its options',
      () => author(step({ action: 'setState', on: 'state', params: { key: 'k', type: 'string', value: 'v' } })),
      /'boolean', 'number', 'text', 'json'/
    ],
    [
      'a flow with no trigger',
      () =>
        author([
          authoring.button({
            id: 'b',
            content: 'x',
            flows: [[authoring.setState({ key: 'k', type: 'text', value: 'v' })]]
          })
        ]),
      /does not start with its trigger/
    ],
    [
      'a link to a page that does not exist',
      () => author([authoring.link({ id: 'l', href: 'nowhere' })]),
      /no page has that id/
    ],
    ['a full URL in page mode', () => author([authoring.link({ id: 'l', href: 'mailto:a@b.c' })]), /mode: 'external'/],
    [
      'a CSS value that ends its declaration',
      () => author([authoring.text('x', { id: 't', css: { color: 'red; display: none' } })]),
      /not one CSS value/
    ],
    [
      'an empty id',
      () => author([authoring.text('x', { id: '' })]),
      /is not one a binding, a template or a test can name/
    ],
    [
      'a controlled list with nothing to render',
      () => author([authoring.list({ id: 'l', source: 'controlled', children: [authoring.text('x')] })]),
      /no items/
    ]
  ])('refuses %s', (_, run, reason) => {
    expect(run).toThrow(reason);
  });

  it.each([
    ['an element type nothing ships', () => author([{ type: 'carousel', id: 'c' }]), 'unknown-element-type'],
    [
      'a modal open on arrival',
      () => author([authoring.modalContainer({ id: 'm', children: [authoring.text('x')] })]),
      'overlay-starts-open'
    ],
    [
      'a provider that asks nothing',
      () => author([authoring.apiContainer({ id: 'p', children: [authoring.text('x')] })]),
      'provider-without-source'
    ],
    [
      'a colour with no dark value',
      () => author([], {}, { variables: { color: { ink: { light: '#000', default: '#000' } } } }),
      'colour-without-dark'
    ]
  ])('warns about %s', (_, run, code) => {
    expect(run().warnings.map(warning => warning.code)).toContain(code);
  });

  it('keeps a plugin type the author named quiet, a path in page mode, and a full URL in external mode', () => {
    const { warnings } = authoring.authorSpace(
      space([
        { type: 'carousel', id: 'c' },
        authoring.link({ id: 'about', href: '/about' }),
        authoring.link({ id: 'mail', href: 'mailto:a@b.c', mode: 'external' })
      ]),
      { pluginTypes: ['carousel'] }
    );

    expect(warnings).toEqual([]);
  });
});
