import type { ReactNode } from 'react';

export type MotionSectionProps = {
  title: string;
  children: ReactNode;
};

/** A band of the tab, headed the way the style inspector's categories are. */
const MotionSection = ({ title, children }: MotionSectionProps) => (
  <section aria-label={title} className="border-ui-line flex flex-col border-b">
    <h3 className="text-ui-fg dark:bg-ui-active/50 m-0 flex h-8 items-center bg-slate-100 px-2 text-xs font-medium">
      {title}
    </h3>
    <div className="flex flex-col gap-2 p-2">{children}</div>
  </section>
);

export default MotionSection;
