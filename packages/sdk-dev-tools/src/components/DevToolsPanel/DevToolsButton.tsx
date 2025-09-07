import classNames from 'classnames';

import type { MouseEvent } from 'react';

export type DevToolsButtonProps = {
  className?: string;
  isSelected?: boolean;
  iconClassName?: string;
  title?: string;
  onClick?: (e?: MouseEvent) => void;
};

const DevToolsButton = ({ className, iconClassName, title, isSelected = false, onClick }: DevToolsButtonProps) => (
  <i
    className={classNames(
      'flex h-6 w-6 cursor-pointer items-center justify-center border border-dotted p-0.5',
      {
        'border-gray-500 hover:border-purple-500 hover:text-purple-500': !isSelected,
        'border-purple-500 text-purple-500': isSelected
      },
      className,
      iconClassName
    )}
    title={title}
    onClick={onClick}
  />
);

export default DevToolsButton;
