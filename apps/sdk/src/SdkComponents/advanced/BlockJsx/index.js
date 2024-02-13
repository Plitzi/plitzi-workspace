// Relatives
import BlockJsx from './BlockJsx';

BlockJsx.content = {
  attributes: {
    content: '',
    props: '{}',
    contentCache: '',
    allowEmptyRender: false
  },
  definition: {
    label: 'Block JSX',
    type: 'blockJsx',
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [{ path: 'props', label: 'Properties' }],
    style: [],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
  },
  defaultStyle: {
    name: 'Block JSX',
    displayMode: 'desktop',
    style: {}
  },
  settings: {}
};

BlockJsx.type = 'blockJsx';

export default BlockJsx;
