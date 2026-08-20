import type { Space } from '../helpers';
import type { Operation } from '../tools';
import type { Persisters } from '../types';

const buildSpace = (): Space => {
  const schema = {
    flat: {
      page1: {
        id: 'page1',
        attributes: { slug: '', name: 'Home', default: true },
        definition: { rootId: 'page1', label: 'Page', type: 'page', items: ['c1'], styleSelectors: { base: 'page-x' } }
      },
      c1: {
        id: 'c1',
        attributes: { subType: 'div', title: 'Box' },
        definition: {
          rootId: 'page1',
          parentId: 'page1',
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
    pages: ['page1'],
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
  (space.schema.flat.page1.attributes as Record<string, unknown>).slug = ':spaceId';

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
      page1: {
        id: 'page1',
        attributes: { slug: '', name: 'Home', default: true },
        definition: {
          rootId: 'page1',
          label: 'Page',
          type: 'page',
          items: ['api1', 'outsider'],
          styleSelectors: { base: 'p' }
        }
      },
      api1: {
        id: 'api1',
        idRef: 'products',
        attributes: {},
        definition: {
          rootId: 'page1',
          parentId: 'page1',
          label: 'Api',
          type: 'apiContainer',
          items: ['inner'],
          styleSelectors: { base: 'a' }
        }
      },
      inner: {
        id: 'inner',
        idRef: 'inner-text',
        attributes: { content: '' },
        definition: {
          rootId: 'page1',
          parentId: 'api1',
          label: 'Inner',
          type: 'text',
          items: [],
          styleSelectors: { base: 't' }
        }
      },
      outsider: {
        id: 'outsider',
        idRef: 'out-text',
        attributes: { content: '' },
        definition: {
          rootId: 'page1',
          parentId: 'page1',
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
    pages: ['page1'],
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
      page1: {
        id: 'page1',
        attributes: { slug: '', name: 'Home', default: true },
        definition: { rootId: 'page1', label: 'Page', type: 'page', items: ['txt'], styleSelectors: { base: 'p' } }
      },
      txt: {
        id: 'txt',
        idRef: 'txt',
        attributes: { content: '' },
        definition: {
          rootId: 'page1',
          parentId: 'page1',
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
    pages: ['page1'],
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
