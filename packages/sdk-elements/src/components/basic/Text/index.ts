import Text from './Text';

Text.content = {
  attributes: {
    content: 'Text'
  },
  definition: {
    label: 'Text',
    type: 'text',
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
    icon: 'fa-solid fa-align-left'
  },
  defaultStyle: {
    name: 'Text',
    displayMode: 'desktop',
    style: {
      base: {
        'font-size': '14px', // browser default
        'line-height': '24px', // browser default
        display: 'inline'
      }
    }
  },
  settings: {}
};

Text.type = 'text';

export default Text;
