import { describe, expect, it } from 'vitest';

import { authorBinding, authorFlow, authorSpace, validateSpace, visibleWhen } from './index';

import type { ElementSpec, SpaceSpec } from './index';
import type { StyleObject } from '@plitzi/sdk-shared';

const text = (content: string, css?: ElementSpec['css']): ElementSpec => ({
  type: 'text',
  attributes: { content },
  ...(css ? { css } : {})
});

const heading = (content: string, subType: string, css?: ElementSpec['css']): ElementSpec => ({
  type: 'heading',
  attributes: { subType, content },
  ...(css ? { css } : {})
});

const container = (children: ElementSpec[], css?: ElementSpec['css']): ElementSpec => ({
  type: 'container',
  attributes: { subType: 'div' },
  children,
  ...(css ? { css } : {})
});

const minimal = (overrides: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Test Space',
  permanentUrl: 'test-space',
  pages: [
    {
      name: 'Home',
      slug: '',
      seoTitle: 'Home — Test',
      seoDescription: 'A description.',
      css: { desktop: { display: 'flex' } },
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

  it('gives every element a unique name, numbered per type', () => {
    const { schema } = authorSpace(minimal());
    const refs = Object.values(schema.flat).map(element => element.id);

    expect(refs).toEqual(['page-1', 'container-1', 'heading-1']);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('takes the name an element names, so a binding can address it by name', () => {
    const { schema } = authorSpace({
      name: 'Named',
      permanentUrl: 'named',
      pages: [
        {
          name: 'Home',
          slug: '',
          id: 'home',
          body: [{ type: 'apiContainer', id: 'posts', attributes: {} }, text('hi')]
        }
      ]
    });

    // The named one keeps its name; the unnamed one is still numbered per type, and the two do not collide.
    expect(Object.values(schema.flat).map(element => element.id)).toEqual(['home', 'posts', 'text-1']);
  });

  it('refuses two elements answering to one name instead of dropping the second', () => {
    // FlatMap declines the insert and says so with `false`; ignoring that answer authored a page whose second
    // element was simply not there, with nothing anywhere reporting it.
    expect(() =>
      authorSpace({
        name: 'Clashing',
        permanentUrl: 'clashing',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              { type: 'apiContainer', id: 'posts', attributes: {} },
              { type: 'list', id: 'posts', attributes: {} }
            ]
          }
        ]
      })
    ).toThrow(/posts/);
  });

  it('carries the schema settings and the RSC switch a space declared', () => {
    const { schema } = authorSpace({
      name: 'Served',
      permanentUrl: 'served',
      customCss: '.a{}',
      settings: { userProvider: 'basic', loginUrl: '/auth/login' },
      rsc: { enabled: true },
      pages: [{ name: 'Home', slug: '', body: [text('hi')] }]
    });

    expect(schema.settings).toEqual({ customCss: '.a{}', userProvider: 'basic', loginUrl: '/auth/login' });
    expect(schema.rsc).toEqual({ enabled: true });
    // Absent unless asked for: an empty `rsc` key is a switch somebody has to read the default of.
    expect(authorSpace(minimal()).schema.rsc).toBeUndefined();
  });

  it('dresses an element part through the class a slot names', () => {
    const { schema } = authorSpace({
      name: 'Slotted',
      permanentUrl: 'slotted',
      classes: { field: { desktop: { width: '100%' } } },
      pages: [
        {
          name: 'Home',
          slug: '',
          class: 'field',
          body: [{ type: 'formControl', slots: { input: 'field' }, attributes: { name: 'title' } }]
        }
      ]
    });

    const page = schema.flat[schema.pages[0]];
    const control = schema.flat[(page.definition.items ?? [])[0]];

    // The page took the shared class instead of minting one; the control kept a base of its own and named the
    // shared class for its input, which is the selector the rule has to land on.
    expect(page.definition.styleSelectors.base).toBe('field');
    expect(control.definition.styleSelectors.input).toBe('field');
    expect(control.definition.styleSelectors.base).not.toBe('field');
  });

  it('authors two pages that share a slug, which is how sign-in and the page behind it live on one path', () => {
    const { schema } = authorSpace({
      name: 'Paired',
      permanentUrl: 'paired',
      pages: [
        { name: 'Sign in', slug: 'login', accessLevel: 'public', body: [text('sign in')] },
        { name: 'Account', slug: 'login', accessLevel: 'authenticated', body: [text('hello')] }
      ]
    });

    // Both pages, both their children: derived from the slug alone the second page duplicated every id in the
    // first and was refused element by element.
    expect(schema.pages).toHaveLength(2);
    expect(new Set(schema.pages).size).toBe(2);
    expect(Object.keys(schema.flat)).toHaveLength(4);
  });

  it('leaves a page unrestricted unless an access level was asked for', () => {
    // `public` is not "for everyone" — it is the signed-out half of an access-controlled pair, so a lone public
    // page disappears from the route table for anyone with a session and the space answers 403 to its own owner.
    const { schema } = authorSpace(minimal());
    expect(schema.flat[schema.pages[0]].attributes.accessLevel).toBeUndefined();

    const gated = authorSpace({
      name: 'Gated',
      permanentUrl: 'gated',
      pages: [{ name: 'Members', slug: '', accessLevel: 'authenticated', body: [text('hi')] }]
    });

    expect(gated.schema.flat[gated.schema.pages[0]].attributes.accessLevel).toBe('authenticated');
  });

  it('turns a redirect destination into the pair the router reads', () => {
    const { schema } = authorSpace({
      name: 'Gated',
      permanentUrl: 'gated',
      pages: [
        {
          name: 'Members',
          slug: 'members',
          accessLevel: 'authenticated',
          unauthorizedRedirect: 'login',
          body: [text('hi')]
        },
        { name: 'Sign in', slug: 'login', accessLevel: 'public', body: [text('in')] }
      ]
    });

    const members = schema.flat[schema.pages[0]];

    expect(members.attributes.unauthorizedBehaviour).toBe('redirect');
    expect(members.attributes.unauthorizedPageRedirect).toBe('login');
    // Absent unless asked for: a page with no destination is answered 403, which is a different behaviour.
    expect(schema.flat[schema.pages[1]].attributes.unauthorizedBehaviour).toBeUndefined();
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
            { type: 'link', attributes: { href: '#a' }, class: 'btn' },
            { type: 'link', attributes: { href: '#b' }, class: 'btn' }
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
  const steps = authorFlow([
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

  it('registers each step on the name it names, and defaults the rest', () => {
    expect(nodes.map(node => node.elementId)).toEqual(['button-1', 'auth', 'container-1']);
    expect(nodes[0].title).toBe('onClick');
    expect(nodes[0].enabled).toBe(true);
    expect(nodes[1].params).toEqual({ mode: 'token' });
  });

  it('takes the id a step names, so a later step can read its result', () => {
    // The scope of a running flow is keyed by node id. A derived id is unique and unwritable, so a step whose
    // result is interpolated further down has to be named.
    const named = authorFlow([
      { type: 'trigger', action: 'onSubmit', on: 'form-1' },
      { id: 'publish', type: 'globalCallback', action: 'runServerAction', on: 'actions' },
      { type: 'globalCallback', action: 'navigate', on: 'navigation', params: { url: '{{publish.output.url}}' } }
    ]);
    const nodes = Object.values(named);

    expect(nodes[1].id).toBe('publish');
    expect(nodes[0].afterNode).toBe('publish');
    expect(nodes[2].beforeNode).toBe('publish');
    expect(new Set(nodes.map(node => node.flowId))).toEqual(new Set([nodes[0].id]));
  });

  it('registers a utility on no element at all', () => {
    const [utility] = Object.values(authorFlow([{ type: 'utility', action: 'delay' }]));

    expect(utility.elementId).toBeNull();
  });
});

describe('authorBinding', () => {
  it('fills the fields the runtime needs but nobody chooses', () => {
    const binding = authorBinding(0, { to: 'items', source: 'apiContainer_products-1.data' });

    expect(binding).toMatchObject({ to: 'items', source: 'apiContainer_products-1.data', transformers: [] });
    // Element-local, so it reads as what it targets and where it sits rather than as an opaque handle.
    expect(binding.id).toBe('attributes-1');
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
              bind: [
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


describe('authorSpace / what it refuses', () => {
  it('expands the shorthands an author writes, so the style editor can read the result back', () => {
    const { schema, style } = authorSpace({
      name: 'Short',
      permanentUrl: 'short',
      pages: [{ name: 'Home', slug: '', body: [container([], { padding: '96px 24px', gap: '8px' })] }]
    });

    const boxId = schema.flat[schema.pages[0]].definition.items?.[0] as string;
    const selector = schema.flat[boxId].definition.styleSelectors.base;

    expect(style.platform.desktop[selector].attributes.base.default).toEqual({
      'padding-top': '96px',
      'padding-right': '24px',
      'padding-bottom': '96px',
      'padding-left': '24px',
      'row-gap': '8px',
      'column-gap': '8px'
    });
  });

  it('reads a bare rule set as the desktop breakpoint', () => {
    const { schema, style } = authorSpace({
      name: 'Bare',
      permanentUrl: 'bare-css',
      pages: [{ name: 'Home', slug: '', body: [text('hi', { color: 'red' })] }]
    });

    const textId = schema.flat[schema.pages[0]].definition.items?.[0] as string;
    const selector = schema.flat[textId].definition.styleSelectors.base;

    expect(style.platform.desktop[selector].attributes.base.default).toEqual({ color: 'red' });
    expect(style.platform.mobile[selector]).toBeUndefined();
  });

  it('refuses a property the style editor could not read back', () => {
    expect(() =>
      authorSpace({
        name: 'Typo',
        permanentUrl: 'typo',
        pages: [{ name: 'Home', slug: '', body: [text('hi', { paddingTop: '8px' })] }]
      })
    ).toThrow(/paddingTop.*padding-top/);
  });

  it('refuses an element that asks for a shared class and rules of its own at once', () => {
    // One base selector per element: keeping the class and dropping the rules is what it used to do, silently.
    expect(() =>
      authorSpace({
        name: 'Both',
        permanentUrl: 'both',
        classes: { card: { padding: '8px' } },
        pages: [{ name: 'Home', slug: '', body: [{ type: 'text', class: 'card', css: { color: 'red' } }] }]
      })
    ).toThrow(/one base selector/);
  });

  it('names the class an author probably meant when the one they wrote does not exist', () => {
    expect(() =>
      authorSpace({
        name: 'Typo',
        permanentUrl: 'class-typo',
        classes: { card: { padding: '8px' } },
        pages: [{ name: 'Home', slug: '', body: [{ type: 'text', class: 'crad' }] }]
      })
    ).toThrow(/"crad".*did you mean "card"/);
  });

  it('refuses a slot pointing at a class nothing declares', () => {
    expect(() =>
      authorSpace({
        name: 'Slot',
        permanentUrl: 'slot-typo',
        classes: { field: { width: '100%' } },
        pages: [{ name: 'Home', slug: '', body: [{ type: 'formControl', slots: { input: 'fields' } }] }]
      })
    ).toThrow(/Slot "input".*"fields"/);
  });

  /**
   * The resolution only happens when the caller supplied the catalog, which is what the composed entry does. A
   * space authored straight from this package writes its sources as declared — the fragment has to stay usable on
   * documents whose element library nobody here knows.
   */
  it('resolves a source that named the name alone, when it was told what publishes one', () => {
    const { schema } = authorSpace(
      {
        name: 'Bound',
        permanentUrl: 'relative-source',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              { type: 'apiContainer', id: 'posts', attributes: { action: 'list' } },
              { type: 'text', bind: { content: 'posts.title' } }
            ]
          }
        ]
      },
      { sourceTypes: { apiContainer: 'apiContainer' } }
    );

    const bound = Object.values(schema.flat).find(element => element.definition.bindings?.attributes);

    expect(bound?.definition.bindings?.attributes?.[0].source).toBe('apiContainer_posts.title');
  });

  it('refuses a name that shadows a global data source', () => {
    expect(() =>
      authorSpace(
        {
          name: 'Shadow',
          permanentUrl: 'shadow',
          pages: [{ name: 'Home', slug: '', body: [{ type: 'apiContainer', id: 'state' }] }]
        },
        { sourceTypes: { apiContainer: 'apiContainer' } }
      )
    ).toThrow(/one of the global data sources/);
  });

  it('refuses a binding whose source names an element that is not there', () => {
    // The quietest failure a space can carry: the binding resolves to nothing, the element renders its
    // placeholder, and every layer below considers the document perfectly valid.
    expect(() =>
      authorSpace({
        name: 'Bound',
        permanentUrl: 'bad-source',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              { type: 'apiContainer', id: 'posts', attributes: { action: 'list' } },
              { type: 'text', bind: { content: 'apiContainer_post.title' } }
            ]
          }
        ]
      })
    ).toThrow(/no element answers to the name/);
  });

  it('takes the short binding form, and lets a full one target element state', () => {
    const { schema } = authorSpace({
      name: 'Bound',
      permanentUrl: 'bound-ok',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            { type: 'apiContainer', id: 'posts', attributes: { action: 'list' } },
            { type: 'text', bind: { content: 'apiContainer_posts.title' } },
            { type: 'text', bind: [visibleWhen('apiContainer_posts.hasPosts')] }
          ]
        }
      ]
    });

    const [, short, state] = (schema.flat[schema.pages[0]].definition.items ?? []).map(id => schema.flat[id]);

    expect(short.definition.bindings?.attributes?.[0]).toMatchObject({
      to: 'content',
      source: 'apiContainer_posts.title'
    });
    expect(state.definition.bindings?.initialState?.[0]).toMatchObject({ to: 'visibility' });
  });

  it('names the element in the builder tree, without shadowing an attribute called label', () => {
    const { schema } = authorSpace({
      name: 'Labelled',
      permanentUrl: 'labelled',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [{ type: 'link', attributes: { href: '/', label: 'Home' }, meta: { label: 'Brand link' } }]
        }
      ]
    });

    const link = schema.flat[(schema.flat[schema.pages[0]].definition.items ?? [])[0]];

    expect(link.attributes.label).toBe('Home');
    expect(link.definition.label).toBe('Brand link');
  });

  it('hands back what was survivable rather than swallowing it', () => {
    const { warnings } = authorSpace(minimal());

    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe('validateSpace', () => {
  it('accepts what authorSpace produced', () => {
    const authored = authorSpace(minimal());

    expect(validateSpace(authored).valid).toBe(true);
  });

  it('reports a style rule nobody could edit, wherever in the style it sits', () => {
    const authored = authorSpace(minimal());
    authored.style.platform.desktop.rogue = {
      name: 'rogue',
      type: 'class',
      // The cast is the test: a property outside the vocabulary is exactly what the compiler cannot catch in a
      // document that arrived as JSON, and what the validator has to.
      attributes: { base: { default: { 'font-smoothing': 'antialiased' } as StyleObject } },
      cache: ''
    };

    const { valid, errors } = validateSpace(authored);

    expect(valid).toBe(false);
    expect(errors[0].code).toBe('UNKNOWN_CSS_PROPERTY');
  });

  it('reports a flow whose chain points at a node that is not there', () => {
    const authored = authorSpace(minimal());
    const page = authored.schema.flat[authored.schema.pages[0]];
    page.definition.interactions = {
      a: {
        id: 'a',
        title: 'onClick',
        type: 'trigger',
        action: 'onClick',
        params: {},
        preview: {},
        elementId: null,
        beforeNode: '',
        afterNode: 'gone',
        flowId: 'a',
        enabled: true
      }
    };

    expect(validateSpace(authored).errors.map(error => error.code)).toContain('BROKEN_FLOW_LINK');
  });
});

describe('authorSpace / flows', () => {
  it('fires a trigger on the element it was declared on, without being told twice', () => {
    const { schema } = authorSpace({
      name: 'Flowed',
      permanentUrl: 'flowed',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            {
              type: 'button',
              id: 'cta',
              attributes: { content: 'Go' },
              flows: [
                [
                  { type: 'trigger', action: 'onClick' },
                  { type: 'globalCallback', action: 'setState', on: 'state', params: { key: 'gone', value: true } },
                  { type: 'utility', action: 'delayTime', params: { time: 200 } },
                  { type: 'callback', action: 'setState', params: { category: 'attribute', key: 'content' } }
                ]
              ]
            }
          ]
        }
      ]
    });

    const button = schema.flat[(schema.flat[schema.pages[0]].definition.items ?? [])[0]];
    const nodes = Object.values(button.definition.interactions ?? {});

    // The trigger and the element callback run against this element; the global callback names its source module,
    // and the utility runs against nothing at all.
    expect(nodes.map(node => node.elementId)).toEqual(['cta', 'state', null, 'cta']);
  });
});
