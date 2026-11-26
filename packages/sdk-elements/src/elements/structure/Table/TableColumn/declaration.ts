/** Static declaration for TableColumn: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { TableColumnProps } from './TableColumn';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TableColumnAttributes = AuthorableAttributes<TableColumnProps>;

const declaration = elementDeclaration<TableColumnAttributes>()({
  type: 'tableColumn',
  ancestorType: 'table',
  content: {
    attributes: { header: '', rowHeader: false },
    definition: {
      label: 'Table Column',
      description:
        'One column of a table: its `header` in the head (`<th scope="col">`), and in each row the cell its children ' +
        'draw, the row in hand. `rowHeader` makes its cell name its row (`<th scope="row">`). Its `visible` shows or ' +
        'hides the whole column; its class styles the header and the cells, the `header` slot the header alone.',
      items: [],
      styleSelectors: { header: '' }
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-table-columns'
    },
    defaultStyle: {
      style: {
        base: { default: { padding: '8px 12px', 'vertical-align': 'top' } },
        header: { default: { 'font-weight': '600', 'white-space': 'nowrap' } }
      },
      subTypes: {}
    }
  }
});

export default declaration;
