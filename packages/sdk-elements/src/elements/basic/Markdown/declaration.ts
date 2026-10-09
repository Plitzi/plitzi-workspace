/** Static declaration for Markdown: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { MarkdownProps } from './Markdown';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type MarkdownAttributes = AuthorableAttributes<MarkdownProps>;

const declaration = elementDeclaration<MarkdownAttributes>()({
  type: 'markdown',
  content: {
    attributes: {
      content: 'Markdown',
      headingLinks: true
    },
    definition: {
      label: 'Markdown',
      description:
        'Renders a Markdown source string (GitHub-flavoured) as HTML, inside a `div.markdown`. Each part of it takes a ' +
        'class through the slot named for it: `heading` (every `h1`–`h6`) and `heading1`…`heading6` (that level only, ' +
        'beside it — a property goes on one of the two, never both), `paragraph`, `link`, `strong`, `emphasis` ' +
        '(`em`), `list` (`ul`/`ol`), `listItem`, `quote` (`blockquote`), `divider` (`hr`), `code` (inline), `image`, ' +
        '`table`, `tableHead` (`thead`), `tableRow`, `tableHeaderCell` (`th`) and `tableCell` (`td`). A fenced block ' +
        'is `codeBlock` (its `pre`) in `codeBlockFrame`, under `codeBlockHeader`, which holds `codeBlockLanguage` and ' +
        'the `codeBlockCopy` button. Every heading carries ' +
        'an id made of its words, which `/page#its-words` lands on, and starts with an empty link to itself — ' +
        '`a.anchor > span.octicon-link`, the `anchor` slot; `headingLinks: false` leaves the link out and keeps the id. ' +
        'Unstyled, it reads as a document — headings, lists, code, tables — from the base layer of the SDK, which a ' +
        'class on the slot of a part replaces property by property.',
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
        tableCell: '',
        anchor: ''
      }
    },
    market: {
      category: 'basic',
      icon: 'fa-brands fa-markdown'
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
