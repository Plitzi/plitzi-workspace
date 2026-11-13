import type { ReactNode } from 'react';

export type DetailsRowProps = {
  name: string;
  children?: ReactNode;
};

/** One line of a details table: a name, and what it holds. */
const DetailsRow = ({ name, children }: DetailsRowProps) => (
  <div className="border-ui-line flex gap-4 py-1 [&:not(:first-child)]:border-t">
    <div className="text-ui-fg-subtle grow basis-0">{name}</div>
    <div className="text-ui-fg grow basis-0 truncate">{children}</div>
  </div>
);

export default DetailsRow;
