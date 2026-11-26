/** Static declaration for Table: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { TableProps } from './Table';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TableAttributes = AuthorableAttributes<TableProps>;

const declaration = elementDeclaration<TableAttributes>()({
  type: 'table',
  sourceType: 'table',
  publishes: {
    items: 'Every row it draws, as its items give them',
    item: "Inside a row: that row's item",
    index: 'Inside a row: its place, from 0'
  },
  content: {
    attributes: {
      items: [],
      caption: ''
    },
    definition: {
      label: 'Table',
      description:
        'A table of data — a <table> read as one by screen readers and search engines: its children are ' +
        '`tableColumn`s, each a header in its head and a cell in every row, and it draws one row per entry of its ' +
        'items (bound to a source like a list). A column whose `visible` changes is gone from the head and every row ' +
        'at once. Its `caption` says what the table is.',
      items: [],
      styleSelectors: { caption: '', head: '', row: '' }
    },
    builder: {
      itemsAllowed: ['tableColumn']
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-table'
    },
    defaultStyle: {
      style: {
        base: { default: { width: '100%', 'border-collapse': 'collapse', 'text-align': 'left' } },
        caption: { default: { 'text-align': 'left', 'padding-bottom': '8px' } },
        head: {
          default: { 'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': 'currentColor' }
        },
        row: {
          default: {
            'border-bottom-width': '1px',
            'border-bottom-style': 'solid',
            'border-bottom-color': 'rgba(127, 127, 127, 0.25)'
          }
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
