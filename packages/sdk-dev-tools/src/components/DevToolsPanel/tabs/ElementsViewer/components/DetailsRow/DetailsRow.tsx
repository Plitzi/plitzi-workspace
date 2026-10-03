import type { ReactNode } from 'react';

export type DetailsRowProps = {
  name: string;
  children?: ReactNode;
};

/** One line of a details table: a name, and what it holds. */
const DetailsRow = ({ name, children }: DetailsRowProps) => (
  <div className="flex gap-4 border-zinc-200 py-1 dark:border-zinc-700 [&:not(:first-child)]:border-t">
    <div className="grow basis-0 text-zinc-500 dark:text-zinc-400">{name}</div>
    <div className="grow basis-0 truncate text-zinc-800 dark:text-zinc-200">{children}</div>
  </div>
);

export default DetailsRow;
