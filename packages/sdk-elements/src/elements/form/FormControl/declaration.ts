/** Static declaration for FormControl: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { FormControlProps } from './FormControl';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type FormControlAttributes = AuthorableAttributes<
  FormControlProps,
  'value' | 'error' | 'handleChange' | 'handleValidate'
> & { defaultValue?: string };

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

// A checkbox's label sits beside its box rather than above it, so it is the same rule without the gap. Built
// up rather than subtracted, which is what keeps this file free of imports.
const inlineLabelStyle = {
  display: 'flex',
  cursor: 'pointer',
  'font-weight': '600',
  'font-size': '14px',
  'line-height': '18px',
  color: '#6b7280',
  'user-select': 'none'
};

const defaultLabelStyle = { ...inlineLabelStyle, 'margin-bottom': '4px' };

const defaultErrorStyle = {
  display: 'block',
  color: 'red',
  'margin-top': '4px'
};

const declaration = elementDeclaration<FormControlAttributes>()({
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
      description:
        'A single labelled input (text/select/checkbox/… per its subType) inside a form; captures one field of user ' +
        'input.',
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
      backgroundColor: '#4422ee'
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
            label: { default: inlineLabelStyle },
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

export default declaration;
