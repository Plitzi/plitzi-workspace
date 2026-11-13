import type { ReactNode } from 'react';

export type QaPropertyProps = { name: string; children: ReactNode };

/** One computed property of the inspected element. */
const QaProperty = ({ name, children }: QaPropertyProps) => (
  <div className="grid grid-cols-[88px_minmax(0,1fr)] items-baseline gap-2 py-0.5">
    <span className="text-ui-fg-subtle">{name}</span>
    <span className="text-ui-fg min-w-0 truncate font-mono">{children}</span>
  </div>
);

export default QaProperty;
