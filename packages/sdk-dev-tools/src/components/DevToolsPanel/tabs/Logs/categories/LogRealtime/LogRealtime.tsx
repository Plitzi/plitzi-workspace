import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';

import LogStatus from '../../LogStatus';

import type { LogRealtime as TLogRealtime, LogType } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right text-[10px]" />;
const iconExpanded = <i className="fa-solid fa-angle-down text-[10px]" />;

const LABEL: Record<TLogRealtime['params']['event'], string> = {
  status: 'Status',
  received: 'In',
  published: 'Out',
  refused: 'Refused'
};

/** What a log carries beyond its line: the message as it arrived, what was sent, or the topics a status was for. */
const detailOf = (params: TLogRealtime['params']): unknown => {
  switch (params.event) {
    case 'received':
      return params.message;
    case 'published':
      return { data: params.data, delivered: params.delivered };
    case 'status':
      return { topics: params.topics, transport: params.transport };
    case 'refused':
      return { reason: params.reason };
  }
};

export type LogRealtimeProps = {
  logType: LogType;
  message?: ReactNode;
  params: TLogRealtime['params'];
  time?: string;
};

// The page's realtime connection, line by line: it opening and dropping, each message in (←) and out (→), and every
// topic the server would not carry here — with why, which is the one thing a silent channel never says by itself.
const LogRealtime = ({ logType, time, message, params }: LogRealtimeProps) => (
  <ContainerCollapsable
    className="last:border-b-none w-full border-b border-l-2 border-b-zinc-200 border-l-sky-500 px-2 py-1 transition-colors hover:bg-zinc-50 dark:border-b-zinc-700 dark:hover:bg-zinc-800/50"
    collapsed
  >
    <ContainerCollapsable.Header
      title={
        <div className="flex w-full items-center gap-2 overflow-hidden">
          <span className="shrink-0 font-mono text-zinc-400 tabular-nums dark:text-zinc-500">{time}</span>
          <LogStatus logType={logType}>{LABEL[params.event]}</LogStatus>
          <div className="grow basis-0 truncate text-zinc-700 dark:text-zinc-300">{message}</div>
        </div>
      }
      placement="left"
      className={{ headerTitle: 'overflow-hidden' }}
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
    >
      <span className="font-mono text-zinc-400 dark:text-zinc-500">realtime</span>
    </ContainerCollapsable.Header>
    <ContainerCollapsable.Content>
      <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 text-[11px] text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
        {JSON.stringify(detailOf(params), null, 2)}
      </pre>
    </ContainerCollapsable.Content>
  </ContainerCollapsable>
);

export default LogRealtime;
