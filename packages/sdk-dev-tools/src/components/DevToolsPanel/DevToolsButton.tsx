// Packages
import classNames from 'classnames';

// Types
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
      'w-6 h-6 flex items-center justify-center border border-dotted p-0.5 cursor-pointer',
      {
        'border-gray-500 hover:text-purple-500 hover:border-purple-500': !isSelected,
        'text-purple-500 border-purple-500': isSelected
      },
      className,
      iconClassName
    )}
    title={title}
    onClick={onClick}
  />
);

export default DevToolsButton;
