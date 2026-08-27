/** Static declaration for RichText: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { RichTextProps } from './RichText';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type RichTextAttributes = AuthorableAttributes<RichTextProps>;

const declaration = elementDeclaration<RichTextAttributes>()({
  type: 'richText',
  content: {
    attributes: {
      content: '',
      format: 'html',
      mediaBaseUrl: ''
    },
    definition: {
      label: 'Rich Text',
      type: 'richText',
      description:
        'Renders a body field coming from a CMS — HTML, markdown or plain text. Scripts and event handlers are stripped before rendering, so third-party content cannot execute.',
      items: [],
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
      name: 'Rich Text',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
