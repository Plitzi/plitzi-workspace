import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** A Font Awesome class, e.g. `fa-solid fa-bolt`. */
  icon: string;
  title: ReactNode;
  description?: ReactNode;
  /** What starts it — usually the one button that creates the first one. */
  action?: ReactNode;
};

/** A subject with nothing in it yet: what it is for, and the way to start. The same everywhere it appears. */
const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-800/20">
    <span className="bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex size-10 items-center justify-center rounded-lg">
      <i className={icon} />
    </span>
    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
    {description && <p className="max-w-md text-sm leading-relaxed text-gray-600 dark:text-zinc-400">{description}</p>}
    {action && <div className="mt-1 flex gap-2">{action}</div>}
  </div>
);

export default EmptyState;
