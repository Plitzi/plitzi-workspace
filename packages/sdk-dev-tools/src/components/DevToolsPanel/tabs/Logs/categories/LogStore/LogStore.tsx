import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';

import LogStoreBody from './LogStoreBody';
import LogStoreHeader from './LogStoreHeader';

import type { LogStore as TLogStore } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right text-[10px]" />;
const iconExpanded = <i className="fa-solid fa-angle-down text-[10px]" />;

export type LogStoreProps = {
  message?: ReactNode;
  params?: TLogStore['params'];
  time?: string | Date;
};

const LogStore = ({ time, message, params }: LogStoreProps) => {
  return (
    <ContainerCollapsable
      className="last:border-b-none w-full border-b border-l-2 border-b-zinc-200 border-l-violet-500 px-2 py-1 transition-colors hover:bg-zinc-50 dark:border-b-zinc-700 dark:hover:bg-zinc-800/50"
      collapsed
    >
      <ContainerCollapsable.Header
        title={<LogStoreHeader storeName={params?.storeName} path={params?.path} message={message} time={time} />}
        placement="left"
        className={{ headerTitle: 'overflow-hidden' }}
        iconCollapsed={iconCollapsed}
        iconExpanded={iconExpanded}
      />
      <ContainerCollapsable.Content>
        <LogStoreBody path={params?.path} prev={params?.prev} next={params?.next} />
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default LogStore;
