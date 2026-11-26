import declaration from './declaration';
import BaseTable from './Table';
import TableColumn from './TableColumn';

// The sub-elements are React components, so they are attached here rather than in the data-only declaration.
const Table = Object.assign(BaseTable, { ...declaration, plugins: { tableColumn: TableColumn } });

export default Table;

export type { TableProps } from './Table';
export type { TableColumnProps } from './TableColumn/TableColumn';
