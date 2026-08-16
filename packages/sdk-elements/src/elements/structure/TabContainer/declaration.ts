/** Static declaration for TabContainer: type, default attributes and builder metadata. Data only, no React. */
const declaration = {
  type: 'tabContainer',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container',
      type: 'tabContainer',
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
      icon: 'fa-solid fa-table-columns'
    },
    defaultStyle: {
      name: 'Tab Container',
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
  },
  initialItems: ['tabContainerHeader', 'tabContainerBody']
};

export default declaration;
