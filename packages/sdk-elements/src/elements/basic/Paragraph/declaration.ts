/** Static declaration for Paragraph: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { ParagraphProps } from './Paragraph';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ParagraphAttributes = AuthorableAttributes<ParagraphProps>;

const declaration = elementDeclaration<ParagraphAttributes>()({
  type: 'paragraph',
  content: {
    attributes: {
      content: 'Paragraph'
    },
    definition: {
      label: 'Paragraph',
      description: 'A block of body text (a <p>). Use for longer prose passages.'
    },
    market: {
      category: 'basic',
      icon: 'fa-solid fa-paragraph'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            'margin-top': '14px',
            'margin-bottom': '14px'
          }
        }
      }
    }
  }
});

export default declaration;
