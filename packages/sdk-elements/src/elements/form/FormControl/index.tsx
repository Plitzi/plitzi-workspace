import { omit } from '@plitzi/plitzi-ui';
import FormIcon from '@plitzi/plitzi-ui/icons/Form';

import BaseFormControl from './FormControl';

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

const FormControl = Object.assign(BaseFormControl, {
  type: 'formControl',
  content: {
    attributes: {
      subType: 'text',
      name: '',
      label: 'Label',
      placeholder: '',
      defaultValue: '',
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
      icon: <FormIcon />
    },
    defaultStyle: {
      name: 'Form Control',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      subTypes: {
        hidden: {
          name: 'Form Control Hidden',
          displayMode: 'desktop',
          style: {
            base: {},
            input: { default: {} },
            label: { default: defaultLabelStyle },
            error: { default: defaultErrorStyle }
          }
        },
        text: {
          name: 'Form Control Text',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: { default: defaultInputStyle },
            label: { default: defaultLabelStyle },
            error: { default: defaultErrorStyle }
          }
        },
        password: {
          name: 'Form Control Password',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: { default: defaultInputStyle },
            label: { default: defaultLabelStyle },
            error: { default: defaultErrorStyle }
          }
        },
        number: {
          name: 'Form Control Number',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: { default: defaultInputStyle },
            label: { default: defaultLabelStyle },
            error: { default: defaultErrorStyle }
          }
        },
        email: {
          name: 'Form Control Email',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: { default: defaultInputStyle },
            label: { default: defaultLabelStyle },
            error: { default: defaultErrorStyle }
          }
        },
        textarea: {
          name: 'Form Control Textarea',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: { default: defaultInputStyle },
            label: { default: defaultLabelStyle },
            error: { default: defaultErrorStyle }
          }
        },
        checkbox: {
          name: 'Form Control Checkbox',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: {
              default: {
                'margin-top': '0px',
                'margin-bottom': '0px',
                'margin-left': '0px',
                'margin-right': '4px'
              }
            },
            label: { default: omit(defaultLabelStyle, ['margin-bottom']) },
            error: { default: defaultErrorStyle }
          }
        },
        select: {
          name: 'Form Control Select',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: {
              default: { ...defaultInputStyle, cursor: 'pointer' }
            },
            label: defaultLabelStyle,
            error: { default: defaultErrorStyle }
          }
        }
      }
    },
    settings: {}
  }
});

export default FormControl;
