import clsx from 'clsx';

import type { LogAction as TLogAction } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type LogActionProps = {
  className?: string;
  time?: string;
  message?: ReactNode;
  params: TLogAction['params'];
};

/**
 * One server action, as a line.
 *
 * What it adds to the message is what an author needs to tell two of them apart and to act on a failure: which
 * way in, the server's run id — which is what a cancel and a support question are both addressed by — and the
 * REASON it was refused, in the server's own vocabulary. "It did not work" is not something anybody can act on;
 * `duplicate` and `forbidden` are.
 */
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
