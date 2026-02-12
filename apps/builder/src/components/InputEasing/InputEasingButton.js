// Packages
import React from 'react';
import clsx from 'clsx';

/**
 * @param {{
 *   children: React.ReactNode;
 *   title?: string;
 *   className?: string;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const InputEasingButton = props => {
  const { children, title = '', className = '', onClick } = props;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={clsx('m-1 h-6 w-6 rounded-sm p-1 hover:bg-gray-100', className)}
    >
      <svg viewBox="0 0 30 30" className="overflow-visible">
        {children}
      </svg>
    </button>
  );
};

export default InputEasingButton;
