import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import clsx from 'clsx';

import LogStoreBody from './LogStoreBody';
import LogStoreHeader from './LogStoreHeader';
import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';

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
  const { isDark } = useDevToolsTheme();

  return (
    <ContainerCollapsable
      className={clsx(
        'last:border-b-none w-full border-b border-l-2 border-l-violet-500 px-2 py-1 transition-colors',
        isDark ? 'border-b-zinc-700 hover:bg-zinc-800/50' : 'border-b-zinc-200 hover:bg-zinc-50'
      )}
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
