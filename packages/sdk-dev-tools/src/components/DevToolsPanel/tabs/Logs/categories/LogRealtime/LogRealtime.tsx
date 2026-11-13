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
    className="last:border-b-none border-b-ui-line hover:bg-ui-hover w-full border-b border-l-2 border-l-sky-500 px-2 py-1 transition-colors"
    collapsed
  >
    <ContainerCollapsable.Header
      title={
        <div className="flex w-full items-center gap-2 overflow-hidden">
          <span className="text-ui-fg-subtle shrink-0 font-mono tabular-nums">{time}</span>
          <LogStatus logType={logType}>{LABEL[params.event]}</LogStatus>
          <div className="text-ui-fg grow basis-0 truncate">{message}</div>
        </div>
      }
      placement="left"
      className={{ headerTitle: 'overflow-hidden' }}
      iconCollapsed={iconCollapsed}
      iconExpanded={iconExpanded}
    >
      <span className="text-ui-fg-subtle font-mono">realtime</span>
    </ContainerCollapsable.Header>
    <ContainerCollapsable.Content>
      <pre className="bg-ui-raised text-ui-fg-muted mt-1 overflow-x-auto rounded p-2 text-[11px]">
        {JSON.stringify(detailOf(params), null, 2)}
      </pre>
    </ContainerCollapsable.Content>
  </ContainerCollapsable>
);

export default LogRealtime;
