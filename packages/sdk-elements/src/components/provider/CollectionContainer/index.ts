import CollectionContainer from './CollectionContainer';

CollectionContainer.content = {
  attributes: {
    limit: '10',
    query: '',
    source: undefined,
    singleRecord: false
  },
  definition: {
    label: 'Collection Container',
    type: 'collectionContainer',
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
    icon: 'fa-solid fa-database'
  },
  defaultStyle: {
    name: 'Collection Container',
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

CollectionContainer.type = 'collectionContainer';
CollectionContainer.plugins = {};

export default CollectionContainer;
