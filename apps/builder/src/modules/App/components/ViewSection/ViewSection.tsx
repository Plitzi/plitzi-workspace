import type { ReactNode } from 'react';

export type ViewSectionProps = {
  title: ReactNode;
  /** Commands that act on this section alone. */
  actions?: ReactNode;
  children?: ReactNode;
};

/** One part of a view's page, under a small label — never a second page title. */
const ViewSection = ({ title, actions, children }: ViewSectionProps) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">{title}</h3>
      {actions}
    </div>
    {children}
  </section>
);

export default ViewSection;
