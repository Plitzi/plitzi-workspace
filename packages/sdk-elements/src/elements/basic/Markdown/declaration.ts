/** Static declaration for Markdown: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { MarkdownProps } from './Markdown';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type MarkdownAttributes = AuthorableAttributes<MarkdownProps>;

const declaration = elementDeclaration<MarkdownAttributes>()({
  type: 'markdown',
  content: {
    attributes: {
      content: 'Markdown'
    },
    definition: {
      label: 'Markdown',
      type: 'markdown',
      description: 'Renders a Markdown source string as formatted HTML.',
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
      icon: 'fa-brands fa-markdown'
    },
    defaultStyle: {
      name: 'Markdown',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'font-size': '14px',
            'line-height': '24px'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
