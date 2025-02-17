
import FormIcon from '@plitzi/plitzi-ui/icons/Form';


import Form from './Form';

Form.content = {
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
        'min-width': '50px',
        'min-height': '50px'
      }
    }
  },
  settings: {}
};

Form.type = 'form';

export default Form;
