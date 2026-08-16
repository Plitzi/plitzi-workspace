import { describe, expect, it } from 'vitest';

import { authorBinding, authorFlow, authorSpace, authoringId, container, heading, text } from './authoring';

import type { SpaceSpec } from './authoring';

const minimal = (overrides: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Test Space',
  permanentUrl: 'test-space',
  pages: [
    {
      name: 'Home',
      slug: '',
      seoTitle: 'Home — Test',
      seoDescription: 'A description.',
      style: { desktop: { display: 'flex' } },
      body: [
        container([heading('Hello', 'h1', { desktop: { 'font-size': '48px' } })], { desktop: { 'row-gap': '10px' } })
      ]
    },
    ...(overrides.pages ?? [])
  ],
  ...overrides,
  ...(overrides.pages ? { pages: overrides.pages } : {})
});

describe('authorSpace', () => {
  it('produces a schema the validator accepts', () => {
    const { schema } = authorSpace(minimal());

    expect(schema.pages).toHaveLength(1);
    expect(Object.keys(schema.flat)).toHaveLength(3);
    expect(schema.definition).toEqual({ name: 'Test Space', permanentUrl: 'test-space' });
  });

  it('wires every element to its parent and its root', () => {
    const { schema } = authorSpace(minimal());
    const [pageId] = schema.pages;
    const page = schema.flat[pageId];
    const [containerId] = page.definition.items ?? [];
    const box = schema.flat[containerId];
    const [headingId] = box.definition.items ?? [];

    expect(page.definition.parentId).toBeUndefined();
    expect(box.definition.parentId).toBe(pageId);
    expect(box.definition.rootId).toBe(pageId);
    expect(schema.flat[headingId].definition.parentId).toBe(containerId);
    expect(schema.flat[headingId].definition.rootId).toBe(pageId);
  });

  it('is deterministic — the same declaration authors byte-identical documents', () => {
    expect(JSON.stringify(authorSpace(minimal()))).toBe(JSON.stringify(authorSpace(minimal())));
  });

  it('gives every element a unique idRef, numbered per type', () => {
    const { schema } = authorSpace(minimal());
    const refs = Object.values(schema.flat).map(element => element.idRef);

    expect(refs).toEqual(['page-1', 'container-1', 'heading-1']);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('carries the page SEO fields, and marks SEO off when none were declared', () => {
    const { schema } = authorSpace(minimal());
    const page = schema.flat[schema.pages[0]];

    expect(page.attributes.seoEnabled).toBe(true);
    expect(page.attributes.seoPageTitle).toBe('Home — Test');
    expect(page.attributes.seoPageDescription).toBe('A description.');

    const bare = authorSpace({
      name: 'Bare',
      permanentUrl: 'bare',
      pages: [{ name: 'Home', slug: '', body: [text('hi')] }]
    });

    expect(bare.schema.flat[bare.schema.pages[0]].attributes.seoEnabled).toBe(false);
  });
});

describe('authorSpace / style', () => {
  it('writes one selector per breakpoint an element declared, and nothing for the ones it did not', () => {
    const { schema, style } = authorSpace({
      name: 'Responsive',
      permanentUrl: 'responsive',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [heading('Big', 'h1', { desktop: { 'font-size': '60px' }, mobile: { 'font-size': '30px' } })]
        }
      ]
    });

    const headingId = schema.flat[schema.pages[0]].definition.items?.[0] as string;
    const selector = schema.flat[headingId].definition.styleSelectors.base;

    expect(style.platform.desktop[selector].cache).toBe(`.${selector}{font-size:60px;}`);
    expect(style.platform.mobile[selector].cache).toBe(`.${selector}{font-size:30px;}`);
    expect(style.platform.tablet[selector]).toBeUndefined();
  });

  it('lets two elements share one named class instead of minting a rule each', () => {
    const { schema, style } = authorSpace({
      name: 'Shared',
      permanentUrl: 'shared',
      classes: { btn: { desktop: { 'border-top-left-radius': '8px' } } },
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            { type: 'link', attributes: { href: '#a' }, className: 'btn' },
            { type: 'link', attributes: { href: '#b' }, className: 'btn' }
          ]
        }
      ]
    });

    const links = (schema.flat[schema.pages[0]].definition.items ?? []).map(id => schema.flat[id]);

    expect(links.map(l => l.definition.styleSelectors.base)).toEqual(['btn', 'btn']);
    expect(Object.keys(style.platform.desktop)).toEqual(['btn']);
  });

  it('emits element-type defaults with their variants, and the theme variables', () => {
    const { style } = authorSpace({
      name: 'Themed',
      permanentUrl: 'themed',
      variables: { color: { brand: { light: '#000', dark: '#fff', default: '#000' } } },
      elements: { heading: { base: { color: 'var(--brand)' }, variants: { title: { 'margin-top': '0px' } } } },
      pages: [{ name: 'Home', slug: '', body: [heading('Hi', 'h1')] }]
    });

    expect(style.platform.desktop.heading.type).toBe('element');
    expect(style.platform.desktop.heading.cache).toContain('.plitzi__heading{color:var(--brand);');
    expect(style.platform.desktop.heading.cache).toContain('&.heading--title{margin-top:0px;}');
    expect(style.cache).toContain('--brand');
  });
});

