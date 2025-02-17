import Container from './Container';

Container.content = {
  attributes: {
    subType: 'div'
  },
  definition: {
    label: 'Container',
    type: 'container',
    description: 'Group things together into groups, also nestable.',
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
    category: 'structure',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: 'fa-regular fa-square'
  },
  defaultStyle: {
    name: 'Container',
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

Container.type = 'container';

export default Container;
