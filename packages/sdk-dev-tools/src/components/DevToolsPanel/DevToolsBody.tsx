import classNames from 'classnames';
import { use } from 'react';

import DevToolsContext from '../../DevToolsContext';
import DataSourceViewer from './tabs/DataSourceViewer';
import ElementsViewer from './tabs/ElementsViewer';
import Logs from './tabs/Logs';
import PluginsViewer from './tabs/PluginsViewer/PluginsViewer';
import VariablesViewer from './tabs/VariablesViewer';

export type DevToolsBodyProps = {
  className?: string;
  tabSelected?: string;
  orientation: 'horizontal' | 'vertical';
  elementSelected?: string;
  onSelectElement: (id?: string) => void;
};

const DevToolsBody = ({ className, tabSelected, orientation, elementSelected, onSelectElement }: DevToolsBodyProps) => {
  const { logs, clearLogs } = use(DevToolsContext);

  return (
    <div className={classNames('flex h-full w-full grow overflow-auto bg-gray-50', className)}>
      <div className="flex w-full flex-col gap-2">
        {tabSelected === 'logs' && <Logs items={logs} orientation={orientation} onClear={clearLogs} />}
        {tabSelected === 'dataSources' && <DataSourceViewer elementSelected={elementSelected} />}
        {tabSelected === 'variables' && <VariablesViewer />}
        {tabSelected === 'elements' && (
          <ElementsViewer elementSelected={elementSelected} onSelectElement={onSelectElement} />
        )}
        {tabSelected === 'plugins' && <PluginsViewer />}
      </div>
    </div>
  );
};

export default DevToolsBody;
