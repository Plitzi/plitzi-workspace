// Alias
import { PARTIAL_SCHEMA_TYPE_ELEMENT } from '@modules/Element/ElementConstants';

// Relative
import Reference from './Reference';

Reference.content = {
  attributes: {
    referenceType: PARTIAL_SCHEMA_TYPE_ELEMENT,
    referenceId: '',
    referenceContainer: ''
  },
  definition: {
    label: 'Reference',
    type: 'reference',
    description: '',
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
    attributes: [],
    style: [],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
  },
  defaultStyle: {
    name: 'Reference Element',
    displayMode: 'desktop',
    style: {
      base: {
        'min-width': '50px',
        'min-height': '50px'
      }
    }
  },
  settings: {}
};

Reference.type = 'reference';

export default Reference;
