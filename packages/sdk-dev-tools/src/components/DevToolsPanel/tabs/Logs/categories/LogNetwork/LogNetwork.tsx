import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';

import LogStatus from '../../LogStatus';

import type { LogNetwork as TLogNetwork } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right text-[10px]" />;
const iconExpanded = <i className="fa-solid fa-angle-down text-[10px]" />;

export type LogNetworkProps = {
  className?: string;
  message?: ReactNode;
  params: TLogNetwork['params'];
  time?: string;
};

// A payload that failed its schema. The list of issues IS the content: it says which field, and what was expected
// there — which is what tells a wrong shape apart from a field the publisher simply forgot.
const LogNetwork = ({ time, message, params: { event, issues, payload } }: LogNetworkProps) => {
  return (
    <ContainerCollapsable
      className="last:border-b-none w-full border-b border-l-2 border-b-zinc-200 border-l-red-500 px-2 py-1 transition-colors hover:bg-zinc-50 dark:border-b-zinc-700 dark:hover:bg-zinc-800/50"
      collapsed
    >
      <ContainerCollapsable.Header
        title={
          <div className="flex w-full items-center gap-2 overflow-hidden">
            <span className="shrink-0 font-mono text-zinc-400 tabular-nums dark:text-zinc-500">{time}</span>
            <LogStatus logType="danger">Invalid</LogStatus>
            <div className="grow basis-0 truncate text-zinc-700 dark:text-zinc-300">{message}</div>
          </div>
        }
        placement="left"
        className={{ headerTitle: 'overflow-hidden' }}
        iconCollapsed={iconCollapsed}
        iconExpanded={iconExpanded}
      >
        <span className="font-mono text-zinc-400 dark:text-zinc-500">{event}</span>
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content>
        <div className="flex flex-col gap-1 py-1 pl-4">
          {issues.map(issue => (
            <div key={`${issue.path}-${issue.message}`} className="flex gap-2">
              <span className="font-mono text-red-600 dark:text-red-400">{issue.path || '(root)'}</span>
              <span className="text-zinc-600 dark:text-zinc-300">{issue.message}</span>
            </div>
          ))}
          {payload !== undefined && (
            <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 text-[11px] text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
              {JSON.stringify(payload, null, 2)}
            </pre>
          )}
        </div>
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default LogNetwork;
