import type { ReactNode } from 'react';

export type QaPropertyProps = { name: string; children: ReactNode };

/** One computed property of the inspected element. */
const QaProperty = ({ name, children }: QaPropertyProps) => (
  <div className="grid grid-cols-[88px_minmax(0,1fr)] items-baseline gap-2 py-0.5">
    <span className="text-zinc-400 dark:text-zinc-500">{name}</span>
    <span className="min-w-0 truncate font-mono text-zinc-800 dark:text-zinc-200">{children}</span>
  </div>
);

export default QaProperty;
