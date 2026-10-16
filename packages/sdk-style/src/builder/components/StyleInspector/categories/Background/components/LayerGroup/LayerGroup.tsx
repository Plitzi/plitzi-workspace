import type { ReactNode } from 'react';

export type LayerGroupProps = {
  title: string;
  children?: ReactNode;
};

/** A titled group of a layer's controls — what it draws, then where it goes — so a long editor reads in two halves. */
const LayerGroup = ({ title, children }: LayerGroupProps) => (
  <div className="flex flex-col gap-2">
    <span className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{title}</span>
    {children}
  </div>
);

export default LayerGroup;
