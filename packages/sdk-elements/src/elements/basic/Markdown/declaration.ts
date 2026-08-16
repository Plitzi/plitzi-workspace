/** Static declaration for Markdown: type, default attributes and builder metadata. Data only, no React. */
const declaration = {
  type: 'markdown',
  content: {
    attributes: {
      content: 'Markdown'
    },
    definition: {
      label: 'Markdown',
      type: 'markdown',
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
      category: 'basic',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-brands fa-markdown'
    },
    defaultStyle: {
      name: 'Markdown',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'font-size': '14px',
            'line-height': '24px'
          }
        }
      }
    },
    settings: {}
  }
};

export default declaration;
