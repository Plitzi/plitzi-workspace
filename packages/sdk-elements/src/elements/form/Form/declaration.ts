/** Static declaration for Form: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring';

import type { FormProps } from './Form';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/**
 * What this element can be authored with — its component's own props, minus what the runtime supplies: `submitted` is
 * what a visitor did, never a starting value.
 */
export type FormAttributes = AuthorableAttributes<FormProps, 'submitted'>;

const declaration = elementDeclaration<FormAttributes>()({
  type: 'form',
  attributeValues: {
    method: valuesOf<NonNullable<FormProps['method']>>()(['get', 'post'])
  },
  // Not `form`: what a form offers its descendants is a record like any other provider's, so it registers under
  // the same source kind and a binding reads `apiContainer_<id>.values`.
  sourceType: 'apiContainer',
  publishes: {
    values: "Each field's value, by its name",
    errors: "Each field's error, by its name — none while it is valid",
    submitted:
      "Whether a submit was tried — valid or not — since the form was shown or reset: what shows an error only after a submit, or hides a field's hint once one was tried (no `touched`: a field's own error shows once the field is left)"
  },
  triggers: {
    onSubmit: {
      action: 'onSubmit',
      title: 'On Form Submit',
      type: 'trigger',
      params: {},
      preview: { values: {}, actionUrl: '', method: '' }
    },
    onInvalid: {
      action: 'onInvalid',
      title: 'On Form Refused',
      type: 'trigger',
      params: {},
      preview: { errors: {}, values: {} }
    }
  },
  callbacks: {
    performReset: { action: 'performReset', title: 'Reset Form', type: 'callback', params: {} },
    // `name` offers the form's own fields, which only a mounted form knows; the component fills the options in.
    setFieldValue: {
      action: 'setFieldValue',
      title: 'Set Field Value',
      type: 'callback',
      preview: {},
      params: {
        name: { label: 'Field Name', defaultValue: undefined, type: 'select', options: [] },
        value: { type: 'text', defaultValue: '' }
      }
    },
    setFieldError: {
      action: 'setFieldError',
      title: 'Set Field Error',
      type: 'callback',
      preview: {},
      params: {
        name: { label: 'Field Name', defaultValue: undefined, type: 'select', options: [] },
        error: { type: 'text', defaultValue: '' }
      }
    }
  },
  content: {
    attributes: {
      method: 'get',
      actionUrl: '',
      managedByInteractions: false,
      noValidate: false,
      errors: {},
      values: {}
    },
    definition: {
      label: 'Form',
      description:
        "A <form> that groups form controls and handles submission; wire its submit through an interaction flow. Left as it is, the browser answers first for a blank required field and a malformed address, in a bubble no style reaches and in the browser's language; `noValidate: true` turns its checks off, and every rule answers under its control in the words of its `…Message` (`requiredMessage`).",
      items: []
    },
    market: {
      category: 'form',
      icon: 'fa-solid fa-rectangle-list'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      }
    }
  }
});

export default declaration;
