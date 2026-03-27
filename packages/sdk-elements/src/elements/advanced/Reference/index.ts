import BaseReference from './Reference';

const Reference = Object.assign(BaseReference, {
  type: 'reference',
  content: {
    attributes: {
      referenceType: 'element',
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
      icon: 'fa-solid fa-asterisk'
    },
    defaultStyle: {
      name: 'Reference Element',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'min-width': '50px',
            'min-height': '50px'
          }
        }
      }
    },
    settings: {}
  }
});

export default Reference;
