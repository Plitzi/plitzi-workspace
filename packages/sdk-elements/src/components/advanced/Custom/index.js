// Relatives
import Custom from './Custom.js';

Custom.content = {
  attributes: {
    renderType: '',
    settings: '{}',
    isPlugin: false,
    pluginScope: '',
    assets: '',
    scriptUrl: ''
  },
  definition: {
    label: 'Custom',
    type: 'custom',
    description: '',
    bindings: {},
    styleSelectors: {
      base: ''
    },
    initialState: {
      visibility: true
    }
  },
  builder: {
    canDelete: true,
    canSelect: true,
    canDragDrop: true,
    canMove: true,
    canTemplate: true,
    itemsAllowed: [],
    itemsNotAllowed: []
  },
  market: {
    category: 'advanced',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  defaultStyle: {
    name: 'Custom Element',
    displayMode: 'desktop',
    style: {
      base: {
        'min-width': '50px',
        'min-height': '50px'
      }
    }
  },
  settings: {}
};

Custom.type = 'custom';

export default Custom;
