import clsx from 'clsx';
import { use } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import useElement from '../../../../Element/hooks/useElement';
import RootElement from '../../../../Element/RootElement';
import { TablePartContext } from '../TablePart';

import type { ReactNode, RefObject } from 'react';

export type TableColumnProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  /** What each row's cell holds: the elements a row draws, its item in hand (`row.item`). */
  children?: ReactNode;
  /** The column's header, in the table's head: what its cells are (`<th scope="col">`). */
  header?: string;
  /** Whether this column's cell names its row — a product's name — read as the row's header (`<th scope="row">`). */
  rowHeader?: boolean;
};

/**
 * One column of a table: its header in the head, and in each row that row's cell. One element drawn in both, so its
 * `visible` shows or hides the whole column, and its class styles its header and its cells alike (the `header` slot
 * the header alone).
 */
const TableColumn = ({ ref, className = '', children, header = '', rowHeader = false }: TableColumnProps) => {
  const part = use(TablePartContext);
  const {
    definition: { styleSelectors }
  } = useElement();

  if (part === 'head') {
    return (
      <RootElement
        ref={ref}
        tag="th"
        scope="col"
        className={clsx(
          'plitzi-component__table-column',
          'plitzi-component__table-header',
          className,
          styleSelectors.header
        )}
      >
        {header}
      </RootElement>
    );
  }

  return (
    <RootElement
      ref={ref}
      tag={rowHeader ? 'th' : 'td'}
      {...(rowHeader ? { scope: 'row' } : {})}
      className={clsx('plitzi-component__table-column', className)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(TableColumn);

export { TableColumn };
