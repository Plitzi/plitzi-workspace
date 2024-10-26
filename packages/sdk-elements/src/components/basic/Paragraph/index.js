// Relatives
import Paragraph from './Paragraph.js';

Paragraph.content = {
  attributes: {
    content: 'Paragraph'
  },
  definition: {
    label: 'Paragraph',
    type: 'paragraph',
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
  defaultStyle: {
    name: 'Paragraph',
    displayMode: 'desktop',
    style: {
      base: {
        'margin-top': '14px',
        'margin-bottom': '14px'
      }
    }
  },
  settings: {}
};

Paragraph.type = 'paragraph';

export default Paragraph;
