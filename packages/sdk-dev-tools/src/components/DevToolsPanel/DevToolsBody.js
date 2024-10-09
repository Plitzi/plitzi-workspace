// Packages
import React, { use } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Relatives
import DevToolsContext from '../../DevToolsContext';
import Logs from './tabs/Logs';
import DataSourceViewer from './tabs/DataSourceViewer';
import VariablesViewer from './tabs/VariablesViewer';
import ElementsViewer from './tabs/ElementsViewer';

/**
 * @param {{
 *   className?: string;
 *   tabSelected?: string;
 *   orientation: 'horizontal' | 'vertical';
 *   elementSelected?: string;
 *   onSelectElement: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsBody = props => {
  const { className, tabSelected, orientation, elementSelected, onSelectElement = noop } = props;
  const { logs, clearLogs } = use(DevToolsContext);

  return (
    <div className={classNames('flex grow h-full bg-gray-50 w-full overflow-auto', className)}>
      <div className="flex flex-col gap-2 w-full">
        {tabSelected === 'logs' && <Logs items={logs} orientation={orientation} onClear={clearLogs} />}
        {tabSelected === 'dataSources' && <DataSourceViewer elementSelected={elementSelected} />}
        {tabSelected === 'variables' && <VariablesViewer />}
        {tabSelected === 'elements' && (
          <ElementsViewer elementSelected={elementSelected} onSelectElement={onSelectElement} />
        )}
      </div>
    </div>
  );
};

export default DevToolsBody;
