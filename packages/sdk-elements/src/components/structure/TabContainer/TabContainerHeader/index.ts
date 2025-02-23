import BaseTabContainerHeader from './TabContainerHeader';

const TabContainerHeader = Object.assign(BaseTabContainerHeader, {
  type: 'tabContainerHeader',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Header',
      type: 'tabContainerHeader',
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
      name: 'Tab Container Header',
      displayMode: 'desktop',
      style: {},
      subTypes: {}
    },
    settings: {}
  },
  initialItems: ['tabContainerItem', 'tabContainerItem', 'tabContainerItem']
});

export default TabContainerHeader;
