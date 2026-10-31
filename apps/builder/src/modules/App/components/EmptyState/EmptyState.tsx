import clsx from 'clsx';

import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** A Font Awesome class, e.g. `fa-solid fa-bolt`. */
  icon: string;
  title: ReactNode;
  description?: ReactNode;
  /** What starts it — usually the one button that creates the first one. */
  action?: ReactNode;
  /** `page` in a view that takes the canvas' place; `panel` in the sidebar's narrow column. */
  size?: 'page' | 'panel';
};

/** A subject with nothing in it yet: what it is for, and the way to start. The same everywhere it appears. */
const EmptyState = ({ icon, title, description, action, size = 'page' }: EmptyStateProps) => (
  <div
    className={clsx(
      'flex flex-col items-center text-center',
      size === 'page'
        ? 'gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-6 py-12 dark:border-zinc-800 dark:bg-zinc-800/20'
        : 'gap-2 px-3 py-8'
    )}
  >
    <span
      className={clsx(
        'bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex items-center justify-center rounded-lg',
        size === 'page' ? 'size-10' : 'size-8 text-sm'
      )}
    >
      <i className={icon} />
    </span>
    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
    {description && (
      <p
        className={clsx(
          'max-w-md leading-relaxed text-gray-600 dark:text-zinc-400',
          size === 'page' ? 'text-sm' : 'text-xs'
        )}
      >
        {description}
      </p>
    )}
    {action && <div className="mt-1 flex gap-2">{action}</div>}
  </div>
);

export default EmptyState;
