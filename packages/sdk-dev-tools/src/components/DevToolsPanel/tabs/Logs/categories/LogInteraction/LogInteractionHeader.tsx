import LogStatus from '../../LogStatus';

import type { ReactNode } from 'react';

export type LogInteractionHeaderProps = {
  className?: string;
  status: string;
  message?: ReactNode;
  time?: string;
};

const LogInteractionHeader = ({ status, message, time }: LogInteractionHeaderProps) => {
  return (
    <div className="flex w-full items-center gap-2 overflow-hidden">
      <span className="shrink-0 font-mono text-zinc-400 tabular-nums dark:text-zinc-500">{time}</span>
      {status === 'completed' && <LogStatus logType="success">Completed</LogStatus>}
      {status === 'skipped' && (
        <LogStatus logType="custom" iconClassName="fa-solid fa-forward-step">
          Skipped
        </LogStatus>
      )}
      <div className="grow basis-0 truncate text-zinc-700 dark:text-zinc-300">{message}</div>
    </div>
  );
};

export default LogInteractionHeader;
