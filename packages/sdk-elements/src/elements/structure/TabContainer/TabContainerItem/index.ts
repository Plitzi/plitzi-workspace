import BaseTabContainerItem from './TabContainerItem';

const TabContainerItem = Object.assign(BaseTabContainerItem, {
  type: 'tabContainerItem',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Item',
      type: 'tabContainerItem',
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
      itemsNotAllowed: ['tabContainerItem', 'tabContainerHeader', 'tabContainerBody']
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
      name: 'Tab Container Item',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'min-width': '50px',
            'min-height': '50px'
          }
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default TabContainerItem;
