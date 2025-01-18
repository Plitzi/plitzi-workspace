// Relatives
import Page from './Page.js';

Page.content = {
  attributes: {
    enabled: true,
    name: 'Page',
    slug: '',
    folder: '',
    layout: '',
    layoutContainer: '',
    seoEnabled: false,
    seoPageTitle: 'Title',
    seoPageDescription: 'Description'
  },
  definition: {
    label: 'Page',
    type: 'page',
    description: '',
    items: [],
    bindings: {},
    styleSelectors: {
      base: ''
    },
    initialState: {
      visibility: true
    }
  },
  builder: {
    canDelete: false,
    canSelect: true,
    canDragDrop: false,
    canMove: false,
    canTemplate: true,
    itemsAllowed: [],
    itemsNotAllowed: []
  },
  market: {
    category: 'internal',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: 'fas fa-file'
  },
  defaultStyle: {
    name: 'Page',
    displayMode: 'desktop',
    style: {
      base: {
        display: 'flex',
        'flex-direction': 'column',
        'min-height': '100%',
        'min-width': '100%',
        'font-family': 'Arial',
        color: '#333',
        'font-size': '14px',
        'font-weight': 400,
        'line-height': '16px',
        'text-align': 'left',
        'background-color': '#ffffff'
      }
    }
  },
  settings: {}
};

Page.type = 'page';

export default Page;
