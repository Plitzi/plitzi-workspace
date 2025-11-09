import BaseLayoutContainer from './LayoutContainer';

const LayoutContainer = Object.assign(BaseLayoutContainer, {
  type: 'layoutContainer',
  content: {
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
      icon: 'fa-solid fa-border-all'
    },
    defaultStyle: {
      name: 'Layout Container',
      displayMode: 'desktop',
      style: {},
      subTypes: {}
    },
    settings: {}
  }
});

export default LayoutContainer;
