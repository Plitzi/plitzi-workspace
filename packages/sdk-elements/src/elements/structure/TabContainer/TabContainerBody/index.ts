import BaseTabContainerBody from './TabContainerBody';

const TabContainerBody = Object.assign(BaseTabContainerBody, {
  type: 'tabContainerBody',
  content: {
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
      itemsAllowed: ['tabContainerItem'],
      itemsNotAllowed: []
    },
    market: {
      category: 'structure',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-table-columns'
    },
    defaultStyle: {
      name: 'Tab Container Body',
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
  },
  initialItems: ['tabContainerItem', 'tabContainerItem', 'tabContainerItem']
});

export default TabContainerBody;
