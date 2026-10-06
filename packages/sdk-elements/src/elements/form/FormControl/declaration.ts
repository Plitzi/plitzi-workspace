/** Static declaration for FormControl: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { FormControlProps } from './FormControl';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type FormControlAttributes = AuthorableAttributes<
  FormControlProps,
  'value' | 'error' | 'handleChange' | 'handleValidate'
> & {
  defaultValue?: string;
  /** Read by `withFieldValue`, not by the component: shows the control in its error state while editing. */
  previewError?: boolean;
};

// The box every field is drawn in. A select's has no line height: the select inside sets its own.
const fieldBox = {
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
  outline: 'none',
  position: 'relative'
};

const defaultInputStyle = { ...fieldBox, 'line-height': '20px' };

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

const selectStyle = { ...fieldBox, cursor: 'pointer' };

/** A checkbox drawn as a track and a thumb, in the label's colour: a class recolours it with `color`. */
const switchStyle = {
  height: '20px',
  width: '36px',
  'margin-top': '0px',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'margin-right': '8px',
  position: 'relative',
  'flex-shrink': '0',
  'border-top-color': 'currentColor',
  'border-top-style': 'solid',
  'border-top-width': '1px',
  'border-right-color': 'currentColor',
  'border-right-style': 'solid',
  'border-right-width': '1px',
  'border-bottom-color': 'currentColor',
  'border-bottom-style': 'solid',
  'border-bottom-width': '1px',
  'border-left-color': 'currentColor',
  'border-left-style': 'solid',
  'border-left-width': '1px',
  'border-top-left-radius': '10px',
  'border-top-right-radius': '10px',
  'border-bottom-left-radius': '10px',
  'border-bottom-right-radius': '10px',
  'background-color': 'transparent',
  transition: 'background-color 150ms ease',
  appearance: 'none',
  cursor: 'pointer'
};

/** A field with its label above it: every typed sub-type and the select. */
const typed = (name: string, input: Record<string, string>) => ({
  name,
  displayMode: 'desktop' as const,
  style: {
    base: { default: {} },
    input: { default: input },
    label: { default: defaultLabelStyle },
    error: { default: defaultErrorStyle }
  }
});

const declaration = elementDeclaration<FormControlAttributes>()({
  type: 'formControl',
  attributeValues: {
    subType: valuesOf<NonNullable<FormControlProps['subType']>>()([
      'text',
      'number',
      'email',
      'password',
      'search',
      'url',
      'tel',
      'date',
      'time',
      'checkbox',
      'switch',
      'select',
      'textarea',
      'hidden',
      'color'
    ])
  },
  triggers: {
    onChange: {
      action: 'onChange',
      title: 'On Change',
      type: 'trigger',
      params: {},
      preview: { value: '', name: '' }
    }
  },
  content: {
    attributes: {
      subType: 'text',
      name: '',
      label: 'Label',
      hideLabel: false,
      placeholder: '',
      defaultValue: '',
      autoComplete: true,
      autoFocus: false,
      disabled: false,
      options: [],
      required: true,
      requiredMessage: '',
      minLength: 0,
      minLengthMessage: '',
      maxLength: 0,
      maxLengthMessage: '',
      formatMessage: '',
      pattern: '',
      patternMessage: '',
      matches: '',
      matchesMessage: '',
      readOnly: false
    },
    definition: {
      label: 'Form Control',
      type: 'formControl',
      description:
        'A single labelled input (text/select/checkbox/… per its subType) inside a form; captures one field of user ' +
        'input. A select offers its `options`: `[{ label, value }, …]` — the text shown, and what the field takes. A ' +
        '`switch` is a checkbox announced and drawn as an on/off switch (`role="switch"`), for a setting that applies at ' +
        'once; both hold `true`/`false`, and a `defaultValue` of `"true"` starts them on.',
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
      canSnippet: false,
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
      icon: 'fa-solid fa-i-cursor'
    },
    defaultStyle: {
      name: 'Form Control',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      subTypes: {
        hidden: typed('Form Control Hidden', {}),
        text: typed('Form Control Text', defaultInputStyle),
        number: typed('Form Control Number', defaultInputStyle),
        email: typed('Form Control Email', defaultInputStyle),
        password: typed('Form Control Password', defaultInputStyle),
        search: typed('Form Control Search', defaultInputStyle),
        url: typed('Form Control URL', defaultInputStyle),
        tel: typed('Form Control Phone', defaultInputStyle),
        date: typed('Form Control Date', defaultInputStyle),
        time: typed('Form Control Time', defaultInputStyle),
        color: typed('Form Control Color', defaultInputStyle),
        textarea: typed('Form Control Textarea', { ...defaultInputStyle, color: 'inherit', resize: 'vertical' }),
        select: typed('Form Control Select', selectStyle),
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
        switch: {
          name: 'Form Control Switch',
          displayMode: 'desktop',
          style: {
            base: { default: {} },
            input: { default: switchStyle },
            label: { default: { ...inlineLabelStyle, 'align-items': 'center' } },
            error: { default: defaultErrorStyle }
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
