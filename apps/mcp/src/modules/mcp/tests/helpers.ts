import type { Space } from '../helpers';
import type { Operation } from '../tools';
import type { Persisters } from '../types';

const buildSpace = (): Space => {
  const schema = {
    flat: {
      home: {
        id: 'home',
        attributes: { slug: '', name: 'Home', default: true },
        definition: { rootId: 'home', label: 'Page', type: 'page', items: ['c1'], styleSelectors: { base: 'page-x' } }
      },
      c1: {
        id: 'c1',
        attributes: { subType: 'div', title: 'Box' },
        definition: {
          rootId: 'home',
          parentId: 'home',
          label: 'Container',
          type: 'container',
          items: [],
          styleSelectors: { base: 'box' }
        }
      }
    },
    definition: { name: 'Test', permanentUrl: '' },
    variables: [{ name: 'apiUrl', category: 'general', type: 'text', value: 'https://api', subValues: [] }],
    settings: { customCss: '' },
    pages: ['home'],
    pageFolders: []
  };

  const style = {
    platform: {
      desktop: {
        box: {
          name: 'box',
          type: 'class',
          attributes: {
            base: { default: { display: 'flex' }, variants: { lg: { default: { 'font-size': '50px' } } } }
          },
          cache: ''
        }
      },
      tablet: {},
      mobile: {}
    },
    theme: { default: 'system', schemes: ['light', 'dark'] },
    variables: { color: { foreground: { light: '#000', dark: '#fff', default: '#000' } } },
    cache: ''
  } as unknown as Space['style'];

  return { schema, style, connectors: [], actions: [] } as Space;
};

const capturing = (space: Space): { persisters: Persisters; saved: () => Space } => {
  const state: Space = { schema: space.schema, style: space.style, connectors: space.connectors, actions: [] };

  return {
    persisters: {
      schema: schema => {
        state.schema = schema;

        return Promise.resolve();
      },
      style: style => {
        state.style = style;

        return Promise.resolve();
      },
      // Connectors persist a row at a time, so the capture mirrors that rather than replacing a document: what a
      // test asserts on is which rows were written, not that a whole store was handed over.
      saveConnector: entry => {
        state.connectors = [...state.connectors.filter(item => item.id !== entry.id), entry];

        return Promise.resolve();
      },
      deleteConnector: id => {
        state.connectors = state.connectors.filter(item => item.id !== id);

        return Promise.resolve();
      }
    },
    saved: () => state
  };
};

const spaceWithRoute = (): Space => {
  const space = buildSpace();
  (space.schema.flat.home.attributes as Record<string, unknown>).slug = ':spaceId';

  return space;
};

const varOp = (pageRef: string, type: string, value: string): Operation => ({
  type: 'upsertElement',
  pageRef,
  element: { ref: 'x', type, props: { q: value } }
});

const scopeSpace = (): Space => ({
  schema: {
    flat: {
      home: {
        id: 'home',
        attributes: { slug: '', name: 'Home', default: true },
        definition: {
          rootId: 'home',
          label: 'Page',
          type: 'page',
          items: ['products', 'out-text'],
          styleSelectors: { base: 'p' }
        }
      },
      products: {
        id: 'products',
        attributes: {},
        definition: {
          rootId: 'home',
          parentId: 'home',
          label: 'Api',
          type: 'apiContainer',
          items: ['inner-text'],
          styleSelectors: { base: 'a' }
        }
      },
      'inner-text': {
        id: 'inner-text',
        attributes: { content: '' },
        definition: {
          rootId: 'home',
          parentId: 'products',
          label: 'Inner',
          type: 'text',
          items: [],
          styleSelectors: { base: 't' }
        }
      },
      'out-text': {
        id: 'out-text',
        attributes: { content: '' },
        definition: {
          rootId: 'home',
          parentId: 'home',
          label: 'Out',
          type: 'text',
          items: [],
          styleSelectors: { base: 't' }
        }
      }
    },
    definition: { name: 'T', permanentUrl: '' },
    variables: [],
    settings: { customCss: '' },
    pages: ['home'],
    pageFolders: []
  },
  style: {
    platform: { desktop: {}, tablet: {}, mobile: {} },
    theme: { default: 'system', schemes: ['light'] },
    variables: {},
    cache: ''
  } as unknown as Space['style'],
  connectors: [],
  actions: []
});

const malformedSpace = (): Space => ({
  schema: {
    flat: {
      home: {
        id: 'home',
        attributes: { slug: '', name: 'Home', default: true },
        definition: { rootId: 'home', label: 'Page', type: 'page', items: ['txt'], styleSelectors: { base: 'p' } }
      },
      txt: {
        id: 'txt',
        attributes: { content: '' },
        definition: {
          rootId: 'home',
          parentId: 'home',
          label: 'Text',
          type: 'text',
          items: [],
          styleSelectors: { base: 't' },
          bindings: {
            attributes: [
              {
                id: 'b1',
                to: 'content',
                source: 'list_x.item.name',
                transformers: [{ action: 'template', params: { template: '{{value}}' } }]
              }
            ]
          }
        }
      }
    },
    definition: { name: 'T', permanentUrl: '' },
    variables: [],
    settings: { customCss: '' },
    pages: ['home'],
    pageFolders: []
  },
  style: {
    platform: { desktop: {}, tablet: {}, mobile: {} },
    theme: { default: 'system', schemes: ['light'] },
    variables: {},
    cache: ''
  } as unknown as Space['style'],
  connectors: [],
  actions: []
});

export { buildSpace, capturing, spaceWithRoute, varOp, scopeSpace, malformedSpace };
