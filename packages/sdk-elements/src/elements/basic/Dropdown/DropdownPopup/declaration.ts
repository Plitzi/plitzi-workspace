/** Static declaration for DropdownPopup: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { DropdownPopupProps } from './DropdownPopup';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type DropdownPopupAttributes = AuthorableAttributes<DropdownPopupProps>;

const declaration = elementDeclaration<DropdownPopupAttributes>()({
  type: 'dropdownPopup',
  ancestorType: 'dropdown',
  content: {
    attributes: {},
    definition: {
      label: 'Dropdown Popup',
      description: 'The floating panel revealed by a dropdown.',
      items: [],
      initialState: {}
    },
    builder: {
      canDelete: false,
      canDragDrop: false,
      canMove: false,
      canSnippet: false
    },
    market: {
      category: 'basic',
      icon: 'fa-regular fa-window-restore'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            'background-color': 'light-dark(white, oklch(0.21 0.006 285.885))',
            // Room to see and pick the panel while it is still empty.
            'min-height': '24px',
            'min-width': '24px',
            'padding-right': '4px',
            'padding-bottom': '4px',
            'padding-left': '4px',
            'padding-top': '4px',
            position: 'fixed',
            display: 'flex',
            'flex-direction': 'column',
            'border-top-right-radius': '4px',
            'border-bottom-right-radius': '4px',
            'border-bottom-left-radius': '4px',
            'border-top-left-radius': '4px',
            'box-shadow': 'rgba(0, 0, 0, 0.1) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 4px 11px',
            'z-index': 100
          }
        }
      },
      subTypes: {}
    }
  },
  initialItems: []
});

export default declaration;
