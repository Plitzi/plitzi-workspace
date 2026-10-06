import { describe, expect, it } from 'vitest';

import { buildUsageIndex, isUnused, usageIndexOf } from './usageIndex';

import type { UsageIndex, UsageSource } from './usageIndex';
import type { Element, ElementDefinition, Schema, Style, StyleItem } from '@plitzi/sdk-shared';

type ElementInit = {
  type?: string;
  parentId?: string;
  rootId?: string;
  attributes?: Element['attributes'];
  definition?: Partial<ElementDefinition>;
};

const element = (id: string, { type = 'container', parentId, rootId, attributes = {}, definition }: ElementInit = {}) =>
  ({
    id,
    attributes,
    definition: {
      label: id,
      type,
      rootId: rootId ?? id,
      ...(parentId ? { parentId } : {}),
      items: [],
      styleSelectors: { base: '' },
      ...definition
    }
  }) satisfies Element;

const flatOf = (...elements: Element[]): Schema['flat'] => Object.fromEntries(elements.map(item => [item.id, item]));

const classItem = (name: string, attributes: StyleItem['attributes'] = {}): StyleItem => ({
  name,
  type: 'class',
  attributes,
  cache: ''
});

type Fixture = {
  flat?: Schema['flat'];
  components?: Schema['components'];
  variables?: Schema['variables'];
  computed?: Schema['settings']['computed'];
  customCss?: string;
  stylePlatform?: Style['platform'];
  styleVariables?: Style['variables'];
  providerTypes?: Record<string, string>;
};

const source = (fixture: Fixture = {}): UsageSource => ({
  schema: {
    definition: { name: 'fixture', permanentUrl: 'fixture' },
    flat: fixture.flat ?? {},
    components: fixture.components ?? {},
    variables: fixture.variables ?? [],
    settings: { customCss: fixture.customCss ?? '', computed: fixture.computed },
    pages: [],
    pageFolders: []
  },
  style: {
    platform: fixture.stylePlatform ?? { desktop: {}, tablet: {}, mobile: {} },
    variables: fixture.styleVariables ?? {}
  },
  providerTypes: fixture.providerTypes
});

const item = (index: UsageIndex, category: keyof UsageIndex, key: string) => {
  const found = index[category].find(candidate => candidate.key === key);
  if (!found) {
    throw new Error(`${key} is not in ${category}`);
  }

  return found;
};

const elementIds = (index: UsageIndex, category: keyof UsageIndex, key: string): string[] =>
  item(index, category, key).elements.map(usage => usage.elementId);

const home = element('home', { type: 'page' });
const layout = element('shell', { type: 'layoutContainer' });

describe('buildUsageIndex — components', () => {
  const components: Schema['components'] = {
    card: {
      id: 'card',
      label: 'Card',
      rootId: 'card-root',
      flat: flatOf(element('card-root', { rootId: 'card-root' }))
    },
    shelf: {
      id: 'shelf',
      rootId: 'shelf-root',
      flat: flatOf(
        element('shelf-root'),
        element('shelf-card', {
          type: 'reference',
          parentId: 'shelf-root',
          rootId: 'shelf-root',
          attributes: { referenceType: 'component', referenceId: 'card' }
        })
      )
    },
    lonely: { id: 'lonely', rootId: 'lonely-root', flat: flatOf(element('lonely-root')) }
  };

  it('lists the instances of each component in every tree, with the tree each is in', () => {
    const flat = flatOf(
      home,
      element('hero', { parentId: 'home', rootId: 'home' }),
      element('lamp', {
        type: 'reference',
        parentId: 'hero',
        rootId: 'home',
        attributes: { referenceType: 'component', referenceId: 'card' }
      })
    );
    const index = buildUsageIndex(source({ flat, components }));
    const card = item(index, 'components', 'component:card');

    expect(card.name).toBe('Card');
    expect(card.owner?.elementId).toBe('card-root');
    expect(card.elements.map(usage => [usage.elementId, usage.tree.kind, usage.tree.id])).toEqual([
      ['lamp', 'page', 'home'],
      ['shelf-card', 'component', 'shelf']
    ]);
    expect(isUnused(item(index, 'components', 'component:lonely'))).toBe(true);
    expect(isUnused(item(index, 'components', 'component:shelf'))).toBe(true);
  });

  /** While a component is open the builder lays its tree over the pages': its elements still belong to it. */
  it('counts an open component’s elements once, as the component’s', () => {
    const flat = { ...flatOf(home), ...components.shelf.flat };
    const index = buildUsageIndex(source({ flat, components }));

    expect(item(index, 'components', 'component:card').elements.map(usage => usage.tree)).toEqual([
      { kind: 'component', id: 'shelf', label: 'shelf' }
    ]);
  });
});

