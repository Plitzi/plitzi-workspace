import { memo } from 'react';

import LogInteraction from './categories/LogInteraction';
import LogNavigation from './categories/LogNavigation';

import type {
  LogInteraction as TLogInteraction,
  LogNavigation as TLogNavigation,
  LogParams
} from '../../../../DevToolsContext';
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
      {/* {category === 'dataSources' && <LogDataSource message={message} params={params} />} */}
    </>
  );
};

export default memo(Log);
