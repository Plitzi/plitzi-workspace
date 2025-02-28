import classNames from 'classnames';

import type { LogType } from '../../../../DevToolsContext';
import type { ReactNode } from 'react';

export type LogStatusProps = {
  children?: ReactNode;
  iconClassName?: string;
  className?: string;
  logType: LogType;
};

const LogStatus = ({ className, logType = 'info', iconClassName, children }: LogStatusProps) => {
  return (
    <div
      className={classNames('flex items-center gap-1 px-2 rounded-lg text-sm', className, {
        'bg-red-500 text-white': logType === 'danger',
        'bg-orange-500 text-white': logType === 'warning',
        'bg-blue-500 text-white': logType === 'info',
        'bg-green-500 text-white': logType === 'success'
      })}
    >
      <i
        className={classNames(iconClassName, {
          'fa-regular fa-circle-xmark': logType === 'danger',
          'fa-solid fa-triangle-exclamation': logType === 'warning',
          'fa-solid fa-circle-info': logType === 'info',
          'fa-solid fa-check': logType === 'success'
        })}
      />
      {!children && logType === 'danger' && 'Error'}
      {!children && logType === 'info' && 'Info'}
      {!children && logType === 'success' && 'Success'}
      {!children && logType === 'warning' && 'Warning'}
      {children}
    </div>
  );
};

export default LogStatus;
