/** Static declaration for BlockHtml: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { BlockHtmlProps } from './BlockHtml';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type BlockHtmlAttributes = AuthorableAttributes<BlockHtmlProps>;

const declaration = elementDeclaration<BlockHtmlAttributes>()({
  type: 'blockHtml',
  content: {
    attributes: {
      content: ''
    },
    definition: {
      label: 'HTML Block',
      type: 'blockHtml',
      description: 'Renders an arbitrary raw HTML string as a block. Escape hatch when no structured element fits.',
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
      category: 'advanced',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-brands fa-html5'
    },
    defaultStyle: {
      name: 'HTML Block',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default declaration;
