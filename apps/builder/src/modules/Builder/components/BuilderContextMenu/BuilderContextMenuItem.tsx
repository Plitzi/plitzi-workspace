import classNames from 'classnames';
import { useCallback } from 'react';

import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';

export type BuilderContextMenuItemProps = {
  id?: string;
  title?: string;
  shortcut?: string;
  children?: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent, id: string) => void;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onClick'>;

const BuilderContextMenuItem = ({
  id = '',
  title = 'Title',
  shortcut = '',
  children,
  className = '',
  onClick,
  ...otherProps
}: BuilderContextMenuItemProps) => {
  const handleClick = useCallback((e: MouseEvent) => onClick?.(e, id), [id, onClick]);

  return (
    <div
      className={classNames(
        'flex cursor-pointer items-center justify-between border-b border-gray-300 px-4 py-1 select-none last:border-b-0 hover:bg-blue-100',
        className
      )}
      onClick={handleClick}
      {...otherProps}
    >
      <div className="flex items-center">
        <div className="mr-1 text-blue-400">{children}</div>
        {title}
      </div>
      <div className="text-xs text-[10px] text-gray-500 opacity-80">{shortcut}</div>
    </div>
  );
};

export default BuilderContextMenuItem;
