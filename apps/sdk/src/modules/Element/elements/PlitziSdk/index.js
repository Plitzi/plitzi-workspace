// Relatives
import PlitziSdk from './PlitziSdk';

PlitziSdk.content = {
  attributes: {
    spaceId: '',
    spaceKey: '',
    environment: 'main'
  },
  definition: {
    label: 'Plitzi Sdk',
    type: 'plitziSdk',
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
    name: 'Plitzi Sdk',
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

PlitziSdk.type = 'plitziSdk';

export default PlitziSdk;
