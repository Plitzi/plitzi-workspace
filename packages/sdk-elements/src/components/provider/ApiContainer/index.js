// Relatives
import ApiContainer from './ApiContainer.js';

ApiContainer.content = {
  attributes: {
    query: '',
    method: 'get',
    accessToken: '',
    mockData: '{}',
    subType: 'div'
  },
  definition: {
    label: 'Api Container',
    type: 'apiContainer',
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
    canDelete: true,
    canSelect: true,
    canDragDrop: true,
    canMove: true,
    canTemplate: true,
    itemsAllowed: [],
    itemsNotAllowed: []
  },
  market: {
    category: 'provider',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: 'fa-solid fa-server'
  },
  defaultStyle: {
    name: 'Api Container',
    displayMode: 'desktop',
    style: {
      base: {
        'min-width': '50px',
        'min-height': '50px'
      }
    },
    subTypes: {}
  },
  settings: {}
};

ApiContainer.type = 'apiContainer';

export default ApiContainer;
