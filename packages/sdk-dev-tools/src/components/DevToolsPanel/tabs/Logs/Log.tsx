import { memo } from 'react';

import LogInteraction from './categories/LogInteraction';
import LogNavigation from './categories/LogNavigation';
import LogStore from './categories/LogStore';

import type {
  LogParams,
  LogInteraction as TLogInteraction,
  LogNavigation as TLogNavigation,
  LogStore as TLogStore
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type LogProps = {
  className?: string;
  category: string;
  time?: string;
  message?: ReactNode;
  params: LogParams;
};

const Log = ({ category, message, time, params }: LogProps) => {
  return (
    <>
      {category === 'interactions' && (
        <LogInteraction message={message} params={params as TLogInteraction['params']} time={time} />
      )}
      {category === 'navigation' && (
        <LogNavigation message={message} params={params as TLogNavigation['params']} time={time} />
      )}
      {category === 'store' && <LogStore message={message} params={params as TLogStore['params']} time={time} />}
    </>
  );
};

export default memo(Log);
