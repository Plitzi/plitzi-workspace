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
        'flex items-center justify-center border-b-4 grow basis-0 cursor-pointer hover:text-blue-400 text-xs px-1',
        { 'border-transparent': !active, 'border-blue-400 text-blue-400': active }
      )}
      onClick={handleClick}
    >
      {title}
    </li>
  );
};

export default ToolsListItem;
