// Packages
import React, { use } from 'react';
import classNames from 'classnames';

// Relatives
import DevToolsContext from './DevToolsContext';
import Logs from './components/Logs/Logs';
import DataSourceViewer from './components/DataSourceViewer';

/**
 * @param {{
 *   className?: string;
 *   tabSelected?: string;
 *   orientation: 'horizontal' | 'vertical';
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsBody = props => {
  const { className, tabSelected, orientation } = props;
  const { logs, clearLogs } = use(DevToolsContext);

  return (
    <div className={classNames('flex grow h-full bg-gray-50 w-full overflow-auto', className)}>
      <div className="flex flex-col gap-2 w-full">
        {tabSelected === 'logs' && <Logs items={logs} orientation={orientation} onClear={clearLogs} />}
        {tabSelected === 'dataSources' && <DataSourceViewer />}
        {tabSelected === 'variables' && (
          <div className="flex items-center justify-center h-full w-full">Coming Soon</div>
        )}
      </div>
    </div>
  );
};

export default DevToolsBody;
