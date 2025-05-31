import classNames from 'classnames';
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
      className={classNames(
        'flex items-center justify-center border-b-4 -mb-0.5 grow basis-0 cursor-pointer hover:text-primary-500 text-xs px-1',
        { 'border-transparent': !active, 'border-primary-500 text-primary-500': active }
      )}
      onClick={handleClick}
    >
      {title}
    </li>
  );
};

export default ToolsListItem;
