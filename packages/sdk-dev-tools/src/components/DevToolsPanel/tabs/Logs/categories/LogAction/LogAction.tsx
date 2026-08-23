import clsx from 'clsx';

import type { LogAction as TLogAction } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type LogActionProps = {
  className?: string;
  time?: string;
  message?: ReactNode;
  params: TLogAction['params'];
};

/** Adds mode, server run id and refusal reason to the message line. */
const LogAction = ({ className = '', time, message, params }: LogActionProps) => {
  const { actionId, mode, runId, status, reason, error } = params;
  const failed = Boolean(reason ?? error);

  return (
    <div className={clsx('flex flex-col border-b border-gray-100 px-2 py-1 dark:border-zinc-800', className)}>
      <div className="flex items-center gap-2">
        {time && <span className="text-gray-400">{time}</span>}
        <span className="grow">{message ?? actionId}</span>
        {mode && <span className="rounded-sm bg-gray-100 px-1 text-[10px] uppercase dark:bg-zinc-800">{mode}</span>}
        <span className={clsx(failed ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-zinc-400')}>
          {reason ?? status ?? ''}
        </span>
      </div>
      {runId && <span className="font-mono text-[10px] text-gray-400">run {runId}</span>}
      {error && <span className="break-words text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
};

export default LogAction;
