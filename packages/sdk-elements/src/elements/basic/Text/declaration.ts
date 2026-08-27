/** Static declaration for Text: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { TextProps } from './Text';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TextAttributes = AuthorableAttributes<TextProps>;

const declaration = elementDeclaration<TextAttributes>()({
  type: 'text',
  content: {
    attributes: {
      content: 'Text'
    },
    definition: {
      label: 'Text',
      type: 'text',
      description: 'Inline plain-text content. Use for short runs of copy; bind its content to data for dynamic text.',
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
      icon: 'fa-solid fa-align-left'
    },
    defaultStyle: {
      name: 'Text',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'font-size': '14px',
            'line-height': '24px',
            display: 'inline'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
