/** Static declaration for Dropdown: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring';

import type { DropdownProps } from './Dropdown';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type DropdownAttributes = AuthorableAttributes<DropdownProps>;

const declaration = elementDeclaration<DropdownAttributes>()({
  type: 'dropdown',
  attributeValues: {
    popupPlacement: valuesOf<NonNullable<DropdownProps['popupPlacement']>>()(['left', 'right', 'top', 'bottom']),
    popupWidth: valuesOf<NonNullable<DropdownProps['popupWidth']>>()(['content', 'trigger'])
  },
  callbacks: {
    openDropdown: { action: 'openDropdown', title: 'Open Dropdown', type: 'callback', params: {}, preview: {} },
    closeDropdown: { action: 'closeDropdown', title: 'Close Dropdown', type: 'callback', params: {}, preview: {} },
    toggleDropdown: { action: 'toggleDropdown', title: 'Toggle Dropdown', type: 'callback', params: {}, preview: {} }
  },
  marks: {
    'aria-expanded': 'on its trigger while the popup is open — what a class’s `expanded` state lights',
    '.popup-container--no-visible': 'on its dropdownPopup while closed',
    'the popup':
      'drawn at the space’s root, `position: fixed` where the dropdown places it — a class on the popup sets its look, never its position (top, left, position, inset, transform); `popupWidth: "trigger"` makes it as wide as the trigger'
  },
  content: {
    attributes: {
      popupPlacement: 'bottom',
      openPopup: false,
      backgroundDisabled: false,
      closeOnClickBackground: true,
      closeOnClickPopup: true,
      containerTopOffset: 5,
      containerLeftOffset: 5,
      popupWidth: 'content',
      disabled: false
    },
    definition: {
      label: 'Dropdown',
      description: 'A trigger that toggles an attached popup panel (dropdownPopup) — menus, selects, flyouts.',
      items: [],
      styleSelectors: {
        backgroundContainer: ''
      }
    },
    market: {
      category: 'basic',
      icon: 'fa-solid fa-angle-down'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            cursor: 'pointer',
            'user-select': 'none'
          }
        },
        backgroundContainer: {
          default: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            position: 'fixed',
            cursor: 'default',
            'z-index': 50
          }
        }
      }
    }
  },
  initialItems: ['dropdownPopup']
});

export default declaration;
