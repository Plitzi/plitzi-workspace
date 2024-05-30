// Relatives
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [{ path: 'content', label: 'Content' }],
    style: [
      { path: 'color', label: 'Color' },
      { path: 'background-color', label: 'Background Color' }
    ],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
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
