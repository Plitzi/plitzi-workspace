import clsx from 'clsx';
import { useCallback } from 'react';

export type ToolsListItemProps = {
  id?: string;
  title?: string;
  active?: boolean;
  onClick?: (id: string) => void;
};

const ToolsListItem = ({ id = '', title = '', active = false, onClick }: ToolsListItemProps) => {
  const handleClick = useCallback(() => onClick?.(id), [id, onClick]);

  return (
    <li className="-mb-px flex grow" role="presentation">
      <button
        type="button"
        role="tab"
        aria-selected={active}
        className={clsx(
          'focus-visible:outline-primary-500 flex grow cursor-pointer items-center justify-center border-b-2 px-1.5 py-1.5 text-xs whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2',
          {
            'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100': !active,
            'border-primary-ui text-primary-text font-medium': active
          }
        )}
        onClick={handleClick}
      >
        {title}
      </button>
    </li>
  );
};

export default ToolsListItem;
