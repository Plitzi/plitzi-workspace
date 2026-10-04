import type { ReactNode } from 'react';

export type MotionSectionProps = {
  title: string;
  children: ReactNode;
};

/** A band of the tab, headed the way the style inspector's categories are. */
const MotionSection = ({ title, children }: MotionSectionProps) => (
  <section aria-label={title} className="flex flex-col border-b border-gray-200 dark:border-zinc-700">
    <h3 className="m-0 flex h-8 items-center bg-slate-100 px-2 text-xs font-medium text-gray-800 dark:bg-zinc-700/50 dark:text-zinc-100">
      {title}
    </h3>
    <div className="flex flex-col gap-2 p-2">{children}</div>
  </section>
);

export default MotionSection;
