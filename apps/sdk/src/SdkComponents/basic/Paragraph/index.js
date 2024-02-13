// Relatives
import Paragraph from './Paragraph';

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
