/** Static declaration for BlockHtml: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { BlockHtmlProps } from './BlockHtml';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

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
      description: 'Renders an arbitrary raw HTML string as a block. Escape hatch when no structured element fits.'
    },
    market: {
      category: 'advanced',
      icon: 'fa-brands fa-html5'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      }
    }
  }
});

export default declaration;
