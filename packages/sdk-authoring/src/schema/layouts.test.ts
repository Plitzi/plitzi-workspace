import { describe, expect, it } from 'vitest';

import { styles } from '../style';
import { authorSpace } from './index';

import type { ElementSpec, SpaceSpec } from './index';

const text = (content: string, extra: Partial<ElementSpec> = {}): ElementSpec => ({
  type: 'text',
  attributes: { content },
  ...extra
});

const shell: NonNullable<SpaceSpec['layouts']>[number] = {
  id: 'main-layout',
  label: 'Layout Main',
  css: { display: 'flex' },
  body: [
    { type: 'container', id: 'sidebar', children: [text('nav')] },
    { type: 'container', id: 'main-slot' }
  ]
};

const withLayouts = (overrides: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Shelled',
  permanentUrl: 'shelled',
  layouts: [shell],
  pages: [
    { id: 'home', name: 'Home', slug: '', layout: { id: 'main-layout', slot: 'main-slot' }, body: [text('hello')] }
  ],
  ...overrides
});

describe('authorSpace / layouts', () => {
  it('writes a layout as a root of its own that no page lists and whose elements it roots', () => {
    const { schema } = authorSpace(withLayouts());
    const layout = schema.flat['main-layout'];

    expect(schema.pages).toEqual(['home']);
    expect(layout.definition).toMatchObject({ type: 'layoutContainer', rootId: 'main-layout', label: 'Layout Main' });
    expect(layout.definition.parentId).toBeUndefined();
    expect(layout.definition.items).toEqual(['sidebar', 'main-slot']);
    expect(schema.flat.sidebar.definition.rootId).toBe('main-layout');
    expect(schema.flat['main-slot'].definition.rootId).toBe('main-layout');
  });

  // The header and the navigation are what a suite reaches for on every page, and they live in the shell: filed
  // nowhere, `locate('sidebar')` threw and a test fell back to spelling the selector by hand.
  it('hands out the shell and its elements, filed under the layout rather than under any page', () => {
    const { handles } = authorSpace(withLayouts());

    expect(handles.element('sidebar')).toMatchObject({ pageId: 'main-layout', selector: '[data-plitzi-el="sidebar"]' });
    expect(handles.layouts['main-layout'].elements).toHaveProperty('sidebar');
    expect(handles.pages.home.elements).not.toHaveProperty('sidebar');
  });

  it('names the shell and its slot on the page, the pair the page reads', () => {
    const { schema } = authorSpace(withLayouts());

    expect(schema.flat.home.attributes).toMatchObject({ layout: 'main-layout', layoutContainer: 'main-slot' });
  });

  it('nests a layout inside another one', () => {
    const { schema } = authorSpace(
      withLayouts({
        pageFolders: [{ id: 'analytics' }],
        layouts: [
          shell,
          {
            id: 'an-layout',
            folder: 'analytics',
            layout: { id: 'main-layout', slot: 'main-slot' },
            body: [{ type: 'container', id: 'an-body' }]
          }
        ],
        pages: [{ name: 'Overview', slug: '', layout: { id: 'an-layout', slot: 'an-body' }, body: [text('x')] }]
      })
    );

    expect(schema.flat['an-layout'].attributes).toMatchObject({
      folder: 'analytics',
      layout: 'main-layout',
      layoutContainer: 'main-slot'
    });
  });

  it('refuses a layout nothing declares, and a slot that is not inside the layout', () => {
    expect(() =>
      authorSpace(
        withLayouts({ pages: [{ name: 'Home', slug: '', layout: { id: 'mian-layout', slot: 'main-slot' }, body: [] }] })
      )
    ).toThrow(/does not declare.*did you mean "main-layout"/is);

    expect(() =>
      authorSpace(
        withLayouts({
          pages: [
            { name: 'Home', slug: '', layout: { id: 'main-layout', slot: 'inner' }, body: [text('x', { id: 'inner' })] }
          ]
        })
      )
    ).toThrow(/not an element inside the layout "main-layout"/);
  });

  it('refuses a layout filed in a folder nothing declares', () => {
    expect(() => authorSpace(withLayouts({ layouts: [{ ...shell, folder: 'nowhere' }] }))).toThrow(/does not declare/);
  });

  it('produces a pair the validator accepts', () => {
    expect(authorSpace(withLayouts()).warnings).toEqual([]);
  });
});