describe('authorFlow', () => {
  const steps = authorFlow('space/home/flow/0', [
    { type: 'trigger', action: 'onClick', on: 'button-1' },
    { type: 'globalCallback', action: 'login', on: 'auth', params: { mode: 'token' } },
    { type: 'callback', action: 'setVisibility', on: 'container-1' }
  ]);

  const nodes = Object.values(steps);

  it('chains the steps in the order they were written', () => {
    expect(nodes).toHaveLength(3);
    expect(nodes[0].beforeNode).toBe('');
    expect(nodes[0].afterNode).toBe(nodes[1].id);
    expect(nodes[1].beforeNode).toBe(nodes[0].id);
    expect(nodes[2].afterNode).toBe('');
  });

  it('gives every node the first node as its flow id', () => {
    expect(new Set(nodes.map(node => node.flowId))).toEqual(new Set([nodes[0].id]));
  });

  it('registers each step on the idRef it names, and defaults the rest', () => {
    expect(nodes.map(node => node.elementId)).toEqual(['button-1', 'auth', 'container-1']);
    expect(nodes[0].title).toBe('onClick');
    expect(nodes[0].enabled).toBe(true);
    expect(nodes[1].params).toEqual({ mode: 'token' });
  });

  it('registers a utility on no element at all', () => {
    const [utility] = Object.values(authorFlow('x', [{ type: 'utility', action: 'delay' }]));

    expect(utility.elementId).toBeNull();
  });
});

describe('authorBinding', () => {
  it('fills the fields the runtime needs but nobody chooses', () => {
    const binding = authorBinding('space/home/0', 0, { to: 'items', source: 'apiContainer_products-1.data' });

    expect(binding).toMatchObject({ to: 'items', source: 'apiContainer_products-1.data', transformers: [] });
    expect(binding.id).toHaveLength(24);
  });

  it('groups bindings under the category they target', () => {
    const { schema } = authorSpace({
      name: 'Bound',
      permanentUrl: 'bound',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            {
              type: 'list',
              attributes: { subType: 'ul', source: 'controlled' },
              bindings: [
                { to: 'items', source: 'api-1.data' },
                { to: 'visibility', source: 'api-1.ready', category: 'initialState' }
              ]
            }
          ]
        }
      ]
    });

    const listId = schema.flat[schema.pages[0]].definition.items?.[0] as string;
    const bindings = schema.flat[listId].definition.bindings ?? {};

    expect(bindings.attributes).toHaveLength(1);
    expect(bindings.initialState).toHaveLength(1);
    expect(bindings.attributes?.[0].to).toBe('items');
  });
});

describe('authoringId', () => {
  it('is stable, Mongo-shaped and path-dependent', () => {
    expect(authoringId('a/b')).toBe(authoringId('a/b'));
    expect(authoringId('a/b')).not.toBe(authoringId('a/c'));
    expect(authoringId('a/b')).toMatch(/^[0-9a-f]{24}$/);
  });
});
