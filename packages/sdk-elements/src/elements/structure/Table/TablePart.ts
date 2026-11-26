import { createContext } from 'react';

/**
 * Where a table's columns are drawn: its head — each column its header, a `<th scope="col">` — or one of its rows — each
 * column that row's cell. A column is one element drawn in both, so it shows or hides, and is styled, as one.
 */
export type TablePart = 'head' | 'row';

export const TablePartContext = createContext<TablePart>('row');
