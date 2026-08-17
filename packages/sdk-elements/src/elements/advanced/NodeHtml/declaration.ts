/** Static declaration for NodeHtml: type, default attributes and builder metadata. Data only, no React. */
const declaration = {
  type: 'nodeHtml',
  content: {
    attributes: {
      subType: 'div'
    },
    definition: {
      label: 'Html Node',
      type: 'nodeHtml',
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
      category: 'advanced',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-brands fa-html5'
    },
    defaultStyle: {
      name: 'Html Node',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {
        hr: {
          name: 'HR Node',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'border-top-width': '1px'
              }
            }
          }
        }
      }
    },
    settings: {}
  }
};

export default declaration;
