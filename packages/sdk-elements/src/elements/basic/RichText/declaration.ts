/** Static declaration for RichText: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { RichTextProps } from './RichText';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type RichTextAttributes = AuthorableAttributes<RichTextProps>;

const declaration = elementDeclaration<RichTextAttributes>()({
  type: 'richText',
  attributeValues: {
    format: valuesOf<NonNullable<RichTextProps['format']>>()(['html', 'markdown', 'text'])
  },
  content: {
    attributes: {
      content: '',
      format: 'html',
      mediaBaseUrl: ''
    },
    definition: {
      label: 'Rich Text',
      description:
        'Renders a body field coming from a CMS — HTML, markdown or plain text. Scripts and event handlers are ' +
        'stripped before rendering, so third-party content cannot execute. The parts of an HTML or markdown body take ' +
        'a class through the slots a `markdown` has, by the same names: `heading` and `heading1`…`heading6` (a property ' +
        'on one of the two, never both), `paragraph`, `link`, `strong` (`strong`/`b`), `emphasis` (`em`/`i`), ' +
        '`list`, `listItem`, `quote`, `divider`, `code` (inline), `codeBlock` (`pre`), `image`, `table`, `tableHead`, ' +
        '`tableRow`, `tableHeaderCell`, `tableCell`; the fenced block of a markdown body also sits in ' +
        '`codeBlockFrame`, under `codeBlockHeader` with `codeBlockLanguage` and `codeBlockCopy`. Unstyled, a body ' +
        'reads as a document from the base layer of the SDK, which a class on the slot of a part replaces property by ' +
        'property.',
      items: [],
      styleSelectors: {
        heading: '',
        heading1: '',
        heading2: '',
        heading3: '',
        heading4: '',
        heading5: '',
        heading6: '',
        paragraph: '',
        link: '',
        strong: '',
        emphasis: '',
        list: '',
        listItem: '',
        quote: '',
        divider: '',
        code: '',
        codeBlock: '',
        codeBlockFrame: '',
        codeBlockHeader: '',
        codeBlockLanguage: '',
        codeBlockCopy: '',
        image: '',
        table: '',
        tableHead: '',
        tableRow: '',
        tableHeaderCell: '',
        tableCell: ''
      }
    },
    market: {
      category: 'basic',
      icon: 'fa-solid fa-file-lines'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
