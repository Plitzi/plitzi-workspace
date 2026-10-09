/** Static declaration for Dropdown: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { DropdownProps } from './Dropdown';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type DropdownAttributes = AuthorableAttributes<DropdownProps>;

const declaration = elementDeclaration<DropdownAttributes>()({
  type: 'dropdown',
  attributeValues: {
    popupPlacement: valuesOf<NonNullable<DropdownProps['popupPlacement']>>()(['left', 'right', 'top', 'bottom'])
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
