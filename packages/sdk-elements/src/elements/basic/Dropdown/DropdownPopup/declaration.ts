/** Static declaration for DropdownPopup: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../../authoring/declare';

import type { DropdownPopupProps } from './DropdownPopup';
import type { AuthorableAttributes } from '../../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type DropdownPopupAttributes = AuthorableAttributes<DropdownPopupProps>;

const declaration = elementDeclaration<DropdownPopupAttributes>()({
  type: 'dropdownPopup',
  content: {
    attributes: {},
    definition: {
      label: 'Dropdown Popup',
      type: 'dropdownPopup',
      description: 'The floating panel revealed by a dropdown.',
      items: [],
      bindings: {},
      styleSelectors: {
        base: ''
      },
      initialState: {}
    },
    builder: {
      canDelete: false,
      canSelect: true,
      canDragDrop: false,
      canMove: false,
      canTemplate: false,
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
      icon: ''
    },
    defaultStyle: {
      name: 'Dropdown Popup',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'background-color': 'white',
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
    },
    settings: {}
  },
  initialItems: []
});

export default declaration;
