// Packages
import omit from 'lodash/omit.js';

// Relatives
import FormControl from './FormControl.js';

const defaultInputStyle = {
  width: '100%',
  display: 'flex',
  'align-items': 'center',
  'border-right-color': '#6f7780',
  'border-right-style': 'solid',
  'border-right-width': '1px',
  'border-top-right-radius': '4px',
  'border-bottom-color': '#6f7780',
  'border-bottom-style': 'solid',
  'border-bottom-width': '1px',
  'border-bottom-right-radius': '4px',
  'border-bottom-left-radius': '4px',
  'border-top-left-radius': '4px',
  'border-left-color': '#6f7780',
  'border-left-style': 'solid',
  'border-left-width': '1px',
  'border-top-color': '#6f7780',
  'border-top-style': 'solid',
  'border-top-width': '1px',
  'user-select': 'none',
  'font-size': '14px',
  'padding-left': '16px',
  'padding-right': '16px',
  'padding-top': '8px',
  'padding-bottom': '8px',
  'line-height': '20px',
  outline: 'none',
  position: 'relative'
};

const defaultLabelStyle = {
  display: 'flex',
  cursor: 'pointer',
  'margin-bottom': '4px',
  'font-weight': '600',
  'font-size': '14px',
  'line-height': '18px',
  color: '#6b7280',
  'user-select': 'none'
};

const defaultErrorStyle = {
  display: 'block',
  color: 'red',
  'margin-top': '4px'
};

FormControl.content = {
  attributes: {
    subType: 'text',
    name: '',
    label: 'Label',
    placeholder: '',
    autoComplete: true,
    disabled: false,
    options: [],
    required: true,
    readOnly: false
  },
  definition: {
    label: 'Form Control',
    type: 'formControl',
    description: '',
    bindings: {},
    styleSelectors: {
      base: '',
      label: '',
      input: '',
      error: ''
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
    canTemplate: false,
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [
      { path: 'name', label: 'Name' },
      { path: 'label', label: 'Label' },
      { path: 'placeholder', label: 'Placeholder' },
      { path: 'autoComplete', label: 'Auto Complete' },
      { path: 'disabled', label: 'Disabled' },
      { path: 'error', label: 'Error' },
      { path: 'options', label: 'Options' },
      { path: 'required', label: 'Required' }
    ],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
  },
  defaultStyle: {
    name: 'Form Control',
    displayMode: 'desktop',
    style: {},
    subTypes: {
      hidden: {
        name: 'Form Control Hidden',
        displayMode: 'desktop',
        style: {
          base: {},
          input: {},
          label: defaultLabelStyle,
          error: defaultErrorStyle
        }
      },
      text: {
        name: 'Form Control Text',
        displayMode: 'desktop',
        style: {
          base: {},
          input: defaultInputStyle,
          label: defaultLabelStyle,
          error: defaultErrorStyle
        }
      },
      password: {
        name: 'Form Control Password',
        displayMode: 'desktop',
        style: {
          base: {},
          input: defaultInputStyle,
          label: defaultLabelStyle,
          error: defaultErrorStyle
        }
      },
      number: {
        name: 'Form Control Number',
        displayMode: 'desktop',
        style: {
          base: {},
          input: defaultInputStyle,
          label: defaultLabelStyle,
          error: defaultErrorStyle
        }
      },
      email: {
        name: 'Form Control Email',
        displayMode: 'desktop',
        style: {
          base: {},
          input: defaultInputStyle,
          label: defaultLabelStyle,
          error: defaultErrorStyle
        }
      },
      textarea: {
        name: 'Form Control Textarea',
        displayMode: 'desktop',
        style: {
          base: {},
          input: defaultInputStyle,
          label: defaultLabelStyle,
          error: defaultErrorStyle
        }
      },
      checkbox: {
        name: 'Form Control Checkbox',
        displayMode: 'desktop',
        style: {
          base: {},
          input: {
            'margin-top': '0px',
            'margin-bottom': '0px',
            'margin-left': '0px',
            'margin-right': '4px'
          },
          label: omit(defaultLabelStyle, ['margin-bottom']),
          error: defaultErrorStyle
        }
      },
      select: {
        name: 'Form Control Select',
        displayMode: 'desktop',
        style: {
          base: {},
          input: {
            ...defaultInputStyle,
            cursor: 'pointer'
          },
          label: defaultLabelStyle,
          error: defaultErrorStyle
        }
      }
    }
  },
  settings: {}
};

FormControl.type = 'formControl';

export default FormControl;
