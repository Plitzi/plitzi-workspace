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
    <li
      className={clsx(
        'hover:text-primary-text -mb-0.5 flex grow basis-0 cursor-pointer items-center justify-center border-b-4 px-1 text-xs',
        { 'border-transparent': !active, 'border-primary-ui text-primary-text': active }
      )}
      onClick={handleClick}
    >
      {title}
    </li>
  );
};

export default ToolsListItem;
