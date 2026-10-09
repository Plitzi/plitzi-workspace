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

const requiredMarkStyle = {
  color: 'red',
  'margin-left': '4px'
};

const noBorder = {
  'border-top-style': 'none',
  'border-right-style': 'none',
  'border-bottom-style': 'none',
  'border-left-style': 'none'
};

/**
 * The field inside its box: it draws nothing of its own and takes the box's type and colour. Its background is the box
 * showing through, never the box's colour again: `inherit` painted a translucent one twice, and the field stood out
 * from the padding around it as a second, darker box.
 */
const fieldStyle = {
  height: '100%',
  width: '100%',
  'padding-top': '0px',
  'padding-right': '0px',
  'padding-bottom': '0px',
  'padding-left': '0px',
  display: 'block',
  ...noBorder,
  'background-color': 'transparent',
  color: 'inherit',
  'line-height': 'inherit',
  'font-family': 'inherit',
  'font-size': 'inherit',
  'box-shadow': 'none'
};

const selectFieldStyle = {
  height: '100%',
  width: '100%',
  // The chevron's room, and a gap before it: the chosen option never runs under it (the stylesheet draws the chevron).
  'padding-right': 'calc(1.15em + 8px)',
  display: 'block',
  ...noBorder,
  'background-color': 'transparent',
  color: 'inherit',
  'line-height': 'inherit',
  'font-family': 'inherit',
  'font-size': 'inherit',
  appearance: 'none',
  cursor: 'inherit',
  'box-shadow': 'none'
};

/** A password's show/hide button, without the browser's own button look: the icon keeps the field's colour and size. */
const iconStyle = {
  height: '100%',
  'margin-top': '0px',
  'margin-right': '0px',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'padding-right': '4px',
  'padding-left': '4px',
  display: 'flex',
  'justify-content': 'center',
  'align-items': 'center',
  ...noBorder,
  'background-color': 'transparent',
  color: 'inherit',
  'line-height': 'inherit',
  'font-family': 'inherit',
  'font-size': 'inherit',
  'font-weight': 'inherit',
  cursor: 'pointer'
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

/** The slots only some fields draw: the `field` inside the box, a password's `icon`. */
type FieldParts = { field?: Record<string, string>; icon?: Record<string, string> };

/** A field with its label above it: every typed sub-type and the select. */
const typed = (name: string, input: Record<string, string>, { field, icon }: FieldParts = {}) => ({
  name,
  displayMode: 'desktop' as const,
  style: {
    base: { default: {} },
    input: { default: input },
    ...(field ? { field: { default: field } } : {}),
    ...(icon ? { icon: { default: icon } } : {}),
    label: { default: defaultLabelStyle },
    requiredMark: { default: requiredMarkStyle },
    error: { default: defaultErrorStyle }
  }
});

const withField: FieldParts = { field: fieldStyle };

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
      // Optional unless it says so, as an HTML field is: required by default, an empty field nobody meant to require
      // stopped the whole submit without a word.
      required: false,
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
      description:
        'A single labelled input (text/select/checkbox/… per its subType) inside a form; captures one field of user ' +
        'input. Optional unless `required: true`, as an HTML field is: a `requiredMessage` alone requires nothing. ' +
        'A select offers its `options`: `[{ label, value }, …]` — the text shown, and what the field takes. A ' +
        '`switch` is a checkbox announced and drawn as an on/off switch (`role="switch"`), for a setting that applies at ' +
        'once; both hold `true`/`false`, and a `defaultValue` of `"true"` starts them on. Its slots: `label`, ' +
        '`requiredMark` (the `*` that ends the label of a required field), `input` (the box a typed field or a select ' +
        'is drawn in — a textarea, checkbox or switch is its own box), `field` (the `<input>` or `<select>` inside ' +
        'that box), `icon` (the show/hide button of a password) and `error`. The box is ringed (`2px solid ' +
        'currentColor`) while the field inside has keyboard focus: restyle it with a `focus-within` state on the ' +
        '`input` slot — the box never takes `focus` itself. The thumb of a switch is no element a ' +
        'class reaches: the class on its `input` slot sets `--plitzi-switch-thumb` (off), ' +
        '`--plitzi-switch-thumb-checked` (on, white by default) and `--plitzi-switch-thumb-shadow`.',
      styleSelectors: {
        label: '',
        requiredMark: '',
        input: '',
        field: '',
        icon: '',
        error: ''
      }
    },
    builder: {
      canSnippet: false
    },
    market: {
      category: 'form',
      icon: 'fa-solid fa-i-cursor'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {
        hidden: typed('Form Control Hidden', {}),
        text: typed('Form Control Text', defaultInputStyle, withField),
        number: typed('Form Control Number', defaultInputStyle, withField),
        email: typed('Form Control Email', defaultInputStyle, withField),
        password: typed('Form Control Password', defaultInputStyle, { ...withField, icon: iconStyle }),
        search: typed('Form Control Search', defaultInputStyle, withField),
        url: typed('Form Control URL', defaultInputStyle, withField),
        tel: typed('Form Control Phone', defaultInputStyle, withField),
        date: typed('Form Control Date', defaultInputStyle, withField),
        time: typed('Form Control Time', defaultInputStyle, withField),
        color: typed('Form Control Color', defaultInputStyle, withField),
        textarea: typed('Form Control Textarea', { ...defaultInputStyle, color: 'inherit', resize: 'vertical' }),
        select: typed('Form Control Select', selectStyle, { field: selectFieldStyle }),
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
            requiredMark: { default: requiredMarkStyle },
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
            requiredMark: { default: requiredMarkStyle },
            error: { default: defaultErrorStyle }
          }
        }
      }
    }
  }
});

export default declaration;
