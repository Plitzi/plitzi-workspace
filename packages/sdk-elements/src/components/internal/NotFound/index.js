// Relatives
import NotFound from './NotFound.js';

NotFound.content = {
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
  bindingsAllowed: {
    attributes: [],
    initialState: []
  },
  defaultStyle: {
    name: 'Not Found',
    displayMode: 'desktop',
    style: {}
  },
  settings: {}
};

NotFound.type = 'notFound';

export default NotFound;

export { NotFound };
