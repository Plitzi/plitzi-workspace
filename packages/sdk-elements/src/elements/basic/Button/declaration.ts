/** Static declaration for Button: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { ButtonProps } from './Button';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ButtonAttributes = AuthorableAttributes<ButtonProps>;

const declaration = elementDeclaration<ButtonAttributes>()({
  type: 'button',
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
                'line-height': '24px',
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
                'line-height': '24px',
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
                'line-height': '24px',
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
