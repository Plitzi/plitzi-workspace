import classNames from 'classnames';

import type { LogType } from '../../../../DevToolsContext';
import type { ReactNode } from 'react';

export type LogStatusIconProps = {
  children?: ReactNode;
  className?: string;
  iconClassName?: string;
  logType: LogType;
  title?: string;
};

const LogStatusIcon = ({ className, logType = 'info', iconClassName, title, children }: LogStatusIconProps) => {
  return (
    <div className={classNames('flex items-center gap-1 rounded-lg text-sm', className)} title={title}>
      <i
        className={classNames(iconClassName, {
          'fa-regular fa-circle-xmark text-red-500': logType === 'danger',
          'fa-solid fa-triangle-exclamation text-orange-500': logType === 'warning',
          'fa-solid fa-circle-info text-blue-500': logType === 'info',
          'fa-solid fa-check text-green-500': logType === 'success'
        })}
      />
      {children}
    </div>
  );
};

export default LogStatusIcon;
