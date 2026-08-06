import clsx from 'clsx';

import type { ReactNode } from 'react';

export type FieldGridProps = {
  children: ReactNode;
  /**
   * Fixed number of columns. Omitted, the grid fits as many as the width allows.
   *
   * A fixed count does not adapt, so it is for rows whose fields belong together and should stay aligned — pick it
   * when the layout is part of the meaning, not to hand-tune a breakpoint.
   */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
};

/** Written out rather than interpolated: Tailwind only emits classes it can find as literals in the source. */
const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4'
};

const AUTO_COLUMNS = 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]';

/**
 * Flows short fields into columns.
 *
 * The Connectors panel renders in the main area, not in a 350px dock, so on a wide monitor a single column of
 * full-width inputs leaves most of the screen empty and stretches every field far past the length of what goes in
 * it. The default `auto-fill` handles that without breakpoints: one column in a narrow panel, three in a wide one,
 * and nothing to keep in step with the popup's resize handle.
 */
const FieldGrid = ({ children, columns, className }: FieldGridProps) => {
  return <div className={clsx('grid gap-2', columns ? COLUMNS[columns] : AUTO_COLUMNS, className)}>{children}</div>;
};

export default FieldGrid;
