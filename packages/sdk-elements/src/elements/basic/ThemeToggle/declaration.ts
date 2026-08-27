/** Static declaration for ThemeToggle: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { ThemeToggleProps } from './ThemeToggle';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ThemeToggleAttributes = AuthorableAttributes<ThemeToggleProps>;

const declaration = elementDeclaration<ThemeToggleAttributes>()({
  type: 'themeToggle',
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
        'Lets a visitor choose light or dark. It writes the choice on the document root, where a space stylesheet is already looking for it, and remembers it — so the machine decides until somebody says otherwise. It ships no colours of its own: style it with the space own classes, and use `data-theme-icon` to decide which icon each scheme shows.',
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
      icon: 'fa-solid fa-circle-half-stroke'
    },
    defaultStyle: {
      name: 'Theme Toggle',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'inline-flex',
            'align-items': 'center',
            cursor: 'pointer'
          }
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
