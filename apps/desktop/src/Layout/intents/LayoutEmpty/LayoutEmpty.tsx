import clsx from 'clsx';

import type { ReactNode } from 'react';

export type LayoutEmptyProps = { children?: ReactNode; className?: string };

const LayoutEmpty = ({ children, className }: LayoutEmptyProps) => (
  <div className={clsx('flex grow flex-col bg-zinc-50 dark:bg-zinc-950', className)}>{children}</div>
);

export default LayoutEmpty;
