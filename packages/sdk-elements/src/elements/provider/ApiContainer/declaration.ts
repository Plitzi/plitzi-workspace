/** Static declaration for ApiContainer: type, default attributes and builder metadata. Data only, no React. */
const declaration = {
  type: 'apiContainer',
  content: {
    attributes: {
      query: '',
      method: 'get',
      accessToken: '',
      mockData: '{}',
      subType: 'div',
      credentials: 'same-origin',
      connector: '',
      resource: '',
      limit: '10',
      singleRecord: false,
      filters: [],
      pagination: 'none',
      pageParam: 'page',
      renderWhileLoading: false
    },
    definition: {
      label: 'Api Container',
      type: 'apiContainer',
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
      category: 'provider',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-server'
    },
    defaultStyle: {
      name: 'Api Container',
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
};

export default declaration;