describe('authorSpace / page state', () => {
  it('keeps the page state where the page asked for it', () => {
    const { schema } = authorSpace({
      name: 'Stateful',
      permanentUrl: 'stateful',
      pages: [{ id: 'home', name: 'Home', slug: '', keepState: true, stateStorage: 'localStorage', body: [] }]
    });

    expect(schema.flat.home.attributes).toMatchObject({ keepState: true, stateStorage: 'localStorage' });
  });
});

describe('authorSpace / states, variants and element defaults', () => {
  const spaceWith = (body: ElementSpec[], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
    name: 'Stated',
    permanentUrl: 'stated',
    pages: [{ name: 'Home', slug: '', body }],
    ...extra
  });

  it('writes a class hover and its variants into the one selector and its cache', () => {
    const card = styles('card', {
      css: { color: 'black' },
      states: { hover: { color: 'blue' } },
      variants: { active: { 'font-weight': '700' } }
    });
    const { style } = authorSpace(spaceWith([{ type: 'container', class: card }]));

    expect(style.platform.desktop.card.attributes.base).toEqual({
      default: { color: 'black' },
      states: { hover: { color: 'blue' } },
      variants: { active: { default: { 'font-weight': '700' } } }
    });
    expect(style.platform.desktop.card.cache).toBe(
      '.card{color:black;&:hover{color:blue;}&[data-variant="active"],&.card--active{font-weight:700;}}'
    );
  });

  it('writes the states of an element own rules beside them', () => {
    const { schema, style } = authorSpace(
      spaceWith([{ type: 'container', id: 'box', css: { color: 'black' }, states: { hover: { color: 'red' } } }])
    );
    const selector = schema.flat.box.definition.styleSelectors.base;

    expect(style.platform.desktop[selector].attributes.base.states).toEqual({ hover: { color: 'red' } });
  });

  it('refuses states of its own on an element that names a shared class', () => {
    expect(() =>
      authorSpace(
        spaceWith([{ type: 'container', class: 'card', states: { hover: { color: 'red' } } }], {
          classes: { card: { color: 'black' } }
        })
      )
    ).toThrow(/declares both a shared class \("card"\) and states/);
  });

  it('dresses the other selectors of an element type, with its base states', () => {
    const { style } = authorSpace(
      spaceWith([], {
        elements: {
          modalContainer: { slots: { rootContainer: { 'background-color': 'var(--card)' } } },
          button: { base: { display: 'flex' }, states: { hover: { opacity: '0.9' } } }
        }
      })
    );

    expect(style.platform.desktop.modalContainer.attributes).toEqual({
      base: { default: {} },
      rootContainer: { default: { 'background-color': 'var(--card)' } }
    });
    expect(style.platform.desktop.button.attributes.base.states).toEqual({ hover: { opacity: '0.9' } });
  });

  it('starts an element hidden with visible: false, binding nothing', () => {
    const { schema } = authorSpace(spaceWith([text('panel', { id: 'panel', visible: false })]));

    expect(schema.flat.panel.definition.initialState?.visibility).toBe(false);
    expect(schema.flat.panel.definition.bindings).toBeUndefined();
  });

  it('carries an element load strategy', () => {
    const { schema } = authorSpace(spaceWith([{ type: 'container', id: 'lazy-box', loadStrategy: 'lazy' }]));

    expect(schema.flat['lazy-box'].definition.loadStrategy).toBe('lazy');
  });
});
