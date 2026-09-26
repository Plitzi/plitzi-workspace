/** Static declaration for Button: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { ButtonProps } from './Button';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ButtonAttributes = AuthorableAttributes<ButtonProps>;

const declaration = elementDeclaration<ButtonAttributes>()({
  type: 'button',
  attributeValues: {
    subType: valuesOf<NonNullable<ButtonProps['subType']>>()(['button', 'submit', 'reset']),
    contentPlacement: valuesOf<NonNullable<ButtonProps['contentPlacement']>>()(['before', 'after'])
  },
  content: {
    attributes: {
      contentPlacement: 'after',
      content: 'Button',
      subType: 'button',
      disabled: false
    },
    definition: {
      label: 'Button',
      type: 'button',
      description:
        'A clickable button. On its own it only renders; wire an interaction flow (trigger onClick → callbacks) to make ' +
        'it DO something.',
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
      category: 'basic',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-stop'
    },
    defaultStyle: {
      name: 'Button',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      subTypes: {
        button: {
          name: 'Default Button',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'padding-top': '6px',
                'padding-left': '12px',
                'padding-right': '12px',
                'padding-bottom': '6px',
                cursor: 'pointer',
                'font-size': '16px',
                // A ratio, not a length: 24px at the default 16px, and the same proportion for a class that resizes
                // the text. A fixed 24px left every small button — a chip, a row, a tab — a line taller than its text.
                'line-height': '1.5',
                'border-top-left-radius': '4px',
                'border-top-right-radius': '4px',
                'border-bottom-left-radius': '4px',
                'border-bottom-right-radius': '4px'
              }
            }
          }
        },
        reset: {
          name: 'Reset Button',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'padding-top': '6px',
                'padding-left': '12px',
                'padding-right': '12px',
                'padding-bottom': '6px',
                cursor: 'pointer',
                'font-size': '16px',
                // A ratio, not a length: 24px at the default 16px, and the same proportion for a class that resizes
                // the text. A fixed 24px left every small button — a chip, a row, a tab — a line taller than its text.
                'line-height': '1.5',
                'border-top-left-radius': '4px',
                'border-top-right-radius': '4px',
                'border-bottom-left-radius': '4px',
                'border-bottom-right-radius': '4px'
              }
            }
          }
        },
        submit: {
          name: 'Submit Button',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'padding-top': '6px',
                'padding-left': '12px',
                'padding-right': '12px',
                'padding-bottom': '6px',
                cursor: 'pointer',
                'font-size': '16px',
                // A ratio, not a length: 24px at the default 16px, and the same proportion for a class that resizes
                // the text. A fixed 24px left every small button — a chip, a row, a tab — a line taller than its text.
                'line-height': '1.5',
                'border-top-left-radius': '4px',
                'border-top-right-radius': '4px',
                'border-bottom-left-radius': '4px',
                'border-bottom-right-radius': '4px'
              }
            }
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
