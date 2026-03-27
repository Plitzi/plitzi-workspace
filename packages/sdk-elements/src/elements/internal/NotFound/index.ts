import BaseNotFound from './NotFound';

const NotFound = Object.assign(BaseNotFound, {
  type: 'notFound',
  content: {
    attributes: {},
    definition: {
      label: 'Not Found',
      type: 'notFound',
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
      icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
    },
    defaultStyle: {
      name: 'Not Found',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default NotFound;

export { NotFound };
