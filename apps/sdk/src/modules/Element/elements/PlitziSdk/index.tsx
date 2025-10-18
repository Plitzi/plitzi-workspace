import PlitziLogo from '@plitzi/plitzi-ui/icons/PlitziLogo';

import BasePlitziSdk from './PlitziSdk';

const PlitziSdk = Object.assign(BasePlitziSdk, {
  type: 'plitziSdk',
  content: {
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
      icon: <PlitziLogo />
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
  }
});

export default PlitziSdk;
