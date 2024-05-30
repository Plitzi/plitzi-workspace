// Relatives
import Dropdown from './Dropdown';
import DropdownPopup from './DropdownPopup';

Dropdown.content = {
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
    type: 'dropdown',
    items: [],
    bindings: {},
    styleSelectors: {
      base: '',
      backgroundContainer: ''
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [
      { path: 'openPopup', label: 'Open Popup' },
      { path: 'disabled', label: 'Disabled' }
    ],
    style: [
      { path: 'color', label: 'Color' },
      { path: 'background-color', label: 'Background Color' }
    ],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' },
      { path: 'styleSelectors.backgroundContainer', label: 'Selector - Background Container' }
    ]
  },
  defaultStyle: {
    name: 'Dropdown',
    displayMode: 'desktop',
    style: {
      base: {
        'min-height': '50px',
        'min-width': '50px',
        cursor: 'pointer',
        'user-select': 'none'
      },
      backgroundContainer: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        position: 'fixed',
        cursor: 'default',
        'z-index': 50
      }
    }
  },
  settings: {}
};

Dropdown.initialItems = ['dropdownPopup'];
Dropdown.plugins = { dropdownPopup: DropdownPopup };
Dropdown.type = 'dropdown';

export default Dropdown;
