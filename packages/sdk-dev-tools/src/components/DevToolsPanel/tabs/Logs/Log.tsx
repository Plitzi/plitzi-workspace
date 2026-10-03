import { memo } from 'react';

import LogAction from './categories/LogAction';
import LogInteraction from './categories/LogInteraction';
import LogNavigation from './categories/LogNavigation';
import LogNetwork from './categories/LogNetwork';
import LogRealtime from './categories/LogRealtime';
import LogStore from './categories/LogStore';

import type { Log as TLog } from '@plitzi/sdk-shared';

export type LogProps = {
  log: TLog;
};

/** One entry, drawn by its category — which is also what types its params. */
const Log = ({ log }: LogProps) => {
  const { message, time } = log;
  switch (log.category) {
    case 'interactions':
      return <LogInteraction message={message} params={log.params} time={time} />;
    case 'navigation':
      return <LogNavigation message={message} params={log.params} time={time} />;
    case 'store':
      return <LogStore message={message} params={log.params} time={time} />;
    case 'network':
      return <LogNetwork message={message} params={log.params} time={time} />;
    case 'actions':
      return <LogAction message={message} params={log.params} time={time} />;
    case 'realtime':
      return <LogRealtime logType={log.logType} message={message} params={log.params} time={time} />;
    case 'eventBridge':
      return null;
  }
};

export default memo(Log);
