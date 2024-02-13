// Relatives
import Loading from './Loading';

Loading.content = {
  attributes: {},
  definition: {
    label: 'Loading',
    type: 'loading',
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
    style: [],
    initialState: []
  },
  defaultStyle: {
    name: 'Loading',
    displayMode: 'desktop',
    style: {}
  },
  settings: {}
};

Loading.type = 'loading';

export default Loading;
