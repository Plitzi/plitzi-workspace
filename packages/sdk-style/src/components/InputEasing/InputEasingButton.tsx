import classNames from 'classnames';

import type { ReactNode } from 'react';

export type InputEasingButtonProps = {
  children: ReactNode;
  title?: string;
  className?: string;
  onClick?: () => void;
};

const InputEasingButton = ({ children, title = '', className = '', onClick }: InputEasingButtonProps) => {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={classNames('m-1 h-6 w-6 rounded-sm p-1 hover:bg-gray-100', className)}
    >
      <svg viewBox="0 0 30 30" className="overflow-visible">
        {children}
      </svg>
    </button>
  );
};

export default InputEasingButton;
