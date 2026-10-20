import { createContext } from 'react';

/**
 * The rows an element is drawn in, outermost first: what makes an anchor inside a list's row the row's own.
 *
 * A list draws its row once per item, every element with the same id — so an `anchor` there would be the same `id`
 * in the page as many times. Inside a row it is drawn with the row's name after it (`faq-answer-luna`): one per row,
 * and a button of the same row that `controls` it (`controlsInRow`) points at its own row's, as `aria-controls` must.
 */
export const RowAnchorContext = createContext<readonly string[]>([]);

/**
 * What a row is called in an anchor: its key as the list keys it (`id:luna` → `luna`, `slug:Field Notes` →
 * `field-notes`), its position (`3`) when the items name none — always letters, digits and `-`, as an id is.
 */
export const rowAnchorName = (key: string | number): string => {
  const named = String(key)
    .replace(/^[^:]*:/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return named === '' ? String(key).replace(/[^0-9]/g, '') || 'row' : named;
};

/** `anchor` as the rows it is drawn in make it: itself outside every list, `<anchor>-<row>…` inside one. */
export const anchorInRows = (anchor: string, rows: readonly string[]): string =>
  rows.length === 0 ? anchor : [anchor, ...rows].join('-');
