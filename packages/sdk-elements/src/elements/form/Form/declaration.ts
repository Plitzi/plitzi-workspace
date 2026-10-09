/** Static declaration for Form: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { FormProps } from './Form';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type FormAttributes = AuthorableAttributes<FormProps>;

const declaration = elementDeclaration<FormAttributes>()({
  type: 'form',
  attributeValues: {
    method: valuesOf<NonNullable<FormProps['method']>>()(['get', 'post'])
  },
  // Not `form`: what a form offers its descendants is a record like any other provider's, so it registers under
  // the same source kind and a binding reads `apiContainer_<id>.values`.
  sourceType: 'apiContainer',
  triggers: {
    onSubmit: {
      action: 'onSubmit',
      title: 'On Form Submit',
      type: 'trigger',
      params: {},
      preview: { values: {}, actionUrl: '', method: '' }
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
        'A <form> that groups form controls and handles submission; wire its submit through an interaction flow.',
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
