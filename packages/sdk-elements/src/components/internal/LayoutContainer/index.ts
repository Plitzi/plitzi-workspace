import LayoutContainer from './LayoutContainer';

LayoutContainer.content = {
  attributes: {
    subType: 'div'
  },
  definition: {
    label: 'Layout Container',
    type: 'layoutContainer',
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
    canDragDrop: false,
    canMove: true,
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  defaultStyle: {
    name: 'Layout Container',
    displayMode: 'desktop',
    style: {},
    subTypes: {}
  },
  settings: {}
};

LayoutContainer.type = 'layoutContainer';

export default LayoutContainer;
