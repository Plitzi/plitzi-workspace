import clsx from 'clsx';

import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';
import LogStatus from '../../LogStatus';

import type { ReactNode } from 'react';

export type LogInteractionHeaderProps = {
  className?: string;
  status: string;
  message?: ReactNode;
  time?: string;
};

const LogInteractionHeader = ({ status, message, time }: LogInteractionHeaderProps) => {
  const { isDark } = useDevToolsTheme();

  return (
    <div className="flex w-full items-center gap-2 overflow-hidden">
      <span className={clsx('shrink-0 font-mono tabular-nums', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
        {time}
      </span>
      {status === 'completed' && <LogStatus logType="success">Completed</LogStatus>}
      {status === 'skipped' && (
        <LogStatus logType="custom" iconClassName="fa-solid fa-forward-step">
          Skipped
        </LogStatus>
      )}
      <div className={clsx('grow basis-0 truncate', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{message}</div>
    </div>
  );
};

export default LogInteractionHeader;
