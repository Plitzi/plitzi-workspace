import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import clsx from 'clsx';

import LogNavigationBody from './LogNavigationBody';
import LogNavigationHeader from './LogNavigationHeader';

import type { LogNavigation as TLogNavigation } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right text-[10px]" />;
const iconExpanded = <i className="fa-solid fa-angle-down text-[10px]" />;

export type LogNavigationProps = {
  className?: string;
  message?: ReactNode;
  params?: TLogNavigation['params'];
  time?: string | Date;
};

const LogNavigation = ({ time, message, params }: LogNavigationProps) => {
  return (
    <ContainerCollapsable
      className={clsx(
        'last:border-b-none border-b-ui-line hover:bg-ui-hover w-full border-b border-l-2 px-2 py-1 transition-colors',
        {
          'border-l-emerald-500': params?.status === 'normal',
          'border-l-red-500': params?.status === 'accessDenied',
          'border-l-amber-500': params?.status !== 'normal' && params?.status === 'accessDenied'
        }
      )}
      collapsed
    >
      <ContainerCollapsable.Header
        title={<LogNavigationHeader status={params?.status} message={message} time={time} />}
        placement="left"
        className={{ headerTitle: 'overflow-hidden' }}
        iconCollapsed={iconCollapsed}
        iconExpanded={iconExpanded}
      >
        <span className="text-ui-fg-subtle">0ms</span>
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content>
        <LogNavigationBody elementId={params?.elementId} startTime={time} endTime={time} duration="0ms" />
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default LogNavigation;
