import Button from '@plitzi/plitzi-ui/Button';

import type { ReactNode } from 'react';

export type SidebarSectionProps = {
  title: string;
  /** How many there are, beside the title — none for a section that is not a list. */
  count?: number;
  /** What its one button does, in words: its tooltip and its accessible name. */
  actionTitle?: string;
  onAction?: () => void;
  children: ReactNode;
};

/** One part of the sidebar: its title and how many it holds, the button that adds one, and the list. */
const SidebarSection = ({ title, count, actionTitle, onAction, children }: SidebarSectionProps) => (
  <section className="flex flex-col gap-1.5" aria-label={title}>
    <div className="flex h-6 items-center justify-between px-1">
      <span className="text-ui-fg-subtle flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        {title}
        {count !== undefined && (
          <span className="bg-ui-raised text-ui-fg-muted rounded-full px-1.5 text-[11px] font-medium">{count}</span>
        )}
      </span>
      {onAction && (
        <Button size="xs" intent="secondary" title={actionTitle} aria-label={actionTitle} onClick={onAction}>
          <i className="fa-solid fa-plus" />
        </Button>
      )}
    </div>
    {children}
  </section>
);

export default SidebarSection;