describe('buildUsageIndex — classes', () => {
  it('lists the elements wearing each class in any slot, state or step, and the classes nobody wears', () => {
    const flat = flatOf(
      home,
      layout,
      element('title', { parentId: 'home', definition: { styleSelectors: { base: 'heading  big', icon: 'muted' } } }),
      element('nav', { parentId: 'shell', definition: { initialState: { styleSelectors: { base: 'heading' } } } }),
      element('toggle', {
        parentId: 'home',
        definition: {
          bindings: {
            initialState: [
              {
                id: 'b1',
                source: 'state.open',
                to: 'styleSelectors.base',
                transformers: [{ action: 'styleSelector', params: { selector: 'open-state', append: true } }]
              }
            ]
          }
        }
      })
    );
    const stylePlatform = {
      desktop: { heading: classItem('heading'), big: classItem('big'), muted: classItem('muted') },
      tablet: { 'open-state': classItem('open-state'), ghost: classItem('ghost') },
      mobile: { ghost: classItem('ghost') }
    };
    const index = buildUsageIndex(source({ flat, stylePlatform }));

    expect(elementIds(index, 'classes', 'class:heading')).toEqual(['title', 'nav']);
    expect(item(index, 'classes', 'class:heading').elements[1].tree).toEqual({
      kind: 'layout',
      id: 'shell',
      label: 'shell'
    });
    expect(elementIds(index, 'classes', 'class:muted')).toEqual(['title']);
    expect(elementIds(index, 'classes', 'class:open-state')).toEqual(['toggle']);
    expect(item(index, 'classes', 'class:ghost').detail).toBe('tablet, mobile');
    expect(index.classes.filter(isUnused).map(unused => unused.name)).toEqual(['ghost']);
  });
});

describe('buildUsageIndex — variables', () => {
  const styleVariables = {
    color: { brand: { light: '#000', dark: '#fff' }, accent: 'var(--brand)', unused: '#f00' },
    spacing: { gap: '8px', pad: '4px' }
  };
  const variables: Schema['variables'] = [
    { name: 'apiUrl', category: 'general', type: 'text', value: 'https://x', subValues: [] },
    { name: 'logo', category: 'general', type: 'text', value: 'a.png', subValues: [] },
    { name: 'lost', category: 'general', type: 'text', value: '', subValues: [] }
  ];

  it('follows a token through the selectors that read it to the elements they dress', () => {
    const flat = flatOf(
      home,
      element('cta', { type: 'button', parentId: 'home', definition: { styleSelectors: { base: 'btn' } } }),
      element('plain', { type: 'button', parentId: 'home' }),
      element('icon', { type: 'svg', parentId: 'home', attributes: { fill: 'var(--accent, red)' } })
    );
    const stylePlatform = {
      desktop: {
        btn: classItem('btn', {
          base: { default: { color: 'var(--brand)' }, states: { hover: { 'row-gap': 'var(--gap)' } } }
        }),
        button: {
          name: 'button',
          type: 'element',
          attributes: { base: { default: { 'padding-top': 'var(--pad)' } } },
          cache: ''
        } satisfies StyleItem
      },
      tablet: {},
      mobile: {}
    };
    const index = buildUsageIndex(
      source({ flat, variables, stylePlatform, styleVariables, customCss: 'a { color: var(--apiUrl) }' })
    );

    expect(item(index, 'variables', 'token:color:brand').elements).toEqual([
      {
        elementId: 'cta',
        elementType: 'button',
        label: undefined,
        tree: { kind: 'page', id: 'home', label: 'home' },
        via: ['var(--brand) in .btn']
      }
    ]);
    expect(item(index, 'variables', 'token:color:brand').references).toEqual([
      { kind: 'selector', name: '.btn' },
      { kind: 'variable', name: '--accent' }
    ]);
    expect(elementIds(index, 'variables', 'token:spacing:gap')).toEqual(['cta']);
    expect(elementIds(index, 'variables', 'token:spacing:pad')).toEqual(['cta', 'plain']);
    expect(elementIds(index, 'variables', 'token:color:accent')).toEqual(['icon']);
    expect(item(index, 'variables', 'variable:apiUrl').references).toEqual([{ kind: 'customCss', name: 'Custom CSS' }]);
    expect(isUnused(item(index, 'variables', 'token:color:unused'))).toBe(true);
  });

  it('finds a space variable read by a binding, a template by either name, and a style token', () => {
    const flat = flatOf(
      home,
      element('img', { type: 'image', parentId: 'home', attributes: { src: '{{ logo }}' } }),
      element('fetch', { type: 'apiContainer', parentId: 'home', attributes: { url: '{{ variables.apiUrl }}/items' } }),
      element('text', {
        parentId: 'home',
        definition: { bindings: { attributes: [{ id: 'b', source: 'variables.logo', to: 'content' }] } }
      })
    );
    const stylePlatform = {
      desktop: { hero: classItem('hero', { base: { default: { 'background-image': 'url({{ logo }})' } } }) },
      tablet: {},
      mobile: {}
    };
    const index = buildUsageIndex(source({ flat, variables, stylePlatform }));

    expect(item(index, 'variables', 'variable:logo').elements.map(usage => [usage.elementId, usage.via])).toEqual([
      ['img', ['logo']],
      ['text', ['variables.logo']]
    ]);
    expect(item(index, 'variables', 'variable:logo').references).toEqual([{ kind: 'selector', name: '.hero' }]);
    expect(elementIds(index, 'variables', 'variable:apiUrl')).toEqual(['fetch']);
    expect(isUnused(item(index, 'variables', 'variable:lost'))).toBe(true);
  });
});

