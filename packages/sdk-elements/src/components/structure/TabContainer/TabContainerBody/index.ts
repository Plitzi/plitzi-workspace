import TabContainerBody from './TabContainerBody';

TabContainerBody.content = {
  attributes: {},
  definition: {
    label: 'Tab Container Body',
    type: 'tabContainerBody',
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
    canDelete: false,
    canSelect: true,
    canDragDrop: false,
    canMove: false,
    canTemplate: false,
    itemsAllowed: ['tabContainerHeader', 'tabContainerBody'],
    itemsNotAllowed: []
  },
  market: {
    category: 'structure',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: ''
  },
  defaultStyle: {
    name: 'Tab Container Body',
    displayMode: 'desktop',
    style: {},
    subTypes: {}
  },
  settings: {}
};

TabContainerBody.initialItems = ['tabContainerItem', 'tabContainerItem', 'tabContainerItem'];
TabContainerBody.type = 'tabContainerBody';

export default TabContainerBody;
