import classNames from 'classnames';

import type { ReactNode } from 'react';

export type GroupButtonProps = {
  title?: string;
  active?: boolean;
  children?: ReactNode;
  onClick?: () => void;
};

const GroupButton = ({ title = '', active = false, children, onClick }: GroupButtonProps) => {
  return (
    <div
      className={classNames('flex items-center justify-center grow basis-0 px-1 cursor-pointer', {
        'text-blue-400': active
      })}
      onClick={onClick}
      title={title}
    >
      {children}
    </div>
  );
};

export default GroupButton;
