// Relatives
import BlockHtml from './BlockHtml.js';

BlockHtml.content = {
  attributes: {
    content: ''
  },
  definition: {
    label: 'Block HTML',
    type: 'blockHtml',
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
  defaultStyle: {
    name: 'Block HTML',
    displayMode: 'desktop',
    style: {}
  },
  settings: {}
};

BlockHtml.type = 'blockHtml';

export default BlockHtml;
