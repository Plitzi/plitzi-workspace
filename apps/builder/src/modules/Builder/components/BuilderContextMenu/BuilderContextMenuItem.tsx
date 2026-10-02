import clsx from 'clsx';
import { useCallback } from 'react';

import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';

export type BuilderContextMenuItemProps = {
  id?: string;
  title?: string;
  /** What the item does beyond its name, shown on hover. */
  hint?: string;
  /** Only a shortcut that exists: a menu that shows one teaches it. */
  shortcut?: string;
  /** `danger` for what removes. */
  intent?: 'default' | 'danger';
  children?: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent, id: string) => void;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onClick'>;

const BuilderContextMenuItem = ({
  id = '',
  title = 'Title',
  hint,
  shortcut,
  intent = 'default',
  children,
  className = '',
  onClick,
  ...otherProps
}: BuilderContextMenuItemProps) => {
  const handleClick = useCallback((e: MouseEvent) => onClick?.(e, id), [id, onClick]);

  return (
    <div
      className={clsx(
        'group mx-1 flex h-8 cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 text-[13px] transition-colors duration-100 select-none',
        {
          'hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-400/15 dark:hover:text-primary-200 text-zinc-800 dark:text-zinc-200':
            intent === 'default',
          'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15': intent === 'danger'
        },
        className
      )}
      title={hint && `${title}: ${hint}`}
      onClick={handleClick}
      {...otherProps}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {children && (
          <span
            className={clsx('flex w-4 justify-center text-xs', {
              'text-zinc-400 group-hover:text-current dark:text-zinc-500': intent === 'default'
            })}
          >
            {children}
          </span>
        )}
        <span className="truncate">{title}</span>
      </div>
      {shortcut && <kbd className="font-sans text-[11px] text-zinc-400 dark:text-zinc-500">{shortcut}</kbd>}
    </div>
  );
};

export default BuilderContextMenuItem;
