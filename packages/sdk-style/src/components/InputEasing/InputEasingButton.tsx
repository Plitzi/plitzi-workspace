import clsx from 'clsx';

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
      className={clsx(
        'hover:text-primary-600 dark:hover:text-primary-300 m-0.5 h-7 w-7 cursor-pointer rounded-md p-1 text-zinc-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
        className
      )}
    >
      <svg viewBox="0 0 30 30" className="overflow-visible">
        {children}
      </svg>
    </button>
  );
};

export default InputEasingButton;
