/** Static declaration for ThemeToggle: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { ThemeToggleProps } from './ThemeToggle';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ThemeToggleAttributes = AuthorableAttributes<ThemeToggleProps>;

/**
 * The switch and each option are real buttons with the browser's own look taken off: they keep the colour and the type
 * of the words around them.
 */
const buttonReset = {
  'margin-top': '0px',
  'margin-right': '0px',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'padding-top': '0px',
  'padding-right': '0px',
  'padding-bottom': '0px',
  'padding-left': '0px',
  display: 'inline-flex',
  'align-items': 'center',
  'background-color': 'transparent',
  color: 'inherit',
  'font-family': 'inherit',
  'font-size': 'inherit',
  'font-style': 'inherit',
  'font-weight': 'inherit',
  'line-height': 'inherit',
  'letter-spacing': 'inherit',
  cursor: 'pointer'
};

const declaration = elementDeclaration<ThemeToggleAttributes>()({
  type: 'themeToggle',
  attributeValues: {
    subType: valuesOf<NonNullable<ThemeToggleProps['subType']>>()(['switch', 'segmented'])
  },
  triggers: {
    onThemeChange: {
      action: 'onThemeChange',
      title: 'On Theme Change',
      type: 'trigger',
      params: {},
      preview: { theme: 'dark' }
    }
  },
  content: {
    attributes: {
      subType: 'switch',
      lightLabel: 'Light',
      darkLabel: 'Dark',
      systemLabel: 'System',
      showSystem: false
    },
    definition: {
      label: 'Theme Toggle',
      type: 'themeToggle',
      description:
        'Lets a visitor choose light or dark. It writes the choice on the document root, where a space stylesheet is already looking for it, and remembers it — so the machine decides until somebody says otherwise. It ships no colours of its own: its buttons carry no browser look and take the colour and type around them — style ' +
        'them with the space own classes. A `segmented` one marks the chosen option with `aria-pressed`, which is the ' +
        '`current` state of its `option` slot. It shows the icon of the scheme in use by default; key a rule off ' +
        '`data-theme-icon` to change that. A `switch` marks the icon of the scheme in use — the one chosen, or the ' +
        'machine one while none is — with `aria-current`, the `current` state of its `icon` slot.',
      items: [],
      bindings: {},
      styleSelectors: {
        base: '',
        icon: '',
        option: ''
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
      canSnippet: true,
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
      icon: 'fa-solid fa-circle-half-stroke'
    },
    defaultStyle: {
      name: 'Theme Toggle',
      displayMode: 'desktop',
      style: {
        base: { default: buttonReset },
        icon: { default: {} },
        option: { default: { ...buttonReset, 'row-gap': '4px', 'column-gap': '4px' } }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
