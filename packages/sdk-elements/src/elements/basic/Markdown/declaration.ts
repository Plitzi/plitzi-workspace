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
      type: 'markdown',
      description:
        'Renders a Markdown source string (GitHub-flavoured) as HTML, inside a `div.markdown`. Each part of it takes a ' +
        'class through its slot: `heading` (`h1`–`h6`), `paragraph` (`p`), `link` (`a`), `list` (`ul`/`ol`), ' +
        '`listItem` (`li`), `quote` (`blockquote`), `code` (inline `code`), `codeBlock` (the `pre` of a fenced block, ' +
        'inside a `div.markdown-code` with its language and a copy button), `image` (`img`), `table` and `anchor`. ' +
        'Every heading carries an id made of its words, which `/page#its-words` lands on, and starts with an empty ' +
        'link to itself — `a.anchor > span.octicon-link`, the `anchor` slot; `headingLinks: false` leaves the link ' +
        'out and keeps the id. The SDK styles none of it.',
      bindings: {},
      styleSelectors: {
        base: '',
        heading: '',
        paragraph: '',
        link: '',
        list: '',
        listItem: '',
        quote: '',
        code: '',
        codeBlock: '',
        image: '',
        table: '',
        anchor: ''
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
      canSnippet: true,
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
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default declaration;
