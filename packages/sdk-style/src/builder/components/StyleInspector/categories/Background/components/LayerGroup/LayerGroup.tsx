import type { ReactNode } from 'react';

export type LayerGroupProps = {
  title: string;
  children?: ReactNode;
};

/** A titled group of a layer's controls — what it draws, then where it goes — so a long editor reads in two halves. */
const LayerGroup = ({ title, children }: LayerGroupProps) => (
  <div className="flex flex-col gap-2">
    <span className="text-ui-fg-subtle text-[11px] font-semibold tracking-wide uppercase">{title}</span>
    {children}
  </div>
);

export default LayerGroup;
