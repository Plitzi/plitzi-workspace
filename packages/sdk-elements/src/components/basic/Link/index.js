// Relatives
import Link from './Link.js';

Link.content = {
  attributes: {
    href: '#',
    target: 'self',
    mode: 'page',
    linkContext: undefined
  },
  definition: {
    label: 'Link',
    type: 'link',
    items: [],
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
    itemsNotAllowed: ['link']
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
    attributes: [{ path: 'href', label: 'Href' }],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
  },
  defaultStyle: {
    name: 'Link',
    displayMode: 'desktop',
    style: {
      base: {
        display: 'inline-block',
        'min-height': '30px',
        'min-width': '30px',
        color: '#333',
        cursor: 'pointer'
      }
    }
  },
  settings: {}
};

Link.type = 'link';

export default Link;
