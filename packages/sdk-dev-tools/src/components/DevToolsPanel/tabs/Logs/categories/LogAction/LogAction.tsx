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
    <div className={clsx('border-ui-line flex flex-col border-b px-2 py-1', className)}>
      <div className="flex items-center gap-2">
        {time && <span className="text-ui-fg-subtle">{time}</span>}
        <span className="grow">{message ?? actionId}</span>
        {mode && <span className="bg-ui-raised rounded-sm px-1 text-[10px] uppercase">{mode}</span>}
        <span className={clsx(failed ? 'text-red-600 dark:text-red-400' : 'text-ui-fg-subtle')}>
          {reason ?? status ?? ''}
        </span>
      </div>
      {runId && <span className="text-ui-fg-subtle font-mono text-[10px]">run {runId}</span>}
      {error && <span className="break-words text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
};

export default LogAction;
