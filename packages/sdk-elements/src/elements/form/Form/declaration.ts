/** Static declaration for Form: type, default attributes and builder metadata. Data only, no React. */
const declaration = {
  type: 'form',
  content: {
    attributes: {
      method: 'get',
      actionUrl: '',
      managedByInteractions: false,
      errors: {},
      values: {}
    },
    definition: {
      label: 'Form',
      type: 'form',
      description: '',
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
      category: 'form',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee'
    },
    defaultStyle: {
      name: 'Form',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
};

export default declaration;
