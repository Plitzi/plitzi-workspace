/** Static declaration for Paragraph: type, default attributes and builder metadata. Data only, no React. */
const declaration = {
  type: 'paragraph',
  content: {
    attributes: {
      content: 'Paragraph'
    },
    definition: {
      label: 'Paragraph',
      type: 'paragraph',
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
      icon: 'fa-solid fa-paragraph'
    },
    defaultStyle: {
      name: 'Paragraph',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'margin-top': '14px',
            'margin-bottom': '14px'
          }
        }
      }
    },
    settings: {}
  }
};

export default declaration;
