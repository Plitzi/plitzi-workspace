import FormIcon from '@plitzi/plitzi-ui/icons/Form';

import BaseForm from './Form';

const Form = Object.assign(BaseForm, {
  type: 'form',
  content: {
    attributes: {
      method: 'get',
      actionUrl: '',
      managedByInteractions: false,
      errors: {},
      values: {}
    },
    definition: {
      label: 'Form',
      type: 'form',
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
      category: 'form',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: <FormIcon />
    },
    defaultStyle: {
      name: 'Form',
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

// eslint-disable-next-line react-refresh/only-export-components
export * from './Form';

export default Form;
