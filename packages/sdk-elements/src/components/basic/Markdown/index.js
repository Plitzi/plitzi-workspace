// Relatives
import Markdown from './Markdown.js';

Markdown.content = {
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [{ path: 'content', label: 'Content' }],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
  },
  defaultStyle: {
    name: 'Markdown',
    displayMode: 'desktop',
    style: {
      base: {
        'font-size': '14px', // browser default
        'line-height': '24px' // browser default
      }
    }
  },
  settings: {}
};

Markdown.type = 'markdown';

export default Markdown;
