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
      description: 'Inline plain-text content. Use for short runs of copy; bind its content to data for dynamic text.'
    },
    market: {
      category: 'basic',
      icon: 'fa-solid fa-align-left'
    },
    defaultStyle: {
      style: {
        base: {
          // Only how it flows: its size and line height are the words around it, which a span inside a heading or a
          // button has to keep.
          default: {
            display: 'inline'
          }
        }
      }
    }
  }
});

export default declaration;
