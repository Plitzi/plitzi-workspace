/** Static declaration for Custom: type, default attributes and builder metadata. Data only, no React. */
const declaration = {
  type: 'custom',
  content: {
    attributes: {
      renderType: '',
      settings: '{}',
      isPlugin: false,
      pluginScope: '',
      assets: '',
      scriptUrl: ''
    },
    definition: {
      label: 'Custom',
      type: 'custom',
      description: '',
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
      icon: 'fa-solid fa-paintbrush'
    },
    defaultStyle: {
      name: 'Custom Element',
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