describe('buildUsageIndex — data sources', () => {
  it('lists each provider with what reads it, the globals read, and providers nothing reads', () => {
    const flat = flatOf(
      home,
      element('products', { type: 'apiContainer', parentId: 'home' }),
      element('orphan', { type: 'apiContainer', parentId: 'home' }),
      element('rows', { type: 'list', parentId: 'products' }),
      element('name', {
        parentId: 'rows',
        attributes: { content: '{{ list_rows.item.name|upper }}' },
        definition: {
          bindings: {
            attributes: [
              {
                id: 'b',
                source: 'apiContainer_products.data',
                to: 'items',
                transformers: [
                  { action: 'twigTemplate', params: { template: '{{ source|length }} {{ state.page }}' } }
                ],
                when: { combinator: 'and', rules: [{ field: 'flags.beta', operator: '=', value: true }] }
              }
            ]
          },
          interactions: {
            click: {
              id: 'click',
              title: 'Go',
              type: 'callback',
              action: 'setState',
              params: { value: '{{ apiContainer_products.data.0.id }}' },
              preview: {},
              elementId: 'name',
              beforeNode: '',
              afterNode: '',
              flowId: 'f',
              enabled: true
            }
          }
        }
      })
    );
    const index = buildUsageIndex(
      source({ flat, computed: { total: '{{ state.cart|length }}' }, providerTypes: { apiContainer: 'apiContainer' } })
    );

    expect(index.dataSources.map(entry => entry.key)).toEqual([
      'source:apiContainer_orphan',
      'source:apiContainer_products',
      'source:list_rows',
      'source:flags',
      'source:state'
    ]);
    expect(item(index, 'dataSources', 'source:apiContainer_products').elements).toEqual([
      expect.objectContaining({
        elementId: 'name',
        via: ['apiContainer_products.data', 'apiContainer_products.data.0.id']
      })
    ]);
    expect(item(index, 'dataSources', 'source:apiContainer_products').owner?.elementId).toBe('products');
    expect(item(index, 'dataSources', 'source:list_rows').detail).toBe('list');
    expect(item(index, 'dataSources', 'source:state').references).toEqual([
      { kind: 'computed', name: 'computed.total' }
    ]);
    expect(isUnused(item(index, 'dataSources', 'source:apiContainer_orphan'))).toBe(true);
    expect(index.dataSources.some(entry => entry.name === 'source')).toBe(false);
  });
});

describe('usageIndexOf', () => {
  it('answers the same document with the same index, and a changed one with a new index', () => {
    const first = source({ flat: flatOf(home) });

    expect(usageIndexOf(first)).toBe(usageIndexOf({ ...first }));
    expect(usageIndexOf(first)).not.toBe(
      usageIndexOf({ ...first, schema: { ...first.schema, flat: flatOf(home, element('x', { parentId: 'home' })) } })
    );
  });

  it('builds a space of thousands of elements quickly', () => {
    const elements: Element[] = [home];
    for (let index = 0; index < 5000; index += 1) {
      elements.push(
        element(`el-${String(index)}`, {
          parentId: index % 10 === 0 ? 'home' : `el-${String(index - (index % 10))}`,
          attributes: { content: `{{ state.items.${String(index)} }} {{ apiContainer_api.data }}` },
          definition: { styleSelectors: { base: `c-${String(index % 50)}` } }
        })
      );
    }

    const desktop = Object.fromEntries(
      Array.from({ length: 50 }, (_, index) => [
        `c-${String(index)}`,
        classItem(`c-${String(index)}`, { base: { default: { color: 'var(--brand)' } } })
      ])
    );
    const big = source({
      flat: flatOf(...elements),
      stylePlatform: { desktop, tablet: {}, mobile: {} },
      styleVariables: { color: { brand: '#000' } }
    });
    const started = performance.now();
    const index = buildUsageIndex(big);
    const elapsed = performance.now() - started;

    expect(item(index, 'variables', 'token:color:brand').elements).toHaveLength(5000);
    expect(elapsed).toBeLessThan(2000);
  });
});
