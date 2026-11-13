import type { ReactNode } from 'react';

export type ViewSectionProps = {
  title: ReactNode;
  /** Commands that act on this section alone. */
  actions?: ReactNode;
  children?: ReactNode;
};

/**
 * One part of a view's page, under a small label — never a second page title. On a wide screen the label stands in a
 * column of its own beside what it holds, as a settings page is read: the page takes the width without a field
 * stretched across it.
 */
const ViewSection = ({ title, actions, children }: ViewSectionProps) => (
  <section className="flex flex-col gap-3 2xl:grid 2xl:grid-cols-[13rem_minmax(0,1fr)] 2xl:items-start 2xl:gap-x-10">
    <div className="flex items-center justify-between gap-3 2xl:sticky 2xl:top-0 2xl:flex-col 2xl:items-start 2xl:pt-1">
      <h3 className="text-ui-fg-subtle text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {actions}
    </div>
    <div className="flex min-w-0 flex-col gap-3">{children}</div>
  </section>
);

export default ViewSection;
